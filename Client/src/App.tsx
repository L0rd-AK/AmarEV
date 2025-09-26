import { Routes, Route } from 'react-router-dom';
import { Home, Login, Register, EmailVerification, Profile } from './pages';
import { Navigation, Footer, ProtectedRoute } from './components';

// Simple placeholder components for now
const MapPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Station Map</h1></div>;
const AboutPage = () => <div className="p-8"><h1 className="text-2xl font-bold">About AmarEV</h1></div>;
const ReservationsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">My Reservations</h1></div>;
const VehiclesPage = () => <div className="p-8"><h1 className="text-2xl font-bold">My Vehicles</h1></div>;
const SettingsPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Settings</h1></div>;

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute><ReservationsPage /></ProtectedRoute>} />
          <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;