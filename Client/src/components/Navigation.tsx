import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
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
              to="/map" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/map') 
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

          <div className="hidden md:flex items-center space-x-4">
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
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              type="button" 
              className="text-blue-100 hover:text-white focus:outline-none focus:text-white"
              aria-label="Menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;