/* Require dependencies */ 
const express = require('express');
const fs = require('fs');
require('dotenv').config();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const {SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

const app = express();
const PORT = process.env.TRANSCODER_PORT || 5002;

app.use(cors());

/* Configure AWS */ 
const qutUsername = process.env.QUT_USERNAME
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const queueUrl = process.env.SQS_VIDEO_SERVICE_URL;       // SQS URL
const bucketName = process.env.S3_VIDEOS_BUCKET_NAME;   // S3 bucket name

// DynamoDB
const metadataTable = process.env.VIDEO_METADATA_TABLE;
const progressTable = process.env.VIDEO_PROGRESS_TABLE;


// Polling SQS Function
const pollSQS = async () => {
    // SQS parameters
    const params = {
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20 // Long polling
    };

    try {
        // Get messages from SQS
        const data = await sqsClient.send(new ReceiveMessageCommand(params));

        // If there is a message
        if (data.Messages) {
            // Iterate through messages (should only be 1 anyway)
            for (const message of data.Messages) {
                const { videoId, s3FileLocation, metadata } = JSON.parse(message.Body);
                console.log(`Received processing request for videoId: ${videoId}`);

                // Delete message from queue
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: message.ReceiptHandle
                }));
                console.log(`Message for videoId ${videoId} deleted from queue`); 

                try {
                    // Process the video
                    await processVideo(videoId, s3FileLocation, metadata);
                } catch (error) {
                    console.error(`Error processing videoId ${videoId}:`, error);

                    // Add message back into queue
                    await sqsClient.send(new SendMessageCommand({
                        QueueUrl: queueUrl,
                        MessageBody: JSON.stringify({
                            videoId,
                            s3FileLocation,
                            metadata
                        })
                    })); 

                    console.log(`Re-queued message for videoId ${{videoId}}`);
                }
            }
        }
    } catch (error) {
        console.error('Error polling SQS:', error);
    }
};

// Process Video Function
const processVideo = async (videoId, s3FileName, metadata) => {
    try {
        // Define temporary input and output paths
        const tempInputPath = `/tmp/${videoId}-input.mp4`; // Temporary path for the raw video
        const outputDir = `/tmp/transcoded/${videoId}`;   // Directory for transcoded files

        // Step 1: Download the raw video from S3
        await downloadFromS3(s3FileName, tempInputPath);

        // Step 2: Define output file names and transcoding parameters
        const transcodingParams = [
            { size: '1280x720', codec: 'libx264', ext: 'mp4', outputFileName: `${videoId}_high.mp4`, task: 'highMP4' },
            { size: '640x360', codec: 'libx264', ext: 'mp4', outputFileName: `${videoId}_low.mp4`, task: 'lowMP4' },
            { size: '1280x720', codec: 'libvpx', ext: 'webm', outputFileName: `${videoId}_high.webm`, task: 'highWEBM' },
            { size: '640x360', codec: 'libvpx', ext: 'webm', outputFileName: `${videoId}_low.webm`, task: 'lowWEBM' },
        ];

        // Step 3: Transcode all videos
        const transcodePromises = transcodingParams.map(({ size, codec, outputFileName, task}) => {
            return transcodeVideo(tempInputPath, outputDir, size, codec, outputFileName, videoId, task);
        });

        // Wait for all transcoding to complete
        await Promise.all(transcodePromises);
        console.log('All videos transcoded successfully.');

        // Step 4: Upload all videos to S3
        const uploadPromises = transcodingParams.map(({ outputFileName, task }) => {
            return uploadToS3(path.join(outputDir, outputFileName), outputFileName, videoId, task);
        });

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
        console.log('All videos uploaded successfully.');

        // Step 5: Upload metadata
        await addMetadataToDynamoDB(metadata);

        // Step 6: Delete raw video file
        await deleteFromS3(s3FileName);

        fs.unlinkSync(tempInputPath);
        fs.rmSync(outputDir, { recursive: true });

    } catch (error) {
        console.error(`Error processing videoId ${videoId}:`, error);

    }
};

// Download from S3 Function
const downloadFromS3 = async (s3FileName, outputPath) => {
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3FileName,
    });

    const { Body } = await s3Client.send(command);
    const writeStream = fs.createWriteStream(outputPath);
    Body.pipe(writeStream);

    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
};

