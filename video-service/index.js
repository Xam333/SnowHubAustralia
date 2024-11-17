/* Require dependencies */
const express = require('express');
const fs = require('fs');
require('dotenv').config();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const cors = require('cors');

const app = express();
const PORT = process.env.VIDEOS_PORT || 5001;


// Middleware to parse JSON
app.use(express.json());

app.use(cors());

app.get('/health', (req, res) => {
    console.log("Received Health Check Request");
    res.status(200).json({
        status: "Video Service is Up and Running"
    });
});

// Routes
const tablesRoute = require('./routes/tables');
app.use('/', tablesRoute);
const uploadRoute = require('./routes/upload');
app.use('/upload', uploadRoute);
const progressRoute = require('./routes/progress');
app.use('/progress', progressRoute);
const videosRoute = require('./routes/videos');
app.use('/videos', videosRoute);

// Start the express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

