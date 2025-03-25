const winston = require('winston');
const { format, transports } = winston;

const logFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'webapp' },
    transports: [

        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, stack, ...meta }) => {
                    return `${timestamp} ${level}: ${message} ${stack || ''} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
                })
            )
        }),

        new transports.File({
            filename: 'error.log',
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5
        }),
        new transports.File({
            filename: 'application.log',
            maxsize: 10485760,
            maxFiles: 5
        })
    ]
});

const stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

const requestLogger = (req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function(...args) {
        const responseTime = Date.now() - start;
        const logMessage = {
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress
        };

        // Log appropriate message based on status code
        if (res.statusCode >= 500) {
            logger.error(`Server error processing ${req.method} ${req.originalUrl || req.url}`, logMessage);
        } else if (res.statusCode >= 400) {
            logger.warn(`Client error processing ${req.method} ${req.originalUrl || req.url}`, logMessage);
        } else {
            logger.info(`Successfully processed ${req.method} ${req.originalUrl || req.url}`, logMessage);
        }

        originalEnd.apply(res, args);
    };

    next();
};

// Log AWS S3 operations
const logS3Operation = (operation, params, result) => {
    logger.info(`S3 ${operation} operation`, {
        operation,
        bucket: params.Bucket,
        key: params.Key,
        result: result ? 'successful' : 'failed'
    });
};

// Log database operations
const logDatabaseOperation = (operation, model, id, result) => {
    logger.info(`Database ${operation} operation`, {
        operation,
        model,
        id,
        result: result ? 'successful' : 'failed'
    });
};

// Error logger
const errorLogger = (err, req, res, next) => {
    logger.error(`Error processing request: ${err.message}`, {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl || req.url,
        body: req.body,
        params: req.params,
        query: req.query
    });

    next(err);
};

module.exports = {
    logger,
    stream,
    requestLogger,
    errorLogger,
    logS3Operation,
    logDatabaseOperation
};