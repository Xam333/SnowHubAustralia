const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

const snowCamsRoutes = require('./routes/snowCams');
const weatherLocationsRoutes = require('./routes/weatherLocations');
const authRoutes = require('./routes/auth');

// Parse incoming JSON data
app.use(express.json());

app.use(cors());

// Use the external routes
app.use('/snow-cams', snowCamsRoutes);
app.use('/weather-locations', weatherLocationsRoutes);
app.use('/auth', authRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    console.log("Received Health Check Request");
    res.status(200).json({
        status: "Backend API is Up and Running"
    });
});

app.listen(PORT, () => console.log(`Server Running on Port ${PORT}`));
