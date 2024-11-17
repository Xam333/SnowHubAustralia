// Import react routing
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import pages
import Home from './Pages/Home';
import Reports from './Pages/Reports';
import Community from './Pages/Community';

// Main app
function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={ <Home /> } />
        <Route path="/snow-reports" element={ <Reports /> } />
        <Route path="/community-page" element={ <Community /> } />
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;