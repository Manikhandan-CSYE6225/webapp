
const app = require("./app");
const db = require("./models")
const { logger } = require("./logger");

logger.info('Starting application server');

db.sequelize.sync().then((req) => {
    logger.info('Database synchronized successfully');

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        logger.info(`Server running on port ${port}`);
    });
}).catch(error => {
    logger.error('Failed to synchronize database', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
    });
    process.exit(1);
});
