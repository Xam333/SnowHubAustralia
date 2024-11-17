import React, { useEffect, useState } from 'react';
import './Community.css';
import Navbar from '../Components/Navbar';
import VideoUpload from '../Components/VideoUpload';
import VideoPlayer from '../Components/VideoPlayer';
import Modal from '../Components/Modal';

// Setup backend url
const VIDEOS_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_VIDEOS_PORT}`;

export default function Community() {
    const [videos, setVideos] = useState([]);
    const [sortOption, setSortOption] = useState('date');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const accessToken = localStorage.getItem('accessToken');
        setIsLoggedIn(!!accessToken);
        setLoading(true);

        fetch(`${VIDEOS_URL}/videos/metadata?sort=${sortOption}`)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setVideos(data);
                } else {
                    console.error('Unexpected response format:', data);
                }
            })
            .catch(error => console.error('Error fetching videos:', error))
            .finally(() => setLoading(false));
    }, [sortOption]);

    const handleSortChange = (event) => {
        setSortOption(event.target.value);
    };

    const toggleModal = () => {
        setIsModalOpen(prev => !prev);
    };

    return (
        <>
            <Navbar isTransparent={false} showHomeButton={true} />
            <div className="community-container">
                <h1>
                    <span className="dash">--</span> Community Posts <span className="dash">--</span>
                </h1>
                <div className="community-controls">
                    <div className="sort-by">
                        <label htmlFor="sort">Sort by: </label>
                        <select id="sort" value={sortOption} onChange={handleSortChange}>
                            <option value="date">Upload Date</option>
                            <option value="username">Username</option>
                            <option value="location">Location</option>
                            <option value="title">Title</option>
                        </select>
                    </div>
                    <div className="upload-container">
                        <button className="upload-button" onClick={toggleModal} disabled={!isLoggedIn}>
                            Upload +
                            {!isLoggedIn && <span className="tooltip">You must be logged in to upload</span>}
                        </button>
                    </div>
                </div>
                <ul>
                    {loading ? (
                        <p>Loading Videos...</p> // Display while loading
                    ) : videos.length === 0 ? (
                        <p>No Videos Available</p> // Display if empty
                    ) : (
                        videos.map(video => (
                            <li key={video.videoId}>
                                <VideoPlayer video={video} />
                            </li>
                        ))
                    )}
                </ul>
            </div>
            <Modal isOpen={isModalOpen} >
                <span className="close" onClick={() => toggleModal(false)}>&times;</span>
                <VideoUpload />
            </Modal>
        </>
    );
}
