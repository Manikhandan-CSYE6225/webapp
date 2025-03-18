const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const { Metadata } = require("./models");

AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3();

const upload = multer({ storage: multer.memoryStorage() });

// POST: Upload file
router.all("/file", upload.single("file"), async (req, res) => {
    try {
        if (req.method !== 'POST') {
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

        else if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        else {
            const fileId = uuidv4();
            const fileName = req.file.originalname;
            const uploadDate = new Date();
            const filePath = `${process.env.S3_BUCKET}/uploads/${fileId}-${fileName}`;

            const params = {
                Bucket: process.env.S3_BUCKET,
                Key: `uploads/${fileId}-${fileName}`,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };

            await s3.upload(params).promise();

            const headParams = {
                Bucket: process.env.S3_BUCKET,
                Key: `uploads/${fileId}-${fileName}`
            };

            const s3Metadata = await s3.headObject(headParams).promise();

            const fileMetadata = await Metadata.create({
                id: fileId,
                file_name: fileName,
                url: filePath,
                upload_date: uploadDate,
            });

            res.status(201).json(fileMetadata);
        }

    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "File upload failed." });
    }
});

router.all("/file/:id", async (req, res) => {
    try {
        const file = await Metadata.findByPk(req.params.id);
        if (req.method !== 'GET' || req.method !== 'DELETE') {
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
        }

        else if (!file) {
            return res.status(404).json({ error: "File not found." });
        }

        else if (req.method === 'GET') {
            res.status(200).json(file);
        }

        else {
            const params = {
                Bucket: process.env.S3_BUCKET,
                Key: file.url.replace(`${process.env.S3_BUCKET}/`, ""),
            };

            await s3.deleteObject(params).promise();
            await file.destroy();

            res.status(200).json(file);
        }
    } catch (error) {
        console.error("Get file error:", error);
        res.status(500).json({ error: "Error deleting file." });
    }
});

module.exports = router;
