import { Routes, Route } from 'react-router-dom';
import { Home, Login, Register, EmailVerification } from './pages';
import { Navigation, Footer } from './components';

// Simple placeholder components for now
const MapPage = () => <div className="p-8"><h1 className="text-2xl font-bold">Station Map</h1></div>;
const AboutPage = () => <div className="p-8"><h1 className="text-2xl font-bold">About AmarEV</h1></div>;
const ProfilePage = () => <div className="p-8"><h1 className="text-2xl font-bold">User Profile</h1></div>;
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
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;