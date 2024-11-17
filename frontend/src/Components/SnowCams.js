// Import react functions
import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Import stylesheet
import './SnowCams.css';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Helper function to validate YouTube URLs
const isValidYouTubeUrl = (url) => {
    try {
        const parsedUrl = new URL(url);
        return (
            parsedUrl.hostname === 'www.youtube.com' &&
            parsedUrl.searchParams.get('v') // Ensure the URL has a video ID
        );
    } catch (error) {
        return false; // Invalid URL
    }
};

// Main snow cams function
export default function SnowCams({ isAdmin }) {
    // Set useStates
    const [links, setLinks] = useState([]);
    const [newLink, setNewLink] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [showModal, setShowModal] = useState(false); // State to control modal visibility
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLinks();
    }, []);

    // Get snow cam youtube links from backend
    const fetchLinks = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/snow-cams`);
            console.log('Fetched snow cam links:', response.data); // Log data to verify it's an array
            if (Array.isArray(response.data)) {
                setLinks(response.data);
            } else {
                console.error('Expected an array but got:', response.data);
                setLinks([]); // Set to empty array if response is not an array
            }
        } catch (error) {
            console.error('Error fetching links:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLink = async () => {
        if (!newLink.trim() || !newLocation.trim()) {
            setError('Please enter a valid YouTube link and location name');
            return;
        }

        if (!isValidYouTubeUrl(newLink)) {
            setError('Invalid YouTube URL. Please enter a valid link.');
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');

            await axios.put(
                `${BACKEND_URL}/snow-cams`,
                { link: newLink, location: newLocation },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            fetchLinks();
            setNewLink('');
            setNewLocation('');
            setError('');
            window.location.reload(); // Refresh page
        } catch (error) {
            console.error('Error adding link:', error);
            setError('Failed to add link');
        }
    };

    const handleRemoveLink = async (link) => {
        try {
            const token = localStorage.getItem('accessToken'); // Retrieve token from localStorage
    
            await axios.delete(
                `${BACKEND_URL}/snow-cams/${encodeURIComponent(link)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`, // Add Authorization header
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            fetchLinks(); // Refresh the links after successful deletion
        } catch (error) {
            console.error('Error removing link:', error);
        }
    };

    return (
        <div className="snow-cams-container">
            <h1>
                <span className="dash">--</span> Snow Cams <span className="dash">--</span>
            </h1>
            <div className="streams">
            {loading ? (
                    <p>Loading Snow Cams...</p>
                ) : Array.isArray(links) && links.length > 0 ? (
                    links.map(({ youtubeLink, location }) => (
                        <div key={youtubeLink} className="stream">
                            <h2 className="location-name">{location}</h2>
                            <div className="delete-link">
                                {isAdmin && (
                                    <button onClick={() => handleRemoveLink(youtubeLink)}>
                                        ⛔
                                    </button>
                                )}
                            </div>
                            <div className="aspect-ratio-wrapper">
                                <iframe
                                    width="560"
                                    height="315"
                                    src={`https://www.youtube.com/embed/${new URL(youtubeLink).searchParams.get('v')}`}
                                    title="YouTube video player"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>Error Retrieving Live Snow Cams</p> // Handle non-array or empty array data gracefully
                )}
                {isAdmin && (
                    <button className="add-stream-card" onClick={() => setShowModal(true)}>
                        <span className="plus-icon">+</span>
                    </button>
                )}
            </div>
            {isAdmin && showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close" onClick={() => setShowModal(false)}>&times;</span>
                        <h3>Add Youtube Stream</h3>
                        <input
                            type="text"
                            value={newLink}
                            onChange={(e) => setNewLink(e.target.value)}
                            placeholder="Enter YouTube link"
                        />
                        <input
                            type="text"
                            value={newLocation}
                            onChange={(e) => setNewLocation(e.target.value)}
                            placeholder="Enter Location Name"
                        />
                        <button onClick={handleAddLink}>Add Link</button>
                        {error && <p className="error">{error}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
