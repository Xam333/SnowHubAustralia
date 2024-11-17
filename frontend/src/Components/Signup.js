// Import react functions
import { useState } from 'react';

// Import stylesheet
import './Signup.css';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main signup function
export default function Signup({ isOpen, onClose, openLoginModal }) {
    const [step, setStep] = useState('signup'); // Tracks the current step ('signup' or 'confirm')
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmationCode, setConfirmationCode] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSignup = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setStep('confirm'); // Move to confirmation step
            } else {
                setErrorMessage(data.message || 'Error signing up.');
            }
        } catch (error) {
            setErrorMessage('Failed to sign up. Please try again.');
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        try {
            const response = await fetch(`${BACKEND_URL}/auth/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, confirmationCode }),
            });

            const data = await response.json();

            if (response.ok) {
                openLoginModal(); // Open the login modal
                onClose(); // Close the signup modal
            } else {
                setErrorMessage(data.message || 'Error confirming the user.');
            }
        } catch (error) {
            setErrorMessage('Failed to confirm the user. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>{step === 'signup' ? 'Signup' : 'Confirm Signup'}</h2>

                {step === 'signup' ? (
                    <form onSubmit={handleSignup}>
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
                            <label htmlFor="email">Email:</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                        <button type="submit" className="signup-button">Signup</button>
                    </form>
                ) : (
                    <form onSubmit={handleConfirm}>
                        <div className="form-group">
                            <label htmlFor="confirmationCode">Confirmation Code:</label>
                            <input
                                type="text"
                                id="confirmationCode"
                                value={confirmationCode}
                                onChange={(e) => setConfirmationCode(e.target.value)}
                                required
                            />
                        </div>
                        {errorMessage && <p className="error">{errorMessage}</p>}
                        <button type="submit" className="signup-button">Confirm Signup</button>
                    </form>
                )}
            </div>
        </div>
    );
}
