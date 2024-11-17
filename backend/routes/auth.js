const express = require('express');
const router = express.Router();
const Cognito = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require("aws-jwt-verify");
const jsonwebtoken = require('jsonwebtoken');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const checkAuth = require('../middleware/checkAuth');
const checkAdmin = require('../middleware/checkAdmin');

// Cognito details:
//const clientId = process.env.COGNITO_CLIENT_ID;        // Client ID From AWS
//const userPoolId = process.env.COGNITO_USER_POOL_ID;    // User Pool ID From AWS

// Secrets manager client
const secretsManagerClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Function to retrieve secrets
async function getCognitoSecrets() {
    try {
        const command = new GetSecretValueCommand({
            SecretId: process.env.AWS_SECRET_NAME
        });
        const secretResponse = await secretsManagerClient.send(command);

        // Parse secret value
        const secrets = JSON.parse(secretResponse.SecretString);

        return {
            clientId: secrets.COGNITO_CLIENT_ID,
            userPoolId: secrets.COGNITO_USER_POOL_ID
        };
    } catch (err) {
        console.error("Error retrieving Cognito secrets:", err);
    }
};

let client;
let accessVerifier;
let idVerifier;
let clientId;
let userPoolId;

(async () => {
    try {
        const cognitoSecrets = await getCognitoSecrets();
        clientId = cognitoSecrets.clientId;
        userPoolId = cognitoSecrets.userPoolId;

        client = new Cognito.CognitoIdentityProviderClient({ region: process.env.AWS_REGION });

        // JWT Verifiers
        accessVerifier = jwt.CognitoJwtVerifier.create({
            userPoolId: userPoolId,
            tokenUse: "access",
            clientId: clientId
        });

        idVerifier = jwt.CognitoJwtVerifier.create({
            userPoolId: userPoolId,
            tokenUse: "id",
            clientId: clientId
        });

        console.log('Cognito Client and Verifiers initialized');
    } catch (error) {
        console.error('Error during Cognito initialization:', error);
    }
})();



// Signup POST endpoint
router.post('/signup', async (req, res) => {
    try {
        // Get body parameters
        const { username, email, password } = req.body;

        // Create cognito command
        const command = new Cognito.SignUpCommand({
            ClientId: clientId,
            Username: username,
            Password: password,
            UserAttributes: [{ Name: "email", Value: email }],
        });
        
        // Send command
        const response = await client.send(command);

        // Send back Cognito response
        res.status(201).json({
            message: 'User signed up successfully!',
            data: response
        });

    } catch (error) {
        res.status(500).json({ message: 'Error signing up user', error: error.message });
    }
});

// Confirm POST endpoint
router.post('/confirm', async (req, res) => {
    try {
        // Get body parameters
        const { username, confirmationCode } = req.body;

        // Create cognito command
        const command = new Cognito.ConfirmSignUpCommand({
            ClientId: clientId,
            Username: username,
            ConfirmationCode: confirmationCode
        });

        const response = await client.send(command);
        
        // Send back Cognito response
        res.status(201).json({
            message: 'User verified successfully!',
            data: response
        });

    } catch (error) {
        res.status(500).json({ message: 'Error verifying user', error: error.message });
    }
});

// Signin POST endpoint
router.post('/signin', async (req, res) => {
    try {
        // Get body parameters
        const { username, password } = req.body;

        // Initialise auth command
        const command = new Cognito.InitiateAuthCommand({
            AuthFlow: Cognito.AuthFlowType.USER_PASSWORD_AUTH,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password
            },
            ClientId: clientId
        });

        // Send command to Cognito
        const response = await client.send(command);

        // Verify and extract tokens
        const accessToken = await accessVerifier.verify(
            response.AuthenticationResult.AccessToken
        );
        const idToken = await idVerifier.verify(
            response.AuthenticationResult.IdToken
        );

        console.log(response);

        // Send tokens back to client
        res.status(200).json({
            message: 'User signed in successfully!',
            accessToken: response.AuthenticationResult.AccessToken,
            idToken: response.AuthenticationResult.IdToken
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Error signing in user', error: error.message });
    }
});

// Check authentication GET endpoint
router.get('/signed-in', checkAuth, (req, res) => {
    res.status(200).json({
        isLoggedIn: true,
        username: req.user.username
    });
});

// Check admin GET endpoint
router.get('/check-admin', checkAuth, checkAdmin, (req, res) => {
    res.status(200).json({ isAdmin: true });
});

module.exports = router;