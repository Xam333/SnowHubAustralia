// Import stylesheet
import './Home.css';

// Import nav functions
import { NavLink as Link } from 'react-router-dom';

// Import components
import Navbar from '../Components/Navbar';

// Import images
import wideBackground from '../Assets/Hero-Background-Wide.jpg';
import narrowBackground from '../Assets/Hero-Background-Narrow.jpg';
import mainLogo from '../Assets/Snow-Hub-Logo-White.png';

// Main home page function
export default function Home() {
    return (
        <>
            <Navbar isTransparent={true} showHomeButton={false} />
            <div className="background">
                <img className="wide" src={wideBackground}/>
                <img className="narrow" src={narrowBackground}/>
            </div>
            <div className="home-container">
                <img className="main-logo" src={mainLogo}></img>
                <div className="button-container">
                    <Link to="/snow-reports" className="button">Snow<br />Reports</Link>
                    <Link to="/community-page" className="button">Community<br />Page</Link>
                </div>
            </div>
        </>
    );
}