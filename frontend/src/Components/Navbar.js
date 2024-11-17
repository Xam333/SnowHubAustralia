// Import React functions
import React, { useState, useEffect } from 'react';
import { NavLink as Link } from 'react-router-dom';

// Import stylesheet
import './Navbar.css';

// Import coimponents
import Login from './Login';
import Signup from './Signup';

// Import images
import navLogo from '../Assets/Snow-Hub-White.png'; // Import nav logo

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main navbar function
export default function Navbar({ isTransparent, showHomeButton }) {
    // Set useStates
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = localStorage.getItem('accessToken'); // Make sure you store the access token here
                if (token) {
                    const response = await fetch(`${BACKEND_URL}/auth/signed-in`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.username || 'Guest');
                    } else {
                        // Handle error or expired token
                        console.error('Failed to fetch user data');
                        localStorage.removeItem('accessToken'); // Clear the invalid token
                        setUser(null);
                    }
                }
                setLoading(false);
            } catch (error) {
                console.error('Error fetching user data:', error);
                setUser(null);
            }
        };

        fetchUserData();
    }, []);

    // Initialise functions
    const openLoginModal = () => {
        setIsLoginModalOpen(true);
        setIsSignupModalOpen(false); // Close signup modal when opening login modal
    };
    const closeLoginModal = () => setIsLoginModalOpen(false);

    const openSignupModal = () => setIsSignupModalOpen(true);
    const closeSignupModal = () => setIsSignupModalOpen(false);

    const handleLogout = () => {
        setUser(null);    // Clear username
        localStorage.removeItem('accessToken');
        localStorage.removeItem('idToken');
        window.location.reload();
    };

    return (
        <>
            <div className={`nav-container ${isTransparent ? 'transparent' : 'blue-background'}`}>
                <nav className="navbar-left">
                    {showHomeButton && <Link to="/"><img src={navLogo} alt="Snow Hub Logo" className="navbar-logo" /> </Link>}
                </nav>
                <nav className="navbar-right">
                    {loading ? null : user ? (
                        <>
                            <span className="nav-link">Hello, {user}</span>
                            <button onClick={handleLogout} className="nav-link">Logout</button>
                        </>
                    ) : (
                        <>
                            <button onClick={openLoginModal} className="nav-link">Login</button>
                            <button onClick={openSignupModal} className="nav-link">Signup</button>
                        </>
                    )}
                </nav>
            </div>
            <Login isOpen={isLoginModalOpen} onClose={closeLoginModal} setUser={setUser }/>

            <Signup isOpen={isSignupModalOpen} onClose={closeSignupModal} openLoginModal={openLoginModal} />
        </>
    );
}
