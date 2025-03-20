const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const { Metadata } = require("./models");
const db = require("./models");

AWS.config.update({
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const upload = multer({ storage: multer.memoryStorage() });

// POST: Upload file
router.all("/file", upload.single("file"), async (req, res) => {
    try {
        await db.sequelize.authenticate();
        if (req.method !== 'POST') {
            res.status(400).json({ error: "Bad Request" });
        }

        else if (Object.keys(req.query).length > 0 || Object.keys(req.params).length > 0) {
            res.status(400).json({ error: "Bad Request" });
        }

        else if (!req.is("multipart/form-data")) {
            return res.status(400).json({ error: "Invalid content type. Only multipart/form-data is allowed." });
        }

        else if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        else {
            const fileId = uuidv4();
            const fileName = req.file.originalname;
            const uploadDate = new Date();
            const filePath = `${process.env.S3_BUCKET}/${fileId}/${fileId}-${fileName}`;

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

            await Metadata.create({
                id: fileId,
                file_name: fileName,
                url: filePath,
                upload_date: uploadDate,
                content_type: s3Metadata.ContentType,
                content_length: s3Metadata.ContentLength,
                etag: s3Metadata.ETag,
                last_modified: s3Metadata.LastModified,
                content_disposition: s3Metadata.ContentDisposition,
                content_encoding: s3Metadata.ContentEncoding,
                cache_control: s3Metadata.CacheControl,
                expires: s3Metadata.Expires,
                server_side_encryption: s3Metadata.ServerSideEncryption,
                replication_status: s3Metadata.ReplicationStatus,
                storage_class: s3Metadata.StorageClass
            });

            const fileMetadata = {
                id: fileId,
                file_name: fileName,
                url: filePath,
                upload_date: uploadDate,
            };

            res.status(201).json(fileMetadata);
        }

    } catch (error) {
        console.error("Upload error:", error);
        if (error.code === "CredentialsError" ||
            error.code === "AccessDenied" ||
            error.code === "InvalidAccessKeyId" ||
            error.code === "SignatureDoesNotMatch") {
            return res.status(401).json({ error: "Unauthorized." });
        }
        else {
            res.status(503).json({ error: "Service Unavailable." });
        }
    }
});

router.all("/file/:id", async (req, res) => {
    try {
        await db.sequelize.authenticate();
        const { id } = req.params;
        const file = await Metadata.findByPk(req.params.id, {
            attributes: ["id", "file_name", "url", "upload_date"]
        });
        if (req.method !== 'GET' && req.method !== 'DELETE') {
            res.res.status(400).json({ error: "Bad Request" });
        }

        else if (Object.keys(req.query).length > 0) {
            res.status(400).json({ error: "Bad Request" });
        }

        else if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
            res.status(400).json({ error: "Bad Request" });
        }

        else if (!file) {
            return res.status(404).json({ error: "File not found" });
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

            await Metadata.destroy({ where: { id } });

            res.status(200).json(file);
        }
    } catch (error) {
        console.error("Get file error:", error);
        if (error.code === "CredentialsError" ||
            error.code === "AccessDenied" ||
            error.code === "InvalidAccessKeyId" ||
            error.code === "SignatureDoesNotMatch") {
            return res.status(401).json({ error: "Unauthorized." });
        }
        else {
            res.status(503).json({ error: "Service Unavailable." });
        }
    }
});

module.exports = router;
