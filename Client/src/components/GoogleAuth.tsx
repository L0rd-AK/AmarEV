import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { authSlice } from '../store/slices/authSlice';
import { authService } from '../services/authService';

interface GoogleAuthProps {
  onSuccess?: (response: any) => void;
  onError?: (error: string) => void;
  buttonText?: string;
  className?: string;
}

// Extend Window interface to include Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({
  onSuccess,
  onError,
  buttonText = "Continue with Google",
  className = "",
}) => {
  const dispatch = useDispatch();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    // Initialize Google Identity Services when the script loads
    const initializeGoogleAuth = () => {
      if (window.google && clientId && clientId !== 'your-google-client-id') {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleResponse,
            auto_select: false,
          });

          // Render the button
          if (googleButtonRef.current) {
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'continue_with',
              shape: 'rectangular',
            });
          }
        } catch (error) {
          console.error('Failed to initialize Google Auth:', error);
          onError?.('Failed to initialize Google authentication');
        }
      }
    };

    // Check if Google script is already loaded
    if (window.google) {
      initializeGoogleAuth();
    } else {
      // Wait for the script to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogleLoaded);
          initializeGoogleAuth();
        }
      }, 100);

      // Clean up the interval after 10 seconds
      setTimeout(() => clearInterval(checkGoogleLoaded), 10000);
    }
  }, [clientId]);

  const handleGoogleResponse = async (response: any) => {
    if (!response.credential) {
      const error = 'No credential received from Google';
      console.error(error);
      onError?.(error);
      return;
    }

    setIsLoading(true);
    dispatch(authSlice.actions.loginStart());

    try {
      // Send the credential to our backend
      const authResponse = await authService.googleAuth(response.credential);

      if (authResponse.success && authResponse.data) {
        // Update Redux state
        dispatch(authSlice.actions.loginSuccess({
          user: {
            id: authResponse.data.user.id,
            email: authResponse.data.user.email,
            name: authResponse.data.user.displayName,
            role: authResponse.data.user.role,
            phone: authResponse.data.user.phone,
          },
          token: authResponse.data.tokens.accessToken,
          refreshToken: authResponse.data.tokens.refreshToken,
        }));

        // Store tokens in localStorage
        localStorage.setItem('accessToken', authResponse.data.tokens.accessToken);
        localStorage.setItem('refreshToken', authResponse.data.tokens.refreshToken);

        onSuccess?.(authResponse);
      } else {
        const error = authResponse.message || 'Google authentication failed';
        dispatch(authSlice.actions.loginFailure(error));
        onError?.(error);
      }
    } catch (error) {
      const errorMessage = 'Network error during Google authentication';
      console.error('Google auth error:', error);
      dispatch(authSlice.actions.loginFailure(errorMessage));
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback button for when Google Identity Services is not available
  const renderFallbackButton = () => (
    <button
      type="button"
      className={`w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={isLoading || !clientId || clientId === 'your-google-client-id'}
      onClick={() => {
        onError?.('Google authentication is not properly configured');
      }}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-500"></div>
      ) : (
        <>
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="ml-2">{buttonText}</span>
        </>
      )}
    </button>
  );

  // Show configuration message if Google Client ID is not set
  if (!clientId || clientId === 'your-google-client-id') {
    return (
      <div className="w-full">
        <button
          type="button"
          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed"
          disabled
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="ml-2">Google Auth (Not Configured)</span>
        </button>
        <p className="text-xs text-gray-500 mt-1 text-center">
          Configure VITE_GOOGLE_CLIENT_ID in environment variables
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Google Identity Services will render the button here */}
      <div ref={googleButtonRef} className="w-full" />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-md">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
        </div>
      )}
    </div>
  );
};

export default GoogleAuth;