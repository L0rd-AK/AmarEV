import { Routes, Route } from 'react-router-dom';
import { 
  Home, Login, Register, EmailVerification, Profile,
  Stations, StationDetails, OperatorDashboard, StationAnalytics,
  UserDashboard, AdminDashboard, MyVehicles, MyReservations
} from './pages';
import { Navigation, Footer, ProtectedRoute } from './components';

// Simple placeholder components for now
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
          
          {/* Public Station Routes */}
          <Route path="/stations" element={<Stations />} />
          <Route path="/stations/:id" element={<StationDetails />} />
          
          {/* Auth Routes */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          
          {/* Protected User Routes */}
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/my-vehicles" element={<ProtectedRoute><MyVehicles /></ProtectedRoute>} />
          <Route path="/my-reservations" element={<ProtectedRoute><MyReservations /></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute><ReservationsPage /></ProtectedRoute>} />
          <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          {/* Protected Operator Routes */}
          <Route path="/operator/dashboard" element={<ProtectedRoute><OperatorDashboard /></ProtectedRoute>} />
          <Route path="/operator/stations/:id/analytics" element={<ProtectedRoute><StationAnalytics /></ProtectedRoute>} />
          
          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;