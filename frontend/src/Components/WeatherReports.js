// Import react functions
import React, { useEffect, useState } from 'react';
import axios from 'axios';

// Import stylesheet
import './WeatherReports.css';

// Import components
import WeatherCard from './WeatherCard';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main weather reports function
export default function WeatherReports({ isAdmin }) {
    // Setu useStates
    const [resorts, setResorts] = useState([]);
    const [newResort, setNewResort] = useState({ name: '', latitude: '', longitude: '' });
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResorts();
    }, []);

    const fetchResorts = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/weather-locations`);
            if (Array.isArray(response.data)) {
                setResorts(response.data);
            } else {
                console.error('Expected an array but got:', response.data);
                setResorts([]); // Set to empty array if response is not an array
            }
        } catch (error) {
            console.error('Error fetching ski resorts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddResort = async () => {
        if (!newResort.name.trim() || !newResort.latitude.trim() || !newResort.longitude.trim()) {
            setError('Please enter all resort details');
            return;
        }

        try {
            const token = localStorage.getItem('accessToken');

            await axios.put(
                `${BACKEND_URL}/weather-locations`, 
                newResort, 
                {
                headers: {
                    'Authorization': `Bearer ${token}`, // Properly pass headers here
                    'Content-Type': 'application/json'
                }
            });

            fetchResorts();
            setNewResort({ name: '', latitude: '', longitude: '' });
            setError('');
            setShowModal(false); // Close modal after adding the resort
        } catch (error) {
            console.error('Error adding resort:', error);
            setError('Failed to add resort');
        }
    };

    const handleRemoveResort = async (name) => {
        try {
            const token = localStorage.getItem('accessToken');

            await axios.delete(
                `${BACKEND_URL}/weather-locations/${name}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`, // Properly pass headers here
                        'Content-Type': 'application/json'
                    }
                }
            );

            fetchResorts();
        } catch (error) {
            console.error('Error removing resort:', error);
        }
    };

    return (
        <div className="weather-reports-container">
            <h1>
                <span className="dash">--</span> Weather Reports <span className="dash">--</span>
            </h1>
            <div className="resorts">
                {loading ? (
                    <p>Loading Weather Reports...</p> // Display while loading
                ) : resorts.length === 0 ? (
                    <p>Error Retrieving Weather Reports</p> // Display if empty
                ) : (
                    resorts.map((resort) => (
                        <WeatherCard 
                            resort={resort} 
                            isAdmin={isAdmin} 
                            onRemove={handleRemoveResort} 
                        />
                    ))
                )}

                {/* Add Resort Button */}
                {isAdmin && (
                    <button className="add-resort-card" onClick={() => setShowModal(true)}>
                        <span className="plus-icon">+</span>
                    </button>
                )}
            </div>

            {/* Modal for Adding Resort */}
            {isAdmin && showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close" onClick={() => setShowModal(false)}>&times;</span>
                        <h3>Add New Ski Resort</h3>
                        <input
                            type="text"
                            value={newResort.name}
                            onChange={(e) => setNewResort({ ...newResort, name: e.target.value })}
                            placeholder="Resort Name"
                        />
                        <div className="coords-container">
                            <input
                                type="text"
                                value={newResort.latitude}
                                onChange={(e) => setNewResort({ ...newResort, latitude: e.target.value })}
                                placeholder="Latitude"
                            />
                            <input
                                type="text"
                                value={newResort.longitude}
                                onChange={(e) => setNewResort({ ...newResort, longitude: e.target.value })}
                                placeholder="Longitude"
                            />
                        </div>
                        <button onClick={handleAddResort}>Add Resort</button>
                        {error && <p className="error">{error}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
