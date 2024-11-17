const Cognito = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require("aws-jwt-verify");
const jsonwebtoken = require('jsonwebtoken');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

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

// Check authentication middleware
const checkAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided, user is not signed in' });
        }

        // Verify Access Token
        const verifiedToken = await accessVerifier.verify(token);
        req.user = verifiedToken;

        // Decode the token to get the username
        try {
            const decoded = jsonwebtoken.decode(token);
            req.user.username = decoded?.username || 'Unknown'; // Attach username to req.user
        } catch (error) {
            console.error('Error decoding access token:', error.message);
            req.user.username = 'Unknown';
        }

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token', error: err.message });
    }
};

module.exports = checkAuth;