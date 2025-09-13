import { Routes, Route } from 'react-router-dom';
import { Home } from './pages';
import { Navigation, Footer } from './components';

// Simple placeholder components for now
const MapPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Station Map</h1></div>;

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;