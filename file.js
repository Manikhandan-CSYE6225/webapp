const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const { Metadata } = require("./models");
const db = require("./models");
const metrics = require('./metrics');
const { logger, logS3Operation, logDatabaseOperation } = require("./logger");

AWS.config.update({
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const upload = multer({ storage: multer.memoryStorage() });

// POST: Upload file
router.all("/file", upload.single("file"), async (req, res) => {
    const start = Date.now();
    logger.debug('File endpoint request received', {
        method: req.method,
        query: req.query,
        params: req.params,
        hasFile: !!req.file
    });

    try {
        await db.sequelize.authenticate();
        if (req.method === 'GET' || req.method === 'DELETE') {
            logger.warn('Invalid method for file upload endpoint', { method: req.method });
            res.status(400).end();
        }

        else if (req.method !== 'POST') {
            logger.warn('Method not allowed for file upload endpoint', { method: req.method });
            res.status(405).end();
        }

        else if (Object.keys(req.query).length > 0 || Object.keys(req.params).length > 0) {
            logger.warn('Invalid request parameters for file upload', {
                query: req.query,
                params: req.params
            });
            res.status(400).end();
        }

        else if (!req.is("multipart/form-data")) {
            logger.warn('Invalid content type for file upload', {
                contentType: req.get('Content-Type')
            });
            return res.status(400).end();
        }

        else if (!req.file) {
            logger.warn('No file provided in the request');
            res.status(400).end();
        }

        else {
            metrics.incrementApiCall("uploadFile");
            const fileId = uuidv4();
            const fileName = req.file.originalname;
            const uploadDate = new Date();
            const filePath = `${process.env.S3_BUCKET}/${fileId}/${fileId}-${fileName}`;

            logger.info('Processing file upload', {
                fileId,
                fileName,
                contentType: req.file.mimetype,
                fileSize: req.file.size
            });

            const params = {
                Bucket: process.env.S3_BUCKET,
                Key: `${fileId}/${fileId}-${fileName}`,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };

            try {
                const s3Start = Date.now();
                await s3.upload(params).promise();
                metrics.timingS3Call("upload", Date.now() - s3Start);

                logS3Operation('upload', params, true);
                logger.info('File successfully uploaded to S3', { fileId, fileName });
            } catch (s3Error) {
                logS3Operation('upload', params, false);
                logger.error('S3 upload failed', {
                    error: s3Error.message,
                    stack: s3Error.stack,
                    fileId
                });
                throw s3Error;
            }

            const headParams = {
                Bucket: process.env.S3_BUCKET,
                Key: `${fileId}/${fileId}-${fileName}`
            };

            let s3Metadata;
            try {
                const headStart = Date.now();
                s3Metadata = await s3.headObject(headParams).promise();
                metrics.timingS3Call("headObject", Date.now() - headStart);

                logS3Operation('headObject', headParams, true);
                logger.debug('Retrieved S3 object metadata', {
                    fileId,
                    contentType: s3Metadata.ContentType,
                    contentLength: s3Metadata.ContentLength
                });
            } catch (headError) {
                logS3Operation('headObject', headParams, false);
                logger.error('Failed to retrieve S3 object metadata', {
                    error: headError.message,
                    stack: headError.stack,
                    fileId
                });
                throw headError;
            }

            try {
                const dbStart = Date.now();
                await Metadata.create({
                    id: fileId,
                    file_name: fileName,
                    url: filePath,
                    upload_date: uploadDate,
                    content_type: s3Metadata.ContentType,
                    content_length: s3Metadata.ContentLength,
                    etag: s3Metadata.ETag,
                    last_modified: s3Metadata.LastModified,
                    server_side_encryption: s3Metadata.ServerSideEncryption,
                    replication_status: s3Metadata.ReplicationStatus,
                    storage_class: s3Metadata.StorageClass
                });
                metrics.timingDbQuery("insertMetadata", Date.now() - dbStart);
                logDatabaseOperation('create', 'Metadata', fileId, true);

                logger.info('File metadata saved to database', { fileId, fileName });
            } catch (dbError) {
                logDatabaseOperation('create', 'Metadata', fileId, false);
                logger.error('Failed to save file metadata to database', {
                    error: dbError.message,
                    stack: dbError.stack,
                    fileId
                });
                throw dbError;
            }

            const fileMetadata = {
                id: fileId,
                file_name: fileName,
                url: filePath,
                upload_date: uploadDate.toISOString().split('T')[0],
            };

            metrics.timingApiCall("uploadFile", Date.now() - start);
            logger.info('File upload completed successfully', { fileId, fileName });
            res.status(201).json(fileMetadata);
        }

    } catch (error) {
        logger.error("Upload error:", {
            error: error.message,
            stack: error.stack,
            code: error.code
        });

        if (error.code === "CredentialsError" ||
            error.code === "AccessDenied" ||
            error.code === "InvalidAccessKeyId" ||
            error.code === "SignatureDoesNotMatch") {
            logger.error('AWS authentication error', {
                errorCode: error.code,
                message: error.message
            });
            res.status(401).end();
        }
        else {
            logger.error('Unexpected service error', {
                error: error.message,
                stack: error.stack
            });
            res.status(503).end();
        }
    }
});

router.all("/file/:id", async (req, res) => {
    const start = Date.now();
    const { id } = req.params;
    logger.debug('File by ID endpoint request received', {
        method: req.method,
        id,
        query: req.query
    });

    try {
        await db.sequelize.authenticate();
        let file;
        let fetchTime;
        try {
            const dbStart = Date.now();
            file = await Metadata.findByPk(req.params.id, {
                attributes: ["id", "file_name", "url", "upload_date"]
            });
            fetchTime = Date.now() - dbStart;
            logDatabaseOperation('findByPk', 'Metadata', id, !!file);
            logger.debug('Database query result', {
                id,
                found: !!file
            });
        } catch (dbError) {
            logDatabaseOperation('findByPk', 'Metadata', id, false);
            logger.error('Database query failed', {
                error: dbError.message,
                stack: dbError.stack,
                id
            });
            throw dbError;
        }

        if (req.method !== 'GET' && req.method !== 'DELETE') {
            logger.warn('Method not allowed for file by ID endpoint', {
                method: req.method,
                id
            });
            res.status(405).end();
        }

        else if (Object.keys(req.query).length > 0) {
            logger.warn('Invalid query parameters for file by ID', {
                query: req.query,
                id
            });
            res.status(400).end();
        }

        else if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 0) {
            logger.warn('Invalid content length for file by ID request', {
                contentLength: req.headers['content-length'],
                id
            });
            res.status(400).end();
        }

        else if (!file) {
            logger.warn('File not found', { id });
            res.status(404).end();
        }

        else if (req.method === 'GET') {
            metrics.incrementApiCall("getFile");
            metrics.timingDbQuery("fetchMetadata", Date.now() - fetchTime);
            metrics.timingApiCall("getFile", Date.now() - start);
            logger.info('File retrieved successfully', { id, fileName: file.file_name });
            res.status(200).json(file);
        }

        else {
            metrics.incrementApiCall("getFile");
            logger.info('Processing file deletion request', { id, fileName: file.file_name });
            const params = {
                Bucket: process.env.S3_BUCKET,
                Key: file.url.replace(`${process.env.S3_BUCKET}/`, ""),
            };

            try {
                const s3Delete = Date.now();
                await s3.deleteObject(params).promise();
                metrics.timingS3Call("delete", Date.now() - s3Delete);

                logS3Operation('deleteObject', params, true);
                logger.info('File deleted from S3', { id, fileName: file.file_name });
            } catch (s3Error) {
                logS3Operation('deleteObject', params, false);
                logger.error('Failed to delete file from S3', {
                    error: s3Error.message,
                    stack: s3Error.stack,
                    id
                });
                throw s3Error;
            }

            try {
                const dbDelete = Date.now();
                await file.destroy();
                metrics.timingDbQuery("deleteMetadata", Date.now() - dbDelete);

                metrics.timingApiCall("deleteFile", Date.now() - start);
                logDatabaseOperation('destroy', 'Metadata', id, true);
            } catch (dbError) {
                logDatabaseOperation('destroy', 'Metadata', id, false);
                logger.error('Failed to delete file metadata from database', {
                    error: dbError.message,
                    stack: dbError.stack,
                    id
                });
                throw dbError;
            }


            logger.info('File deleted successfully', { id });
            res.status(204);
            res.end();
        }
    } catch (error) {
        logger.error("Get/delete file error:", {
            error: error.message,
            stack: error.stack,
            code: error.code,
            id
        });

        if (error.code === "CredentialsError" ||
            error.code === "AccessDenied" ||
            error.code === "InvalidAccessKeyId" ||
            error.code === "SignatureDoesNotMatch") {
            logger.error('AWS authentication error', {
                errorCode: error.code,
                message: error.message,
                id
            });
            res.status(401).end();
        }
        else {
            logger.error('Unexpected service error', {
                error: error.message,
                stack: error.stack,
                id
            });
            res.status(503).end();
        }
    }
});

module.exports = router;
