// Import react functions
import React, { useEffect, useState } from 'react';

// Import stylesheet
import './WeatherCard.css';

// Import components
import weatherUnknown from '../Assets/Weather-Unknown.png';

// Setup backend url
const BACKEND_URL = `${process.env.REACT_APP_URL}:${process.env.REACT_APP_BACKEND_PORT}`;

// Main weather card function
export default function WeatherCard({ key, resort, isAdmin, onRemove }) {
    const [forecast, setForecast] = useState(null);
    const [selectedDay, setSelectedDay] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchForecast = async () => {
            try {
                // Make API request to backend with locationName
                const response = await fetch(`${BACKEND_URL}/weather-locations/forecast/${resort.locationName}`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch weather data for ${resort.locationName}`);
                }

                const data = await response.json();
                setForecast(data); // Store weather data in state
                setIsLoading(false);
            } catch (err) {
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchForecast();
    }, [resort.locationName]);

    // Function to get the forecast for a specific day
    const getForecast = (index) => {
        if (forecast && forecast.forecast && forecast.forecast.forecastday[index]) {
            return forecast.forecast.forecastday[index].day;
        }
        return null;
    };

    // Function to get the date for a specific day
    const getDateForDay = (index) => {
        if (forecast && forecast.forecast && forecast.forecast.forecastday[index]) {
            return new Date(forecast.forecast.forecastday[index].date);
        }
        return null;
    };

    // Function to get the day of the week and formatted date
    const getDayLabelAndDate = (index) => {
        if (index === 0) {
            return (
                <>
                    Today ({formatDate(new Date())})
                </>
            );
        } else if (index === 1) {
            return (
                <>
                    Tomorrow ({formatDate(new Date())})
                </>
            );
        } else if (forecast && forecast.forecast && forecast.forecast.forecastday[index]) {
            const date = new Date(forecast.forecast.forecastday[index].date);
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayOfWeek = daysOfWeek[date.getDay()];
            return (
                <>
                    {dayOfWeek} ({formatDate(date)})
                </>
            );
        }
        return '';
    };

    // Helper function to format date
    const formatDate = (date) => {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    // Handler for changing the day
    const handleDayChange = (direction) => {
        if (forecast) {
            setSelectedDay(prevDay => {
                let newDay = prevDay + direction;
                if (newDay < 0) newDay = 0;
                if (newDay > 2) newDay = 2; // Update to handle 3 days
                return newDay;
            });
        }
    };

    const todayForecast = getForecast(selectedDay);
    const dateForToday = getDateForDay(selectedDay);

    return (
        <div className="resort-card">
            <h2>{resort.locationName}</h2>

            {isLoading ? ( // Loading state check
                <p>Loading weather data...</p>
            ) : error ? ( // Error state check
                <p>{error}</p>
            ) : ( // Successfully loaded data check
                <div className="weather-info">
                    <h3>{getDayLabelAndDate(selectedDay)}</h3>
                    <div className="weather-condition">
                        <img
                            src={`https:${todayForecast.condition.icon}`} 
                            alt="Weather Icon Not Found" 
                            onError={(e) => e.target.src = weatherUnknown}
                        />
                        <p>{todayForecast.condition.text}</p>
                    </div>
                    <p>Min Temp: {todayForecast.mintemp_c}°C</p>
                    <p>Max Temp: {todayForecast.maxtemp_c}°C</p>
                    <p>Wind: {todayForecast.maxwind_kph} kph {todayForecast.wind_dir}</p>
                    <p>
                        {todayForecast.daily_will_it_rain ? `Chance of Rain: ${todayForecast.daily_chance_of_rain}%` : 
                        todayForecast.daily_will_it_snow ? `Chance of Snow: ${todayForecast.daily_chance_of_snow}%` :
                        null}
                    </p>
                    <p>
                        {todayForecast.totalprecip_mm > 0 ? `Total Precipitation: ${todayForecast.totalprecip_mm} mm` :
                        todayForecast.totalsnow_cm > 0 ? `Total Snow: ${todayForecast.totalsnow_cm} cm` :
                        null}
                    </p>
                    <p>Visibility: {todayForecast.avgvis_km} km</p>
                    <div className="forecast-navigation">
                        <button onClick={() => handleDayChange(-1)} disabled={selectedDay === 0}>
                            {"<"}
                        </button>
                        <button onClick={() => handleDayChange(1)} disabled={selectedDay === 2}>
                            {">"}
                        </button>
                    </div>
                </div>
            )}

            {isAdmin && (
                <div className="delete">
                    <button onClick={() => onRemove(resort.locationName)}>
                        ⛔
                    </button>
                </div>
            )}
        </div>
    );
}
