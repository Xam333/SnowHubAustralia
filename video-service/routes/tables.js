/* Require dependencies */
const express = require('express');
require('dotenv').config();
const AWS = require('aws-sdk');
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");


const router = express.Router();

/* AWS SDK configuration */
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

/* Setup DynamoDB Tables */
// Create table function
async function createTable(tableName, sortKey) {
    try {
        // Check if table already exists
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        await dynamoClient.send(describeCommand);
        console.log(`Table ${tableName} already exists.`);
    } catch (err) {
        // If doesn't exist
        if (err.name === 'ResourceNotFoundException') {
            const createCommand = new CreateTableCommand({
                TableName: tableName,
                AttributeDefinitions: [
                    {
                        AttributeName: "qut-username",
                        AttributeType: "S",
                    },
                    {
                        AttributeName: sortKey,
                        AttributeType: "S",
                    }
                ],
                KeySchema: [
                    {
                        AttributeName: "qut-username",
                        KeyType: "HASH",
                    },
                    {
                        AttributeName: sortKey,
                        KeyType: "RANGE",
                    }
                ],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 1
                }
            });

            const response = await dynamoClient.send(createCommand);
            console.log(`Table ${tableName} created successfully:`);
        } else {
            console.error('Faled to check / create table:', err);
        }
    }
};

// Call create table function
const metadataTable = process.env.VIDEO_METADATA_TABLE;
const progressTable = process.env.VIDEO_PROGRESS_TABLE;
createTable(metadataTable, 'videoId');
createTable(progressTable, 'videoId');

module.exports = router;