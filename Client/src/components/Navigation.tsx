import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { authSlice } from '../store/slices/authSlice';
import { authService } from '../services/authService';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      dispatch(authSlice.actions.logout());
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      dispatch(authSlice.actions.logout());
      navigate('/');
    }
    setIsUserMenuOpen(false);
  };

  return (
    <nav className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-bold text-lg">⚡</span>
            </div>
            <span className="text-xl font-bold">AmarEV</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/') 
                  ? 'bg-white bg-opacity-20 text-white' 
                  : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/stations" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/stations') || location.pathname.startsWith('/stations/')
                  ? 'bg-white bg-opacity-20 text-white' 
                  : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              Find Stations
            </Link>
            <Link 
              to="/about" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about') 
                  ? 'bg-white bg-opacity-20 text-white' 
                  : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              About
            </Link>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 text-white hover:text-blue-100 focus:outline-none focus:text-blue-100 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{user?.name || 'User'}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/my-vehicles"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      My Vehicles
                    </Link>
                    <Link
                      to="/my-reservations"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      My Reservations
                    </Link>
                    <Link
                      to="/transactions"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Transactions
                    </Link>
                    {user?.role === 'operator' || user?.role === 'admin' ? (
                      <>
                        <hr className="my-1" />
                        <Link
                          to="/operator/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          My Stations
                        </Link>
                      </>
                    ) : null}
                    {user?.role === 'admin' ? (
                      <Link
                        to="/admin/dashboard"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    ) : null}
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-blue-100 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  to="/register" 
                  className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              type="button" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-blue-100 hover:text-white focus:outline-none focus:text-white"
              aria-label="Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} 
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-gradient-to-r from-green-700 to-blue-700">
              <Link 
                to="/" 
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive('/') 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/stations" 
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive('/stations') || location.pathname.startsWith('/stations/')
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Find Stations
              </Link>
              <Link 
                to="/about" 
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive('/about') 
                    ? 'bg-white bg-opacity-20 text-white' 
                    : 'text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              
              {/* Mobile Auth Section */}
              <div className="border-t border-white border-opacity-20 pt-4">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-2 text-white font-medium">
                      Welcome, {user?.name || 'User'}
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/my-vehicles"
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Vehicles
                    </Link>
                    <Link
                      to="/my-reservations"
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Reservations
                    </Link>
                    <Link
                      to="/transactions"
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Transactions
                    </Link>
                    {user?.role === 'operator' || user?.role === 'admin' ? (
                      <Link
                        to="/operator/dashboard"
                        className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        My Stations
                      </Link>
                    ) : null}
                    {user?.role === 'admin' ? (
                      <Link
                        to="/admin/dashboard"
                        className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    ) : null}
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:text-red-200 hover:bg-white hover:bg-opacity-10"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/login" 
                      className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:text-white hover:bg-white hover:bg-opacity-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link 
                      to="/register" 
                      className="block px-3 py-2 rounded-md text-base font-medium bg-yellow-400 text-gray-900 hover:bg-yellow-300 mt-2 mx-3"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;