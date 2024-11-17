/* Require dependencies */
const express = require('express');
require('dotenv').config();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const S3Presigner = require("@aws-sdk/s3-request-presigner");


const router = express.Router();

/* AWS SDK configuration */
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const bucketName = process.env.S3_VIDEOS_BUCKET_NAME; // S3 bucket name

const tableName = process.env.VIDEO_METADATA_TABLE;
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sortKey = 'videoId';

const qutUsername = process.env.QUT_USERNAME;

// Get videos metadata endpoint
router.get('/metadata', async (req, res) => {
    const sortBy = req.query.sort || 'date';
    
    try {
        // Fetch all video metadata from DynamoDB
        const data = await docClient.send(new ScanCommand({
            TableName: tableName
        }));

        let metadata = data.Items;

        if (metadata.length === 0) {
            return res.status(404).json({ error: 'No video metadata available' });
        }

        // Exclude the URL fields
        const filteredMetadata = metadata.map(video => {
            const { lowQualityMP4, highQualityMP4, lowQualityWEBM, highQualityWEBM, ...filteredVideo } = video;
            return filteredVideo;
        });

        // Sort the metadata based on the query parameter
        filteredMetadata.sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.uploadDate) - new Date(a.uploadDate);
            } else if (sortBy === 'username') {
                return a.userName.localeCompare(b.userName);
            } else if (sortBy === 'location') {
                return a.locationName.localeCompare(b.locationName);
            } else if (sortBy === 'title') {
                return a.videoTitle.localeCompare(b.videoTitle);
            } else {
                return 0;
            }
        });

        res.json(filteredMetadata);
    } catch (err) {
        console.error('Failed to fetch or sort video metadata:', err);
        res.status(500).json({ error: 'Failed to fetch or sort video metadata' });
    }
});

// Get video URL endpoint
router.get('/:fileName', async (req, res) => {
    const { fileName } = req.params;

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileName,
        });

        const downloadUrl = await S3Presigner.getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({ downloadUrl });
    } catch (err) {
        console.error('Error generating presigned URL:', err);
        res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
});

// Delete video endpoint
router.delete('/:videoId/:userName', async (req, res) => {
    const { videoId, userName } = req.params;

    try {
        // Get metedata of video from dynamoDB
        const getCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: "videoId = :videoId",
            ExpressionAttributeValues: {
                ":videoId": videoId
            }
        });

        const data = await docClient.send(getCommand);

        if (data.Items.length === 0) {
            return res.status(404).json({ message: 'Video not found' });
        }

        const video = data.Items[0];

        // Check usernames or admin
        if (video["userName"] !== userName && userName !== 'admin' ) {
            return res.status(403).json({ message: 'Unauthorised to delete this video' });
        }

        // Remove files from S3 bucket
        const deleteFilePromises = [
            s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: `${videoId}_high.mp4` })),
            s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: `${videoId}_low.mp4` })),
            s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: `${videoId}_high.webm` })),
            s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: `${videoId}_low.webm` }))
        ];
        await Promise.all(deleteFilePromises);

        // Remove metadata from DynamoDB
        const deleteCommand = new DeleteCommand({
            TableName: tableName,
            Key: {
                'qut-username': qutUsername,
                [sortKey]: videoId
            }
        });
        await docClient.send(deleteCommand);

        // Return
        res.status(200).json({ message: 'Video deleted successfully' });
    } catch (err) {
        console.error('Error deleting video:', err);
        res.status(500).json({ message: 'Failed to delete video', error: err.message });
    }
});

module.exports = router;