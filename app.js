const express = require("express");
const app = express();
require('dotenv').config();

const db = require("./models")

const { HealthCheck } = require("./models");

app.all('/healthz', async (req, res) => {
    try {
        await db.sequelize.authenticate();
        if (req.method !== 'GET') {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(405).end();
        }

        else if (Object.keys(req.query).length > 0 || Object.keys(req.params).length > 0) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(400).end();
        }

        else if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('X-Content-Type-Options', 'nosniff');
            res.status(400).end();
        } else {
            try {
                await HealthCheck.create({});
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.set('Pragma', 'no-cache');
                res.set('X-Content-Type-Options', 'nosniff');
                res.status(200);
                res.end();
            } catch (error) {
                console.error('Unexpected Error:', error);
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.set('Pragma', 'no-cache');
                res.set('X-Content-Type-Options', 'nosniff');
                res.status(503).end();
            }
        }
    } catch (error) {
        console.error('Unexpected Error:', error);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('X-Content-Type-Options', 'nosniff');
        res.status(503).end();
    }

});

module.exports = app;
