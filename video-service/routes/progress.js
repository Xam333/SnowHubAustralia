/* Require dependencies */
const express = require('express');
require('dotenv').config();
const { DynamoDBClient, QueryCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const AWS = require('aws-sdk');

const router = express.Router();

const qutUsername = process.env.QUT_USERNAME;
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const progressTable = process.env.VIDEO_PROGRESS_TABLE;

// Get progress columns from dynamoDB function
async function getProgress(tableName, videoId) {
    const params = {
        TableName: tableName,
        KeyConditionExpression: "#qutUsername = :qutUsername AND videoId = :videoId",
        ExpressionAttributeNames: {
            "#qutUsername": "qut-username"
        },
        ExpressionAttributeValues: {
            ":qutUsername": { S: qutUsername },
            ":videoId": { S: videoId }
        }
    };

    try {
        const command = new QueryCommand(params);
        const result = await dynamoClient.send(command);

        // Return the first item if it exists
        if (result.Items && result.Items.length > 0) {
            return AWS.DynamoDB.Converter.unmarshall(result.Items[0]);
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error retrieving video progress:", error);
        throw new Error("Failed to retrieve video progress data");
    }
}

// Get progress endpoint
router.get('/:id', async (req, res) => {
    // Get id from parameters
    const { id: videoId } = req.params;

    try {
        // Search database for video progress
        const progressData = await getProgress(progressTable, videoId);

        // If no data found
        if (!progressData) {
            return res.status(404).json({ error: 'No progress data found for this ID' });
        }

        // Extract the progress values with defaulting to 0 if they are undefined
        const {
            highMP4TranscodingProgress = 0,
            lowMP4TranscodingProgress = 0,
            highWEBMTranscodingProgress = 0,
            lowWEBMTranscodingProgress = 0,
            highMP4UploadProgress = 0,
            lowMP4UploadProgress = 0,
            highWEBMUploadProgress = 0,
            lowWEBMUploadProgress = 0,
        } = progressData;

        // Check values of transcoding:
        const totalTranscodeProgress = highMP4TranscodingProgress + lowMP4TranscodingProgress + highWEBMTranscodingProgress + lowWEBMTranscodingProgress;
        
        if (totalTranscodeProgress < 400) {
            // Average progress
            const averageTranscodeProgress = totalTranscodeProgress / 4;

            // Respond with transcoding progress
            return res.status(200).json(
                {
                    progress: averageTranscodeProgress,
                    stage: 'transcoding'
                }
            );
        };

        // Check values of uploading:
        const totalUploadProgress = highMP4UploadProgress + lowMP4UploadProgress + highWEBMUploadProgress + lowWEBMUploadProgress;

        if (totalUploadProgress < 400) {
            // Average progress
            const averageUploadProgress = totalUploadProgress / 4;

            // Respond with upload progress
            return res.status(200).json(
                {
                    progress: averageUploadProgress,
                    stage: 'uploading'
                }
            );
        }

        if (totalTranscodeProgress === 400 && totalUploadProgress === 400) {
            // Return done message
            res.status(200).json({
                progress: 100,
                stage: 'done'
            });

            // Delete video from table
            const deleteParams = {
                TableName: progressTable,
                Key: {
                    "qut-username": { S: qutUsername },
                    "videoId": { S: videoId }
                }
            };
            await dynamoClient.send(new DeleteItemCommand(deleteParams));

            return;
        }
    } catch (error) {
        console.error('Error getting progress data:', error);
        res.status(500).json({ error: 'Failed to retrieve progress data' });
    };
});

module.exports = router;