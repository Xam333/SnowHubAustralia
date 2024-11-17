// Import react functions
import { useState } from 'react';

// Import stylesheet
import './Login.css';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main function
export default function Login({ isOpen, onClose, setUser }) {
    // Set useStates
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/signin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Set user in local storage and state
                localStorage.setItem('accessToken', data.accessToken);
                localStorage.setItem('idToken', data.idToken);

                console.log(data);
                
                // Close the modal on successful login
                onClose();
                window.location.reload();   // Refresh screen
            } else {
                setErrorMessage(data.error || 'Invalid username or password.');
            }
        } catch (error) {
            setErrorMessage('Failed to log in. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="login-modal">
            <div className="login-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username:</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {errorMessage && <p className="error">{errorMessage}</p>}
                    <button type="submit" className="login-button">Login</button>
                </form>
            </div>
        </div>
    );
}
