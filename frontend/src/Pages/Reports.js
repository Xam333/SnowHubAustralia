import React, { useState, useEffect } from 'react';
import './Reports.css';
import Navbar from '../Components/Navbar';
import SnowCams from '../Components/SnowCams';
import WeatherReports from '../Components/WeatherReports';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main reports page function
export default function Reports() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Function to check if user is an admin
        const checkAdminStatus = async () => {
            try {
                // Get the JWT token from localStorage
                const accessToken = localStorage.getItem('accessToken'); // Assuming the token is stored as 'token'

                console.log('Access token: ', accessToken);

                // Make an API call to check if the user is an admin
                const response = await fetch(`${BACKEND_URL}/auth/check-admin`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`, // Send the JWT token
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsAdmin(data.isAdmin);
                } else {
                    setIsAdmin(false);
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                setIsAdmin(false); // In case of error, treat as not admin
            } finally {
                setLoading(false);
            }
        };

        // Call the checkAdminStatus function
        checkAdminStatus();
    }, []);

    if (loading) {
        return <div>Loading...</div>; // Show a loading spinner while checking admin status
    }

    return (
        <>
            <Navbar isTransparent={false} showHomeButton={true} />
            <div className="reports-container">
                <WeatherReports isAdmin={isAdmin} />
                <SnowCams isAdmin={isAdmin} />
            </div>
        </>
    );
}
