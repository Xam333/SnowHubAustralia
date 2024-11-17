const express = require('express');
const fs = require('fs');
const path = require('path');
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const Memcached = require('memcached');
const util = require('util');

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const router = express.Router();

const checkAuth = require('../middleware/checkAuth');
const checkAdmin = require('../middleware/checkAdmin');

// Secrets manager client
const secretsManagerClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

let apiKey;

// Function to retrieve API key from secrets manager
async function getAPISecret() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: process.env.AWS_SECRET_NAME
        });
        const secretResponse = await secretsManagerClient.send(command);

        // Parse secret value
        const secrets = JSON.parse(secretResponse.SecretString);

        return secrets.WEATHER_API_KEY;
    } catch (err) {
        console.error("Error retrieving weather API secret:", err);
    }
}

(async () => {
    try {
        // Retrieve the API key when starting the server
        apiKey = await getAPISecret();
        console.log('Weather API Key retrieved successfully.');

        // Call create table function
        await createTable(); // Ensure this is awaited if it depends on the API key

    } catch (err) {
        console.error('Error during initialization:', err);
    }
})();

// SSM client
const ssmClient = new SSMClient({ region: process.env.AWS_REGION });

async function getParameter(name) {
    const command = new GetParameterCommand({
        Name: name,
        WithDecryption: false // Set to true if the parameter is a SecureString
    });
    const response = await ssmClient.send(command);
    return response.Parameter.Value;
};

let weatherURL;
let memcachedAddress;

(async () => {
    try {
        // Retrieve parameters
        weatherURL = await getParameter('/n11078472/snow-hub-parameters/WEATHER_API_URL');
        memcachedAddress = await getParameter('/n11078472/snow-hub-parameters/MEMCACHED_ENDPOINT');

        console.log("Retrieved parameters from parameter store");

    } catch (err) {
        console.error('Error during initialization:', err);
    }
})();

// DynamoDB Info
const qutUsername = process.env.QUT_USERNAME;
const tableName = "n11078472-weather-locations";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);
const sortKey = 'locationName';

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

// GET endpoint to retrieve ski resorts and their locations
router.get('/', async (req, res) => {
    try {
        const scanCommand = new ScanCommand({
            TableName: tableName
        });

        const data = await docClient.send(scanCommand);
        res.json(data.Items);
    } catch (err) {
        console.error('Failed to retireve data from DynamoDB', err);
        res.status(500).json({ error: 'Failed to retireve data from DynamoDB' });
    }
});

// POST endpoint to add a new ski resort
router.put('/', checkAuth, checkAdmin, async (req, res) => {
    const { name, latitude, longitude } = req.body;

    if (!name || !latitude || !longitude) {
        return res.status(400).json({ error: 'Resort name, latitude, and longitude are required' });
    }

    try {
        const putCommand = new PutCommand({
            TableName: tableName,
            Item: {
                "qut-username": qutUsername,
                [sortKey]: name,
                "latitude": latitude,
                "longitude": longitude
            }
        });

        const response = await docClient.send(putCommand);
        res.status(201).json({ message: 'Weather location successfully added'});
    } catch (err) {
        console.error('Failed to save weather location:', err);
        res.status(500).json({ error: 'Failed to save weather location' });
    }
});

// DELETE endpoint to remove a ski resort
router.delete('/:name', checkAuth, checkAdmin, async (req, res) => {
    const { name } = req.params;

    try {
        const deleteCommand = new DeleteCommand({
            TableName: tableName,
            Key: {
                "qut-username": qutUsername,
                "locationName": name
            }
        });

        const response = await docClient.send(deleteCommand);
        res.json({ message: 'Weather location removed successfully' });
    } catch (err) {
        console.error('Failed to remove weather location:', err);
        res.json(500).json({ error: 'Failed to remove weather location' });
    }
});



// Function for fetching weather data with caching
async function weatherFetch(locationName, latitude, longitude) {
    try {
        // Fetch weather data from API
        const apiResponse = await fetch(`${weatherURL}?q=${latitude},${longitude}&days=3&key=${apiKey}`);
        if (!apiResponse.ok) {
            throw new Error(`API response error: ${apiResponse.statusText}`);
        }
        const weatherData = await apiResponse.json();

        return weatherData;
    } catch (err) {
        console.error('Failed to fetch weather data:', err);
        throw err; // Optionally rethrow the error to handle it further up the chain
    }
}


// GET endpoint to retrieve weather data for a ski resort
router.get('/forecast/:name', async (req, res) => {
    const { name } = req.params;

    console.log('Received forecast request for ', name);

    try {
        // Fetch the resort location from DynamoDB
        const scanCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: "locationName = :name",
            ExpressionAttributeValues: { ":name": name }
        });
        const data = await docClient.send(scanCommand);

        if (data.Items.length === 0) {
            return res.status(404).json({ error: "Location not found" });
        }

        const location = data.Items[0];
        const { latitude, longitude } = location;

        // Fetch weather data using the caching helper function
        const weatherData = await weatherFetch(name, latitude, longitude);

        // Return the weather data
        res.json(weatherData);
    } catch (err) {
        console.error('Failed to retrieve weather data:', err);
        res.status(500).json({ error: 'Failed to retrieve weather data' });
    }
});

module.exports = router;
