import React, { useState, useEffect, useRef } from 'react';
import './VideoPlayer.css';
import axios from 'axios';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;
const VIDEOS_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_VIDEOS_PORT}`;

export default function VideoPlayer({ video }) {
    const { videoId, videoTitle, locationName, uploadDate, userName } = video;
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('high');
    const [type, setType] = useState('mp4'); // default to mp4
    const videoRef = useRef(null);
    const [canDelete, setCanDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        // Detect supported video type (mp4 or webm)
        const checkVideoSupport = () => {
            const videoElement = document.createElement('video');
            if (videoElement.canPlayType('video/mp4')) {
                return 'mp4';
            } else {
                return 'webm';
            }
        };

        const selectedType = checkVideoSupport();
        setType(selectedType);

        const fileName = `${videoId}_${quality}.${selectedType}`;

        // Fetch presigned URL for the video
        fetch(`${VIDEOS_URL}/videos/${fileName}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.downloadUrl) {
                    setUrl(data.downloadUrl);
                } else {
                    console.error('Unexpected response format:', data);
                }
            })
            .catch(error => console.error('Error fetching video URL:', error));

        // Check if user can delete
        const token = localStorage.getItem('accessToken');

        const checkUserPermissions = async () => {
            try {
                const authResponse = await fetch(`${BACKEND_URL}/auth/signed-in`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });
                const authData = await authResponse.json();

                const adminResponse = await fetch(`${BACKEND_URL}/auth/check-admin`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });
                const adminData = await adminResponse.json();

                if (adminData.isAdmin || authData.username === userName ) {
                    setCanDelete(true);
                }

            } catch (err) {
                console.error('Error checking user permissions:', err);
            }
        };

        if (token) {
            checkUserPermissions();
        }
    }, [videoId, quality, userName]);

    const handleQualityChange = (newQuality) => {
        setQuality(newQuality);
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            const isPaused = videoRef.current.paused;

            videoRef.current.load();

            videoRef.current.currentTime = currentTime;
            if (!isPaused) {
                videoRef.current.play();
            }
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await axios.delete(`${VIDEOS_URL}/videos/${videoId}/${userName}`);
            window.location.reload();
        } catch (error) {
            console.error('Error deleting video:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="video-container">
            <div className="title-quality-container">
                <h3>{videoTitle}</h3>
                <div>
                    <label htmlFor="quality">Quality: </label>
                    <select videoId="quality" value={quality} onChange={(e) => handleQualityChange(e.target.value)}>
                        <option value="high">720p</option>
                        <option value="low">360p</option>
                    </select>
                </div>
            </div>

            {canDelete && (
                <div className='delete-video'>
                    <button onClick={handleDelete} disabled={isDeleting}>
                        ⛔
                    </button>
                </div>
            )}

            <video ref={videoRef} width="95%" controls>
                {url && <source src={url} type={`video/${type}`} />}
                Your browser does not support the video tag.
            </video>
            <div className="user-date-container">
                <p>Uploaded By: {userName}</p>
                <p>{locationName}</p>
            </div>
            <p className="date">{new Date(uploadDate).toLocaleDateString('en-GB')}</p>
        </div>
    );
}
