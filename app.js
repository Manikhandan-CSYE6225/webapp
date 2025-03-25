const express = require("express");
const morgan = require("morgan");
const app = express();
require('dotenv').config();

const db = require("./models");
const fileRoutes = require("./file.js");
const { logger, requestLogger, errorLogger, stream } = require("./logger");

const { HealthCheck } = require("./models");
const metrics = require('./metrics');

// Logging middleware
app.use(morgan('combined', { stream }));
app.use(requestLogger);

app.use("/v1", fileRoutes);

app.all('/healthz', async (req, res) => {
    const start = Date.now();
    logger.debug('Health check request received', {
        method: req.method,
        query: req.query,
        params: req.params
    });

    try {
        await db.sequelize.authenticate();
        if (req.method !== 'GET') {
            logger.warn('Invalid method for health check', { method: req.method });
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(405).end();
        }

        else if (Object.keys(req.query).length > 0 || Object.keys(req.params).length > 0) {
            logger.warn('Invalid request parameters for health check', {
                query: req.query,
                params: req.params
            });
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(400).end();
        }

        else if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
            logger.warn('Invalid content length for health check', {
                contentLength: req.headers['content-length']
            });
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(400).end();
        } else {
            try {
                metrics.incrementApiCall("getHealthz");
                const dbStart = Date.now();
                await HealthCheck.create({});
                metrics.timingDbQuery("getHealthz", Date.now() - dbStart);
                metrics.timingApiCall("getHealthz", Date.now() - start);
                logger.info('Health check successful - database connection verified');
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.set('Pragma', 'no-cache');
                res.set('X-Content-Type-Options', 'nosniff');
                res.status(200);
                res.end();
            } catch (error) {
                logger.error('Health check failed - database error', {
                    error: error.message,
                    stack: error.stack
                });
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.set('Pragma', 'no-cache');
                res.set('X-Content-Type-Options', 'nosniff');
                res.status(503).end();
            }
        }
    } catch (error) {
        logger.error('Health check failed - unexpected error', {
            error: error.message,
            stack: error.stack
        });
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('X-Content-Type-Options', 'nosniff');
        res.status(503).end();
    }

});

// Error handling middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled exception caught by global error handler', {
        error: err.message,
        stack: err.stack
    });

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('X-Content-Type-Options', 'nosniff');
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