// Delete from S3 Function
const deleteFromS3 = async (s3FileName) => {
    const params = {
        Bucket: bucketName,
        Key: s3FileName,
    };

    try {
        await s3Client.send(new DeleteObjectCommand(params));
        console.log(`Successfully deleted original file ${s3FileName} from S3`);
    } catch (error) {
        console.error(`Error deleting file ${s3FileName} from S3:`, error);
    }
};

// Transcode Video Function
const transcodeVideo = (inputPath, outputDir, size, codec, outputFileName, videoId, task) => {
    return new Promise((resolve, reject) => {
        // Create output directory
        fs.mkdirSync(outputDir, { recursive: true });

        let lastReportedProgress = 0; // Variable to track the last reported progress

        // Use ffmpeg to transcode video
        ffmpeg(inputPath)
            .output(path.join(outputDir, outputFileName))
            .videoCodec(codec)
            .size(size)
            .on('progress', (progress) => {
                // Update progress
                const currentProgress = progress.percent;

                // Check if the current progress has reached a new 20% threshold
                if (Math.floor(currentProgress / 20) > Math.floor(lastReportedProgress / 20)) {
                    // Update progress and store the current progress
                    updateProgress(videoId, `${task}TranscodingProgress`, currentProgress);
                    lastReportedProgress = currentProgress; // Update the last reported progress
                }
            }) 
            .on('end', () => {
                console.log(`${outputFileName} Created`);
                // Update progress to 100
                updateProgress(videoId, `${task}TranscodingProgress`, 100);
                resolve(outputFileName);
            })
            .on('error', (err) => {
                console.error(`Error during transcoding ${outputFileName}:`, err);
                reject(err);
            })
            .run();
    });
};

// Upload To S3 Function
const uploadToS3 = async (filePath, fileName, videoId, task) => {
    try {
        const s3Params = {
            Bucket: bucketName,
            Key: fileName,
            Body: fs.createReadStream(filePath), // Read the file from the filesystem
        };

        await s3Client.send(new PutObjectCommand(s3Params));

        updateProgress(videoId, `${task}UploadProgress`, 100);

        console.log(`Successfully uploaded ${fileName} to S3`);

    } catch (err) {
        console.error('Error uploading raw video to S3:', err);
        throw err;
    }
};

// Upload Metadata to DynamoDB Function
const addMetadataToDynamoDB = async (metadata) => {
    const params = {
        TableName: metadataTable, // Change to your actual table name
        Item: {
            'qut-username': metadata.qutUsername,
            videoId: metadata.videoId,
            locationName: metadata.locationName,
            uploadDate: metadata.uploadDate,
            userName: metadata.userName,
            videoTitle: metadata.videoTitle,
        },
    };

    try {
        await dynamoClient.send(new PutCommand(params));
        console.log(`Metadata for videoId ${metadata.videoId} added to DynamoDB.`);
    } catch (error) {
        console.error(`Error adding metadata to DynamoDB:`, error);
    }
};

// Update Progress in DynamoDB Function
const updateProgress = async (videoId, progressType, progress) => {
    const params = {
        TableName: progressTable,        
        Key: {  // Correctly define the Key property
            "qut-username": qutUsername,
            "videoId": videoId // Use videoId directly instead of wrapping it in an object
        },
        UpdateExpression: `SET ${progressType} = :progress`,
        ExpressionAttributeValues: {
            ':progress': progress,
        },
    };

    try {
        await dynamoClient.send(new UpdateCommand(params));
        console.log(`Progress updated in DynamoDB for ${videoId}:\n${progressType} : ${progress}`);
    } catch (error) {
        console.error('Error updating progress in DynamoDB:', error);
    }
}


// Start polling function
const startPolling = async () => {
    console.log('Polling SQS For Video Processing Requests')
    while (true) {
        await pollSQS();
    }
};

app.get('/health', (req, res) => {
    console.log("Received Health Check Request");
    res.status(200).json({
        status: "Transcoding Service is Up and Running"
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startPolling().catch(err => console.error("Error starting SQS polling:", err));
});