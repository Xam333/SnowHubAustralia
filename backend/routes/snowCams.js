const express = require('express');
const fs = require('fs');
const path = require('path');
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const checkAuth = require('../middleware/checkAuth');
const checkAdmin = require('../middleware/checkAdmin');

const router = express.Router();

// DynamoDB Info
const qutUsername = process.env.QUT_USERNAME;
const tableName = "n11078472-snow-cams";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const sortKey = 'youtubeLink';

// Function to create DynamoDB table
async function createTable() {
    try {
        // Check if table already exists
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        await client.send(describeCommand);
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

            const response = await client.send(createCommand);
            console.log('Table created successfully: ', response);
        } else {
            console.error('Faled to check / create table:', err);
        }
    }
};

// Call create table function
createTable();

// GET endpoint to retrieve YouTube links and locations
router.get('/', async (req, res) => {
    try {
        const scanCommand = new ScanCommand({
            TableName: tableName
        });

        const data = await docClient.send(scanCommand);
        res.json(data.Items);
    } catch (err) {
        console.error('Failed to retrieve data from DynamoDB:', err);
        res.status(500).json({ error: 'Failed to retrieve data from DynamoDB' });
    }
});

// POST endpoint to add a new YouTube link with location
router.put('/', checkAuth, checkAdmin, async (req, res) => {
    const { link, location } = req.body;

    if (!link || !location) {
        return res.status(400).json({ error: 'YouTube link and location name are required' });
    }

    try {
        const putCommand = new PutCommand({
            TableName: tableName,
            Item: {
                "qut-username": qutUsername,
                [sortKey]: link,
                "location": location
            }
        });

        const response = await docClient.send(putCommand);
        res.status(201).json({ message: 'Youtube link added successfully' });
    } catch (err) {
        console.error('Failed to save Youtube link:', err);
        res.status(500).json({ error: 'Failed to save Youtube link' });
    }
});

// DELETE endpoint to remove a YouTube link
router.delete('/:link', checkAuth, checkAdmin, async (req, res) => {
    const { link } = req.params;

    try {
        const deleteCommand = new DeleteCommand({
            TableName: tableName,
            Key: {
                "qut-username": qutUsername,
                "youtubeLink": link
            }
        });

        const response = await docClient.send(deleteCommand);
        res.json({ message: 'Youtube link removed successfully' });
    } catch (err) {
        console.error('Failed to remove Youtube link:', err);
        res.status(500).json({ error: 'Failed to remove Youtube link' });
    }
});

module.exports = router;
