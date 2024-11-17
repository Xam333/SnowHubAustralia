/* Require dependencies */
const express = require('express');
const fs = require('fs');
require('dotenv').config();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const router = express.Router();

/* AWS SDK configuration */
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const queueUrl = process.env.SQS_VIDEO_SERVICE_URL; // SQS URL
const bucketName = process.env.S3_VIDEOS_BUCKET_NAME; // S3 bucket name

// Multer upload setup
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 300 * 1024 * 1024, // 300MB limit
    },
});

// Post video endpoint
router.post('/', upload.single('video'), async (req, res) => {
    console.log('Received upload request.');

    // Check if file exists
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('A video file is required.');
    }

    // Get / create video info
    const videoId = uuidv4(); // Generate video ID
    const inputPath = req.file.path; // Path to uploaded video
    const { videoTitle, locationName, userName } = req.body;
    const uploadDate = new Date().toISOString(); // Get date

    // Check title
    if (!videoTitle) {
        console.error('Video title missing');
        return res.status(400).send('A video title is required.');
    }

    // Check username
    if (!userName) {
        console.error('Username missing');
        return res.status(400).send('Must be logged in to upload.');
    }

    // Define S3 file location
    const s3FileName = `uploads/${req.file.originalname}`;

    // Upload raw video file to S3
    try {
        const s3Params = {
            Bucket: bucketName,
            Key: s3FileName,
            Body: fs.createReadStream(inputPath), // Read the file from the filesystem
        };
        await s3Client.send(new PutObjectCommand(s3Params));
    } catch (err) {
        console.error('Error uploading raw video to S3:', err);
        return res.status(500).json({ error: 'Failed to upload video to S3' });
    }

    // Create metadata object
    const metadata = {
        qutUsername: process.env.QUT_USERNAME,
        videoId,
        videoTitle,
        locationName,
        uploadDate,
        userName,
    };

    // Send SQS message with videoId, S3 file location, and metadata
    try {
        const sqsMessage = {
            videoId,
            s3FileLocation: s3FileName, // Use the correct variable name here
            metadata,
        };

        const sqsParams = {
            QueueUrl: queueUrl, // Use the correct variable name here
            MessageBody: JSON.stringify(sqsMessage),
        };

        await sqsClient.send(new SendMessageCommand(sqsParams));
    } catch (err) {
        console.error('Error sending message to SQS:', err);
        return res.status(500).json({ error: 'Failed to send message to SQS' });
    }

    // Send back video ID
    res.json({ videoId });
});

module.exports = router;