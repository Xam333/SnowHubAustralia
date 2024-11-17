// Import react functions
import React, { useState, useEffect } from 'react';

import { jwtDecode } from 'jwt-decode';

// Import stylesheet
import './VideoUpload.css';

// Setup backend url
const VIDEOS_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_VIDEOS_PORT}`;

// Setup delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Progress bar mini component
const renderProgressBar = (progress) => (
    <div className="progress-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        <div className="progress-text">{progress}%</div>
    </div>
);

// Main video upload function
export default function VideoUpload() {
    // Setup useStates
    const [file, setFile] = useState(null);
    const [videoTitle, setVideoTitle] = useState('');
    const [locationName, setLocationName] = useState('');

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleTitleChange = (e) => {
        setVideoTitle(e.target.value);
    };

    const handleLocationChange = (e) => {
        setLocationName(e.target.value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const token = localStorage.getItem('accessToken');
        const decoded = jwtDecode(token);
        const userName = decoded?.username;
        console.log('Logged In Username:', userName);

        const formData = new FormData();
        formData.append('video', file);
        formData.append('videoTitle', videoTitle);
        formData.append('locationName', locationName);
        formData.append('userName', userName);

        setIsUploading(true);

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 20);
                setUploadProgress(progress);
                setStatusMessage('Uploading...');
            }
        });

        xhr.addEventListener('readystatechange', () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    // Successful response
                    try {
                        const response = JSON.parse(xhr.responseText);
                        setStatusMessage('Allocating Resources...');
                        delay(3000);    // Wait 3 seconds
                        startTranscodingProgressPolling(response.videoId); // Start polling for transcoding progress
                    } catch (error) {
                        console.error('Error parsing response:', error);
                        setStatusMessage('Error processing response');
                    }
                } else {
                    // Handle errors
                    setStatusMessage(`Error ${xhr.status}: ${xhr.statusText}`);
                }
            }
        });

        xhr.upload.addEventListener('error', () => {
            setStatusMessage('Upload failed');
        });

        xhr.upload.addEventListener('abort', () => {
            setStatusMessage('Upload aborted');
        });

        xhr.open('POST', `${VIDEOS_URL}/upload`, true);
        xhr.send(formData);
    };

    const startTranscodingProgressPolling = (id) => {
        const intervalId = setInterval(() => {
            fetch(`${VIDEOS_URL}/progress/${id}`)
                .then(response => response.json())
                .then(data => {
                    console.log(data);
                    if (data.stage === "transcoding") {
                        setStatusMessage('Transcoding...');
                        const percentage = Math.round(20 + 0.7 * data.progress);
                        setUploadProgress(percentage);
                    }
                    else if (data.stage === "uploading") {
                        setStatusMessage('Finalising...');
                        const percentage = Math.round(90 + 0.1 * data.progress);
                        setUploadProgress(percentage);
                    }
                    else if (data.stage === "done") {
                        setStatusMessage('Upload Complete!');
                        setUploadProgress(100);
                        delay(1000);        // Wait 1 second
                        window.location.reload();   // Refresh screen
                    }
                })
                .catch(error => {
                    console.error('Error fetching progress:', error);
                    clearInterval(intervalId); // Stop polling on error
                    setStatusMessage('Error fetching progress');
                });
        }, 3000); // Poll every 3 seconds
    };

    return (
        <div>
            <h3>Upload a Video</h3>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        <input
                            type="text"
                            value={videoTitle}
                            onChange={handleTitleChange}
                            placeholder="Enter video title"
                            required
                        />
                    </label>
                </div>
                <div>
                    <label>
                        <input
                            type="text"
                            value={locationName}
                            onChange={handleLocationChange}
                            placeholder="Enter location"
                            required
                        />
                    </label>
                </div>
                <div>
                    <label>
                        <input
                            type="file"
                            accept=".mp4,.mov,.avi,.wmv,.mkv,.webm"
                            onChange={handleFileChange}
                            required
                        />
                    </label>
                </div>
                <div>
                    <p>{statusMessage}</p>
                    { isUploading && (
                        <div>
                            {renderProgressBar(uploadProgress)}
                        </div>
                    )}
                </div>
                <button type="submit">Upload</button>
            </form>
        </div>
    );
}
