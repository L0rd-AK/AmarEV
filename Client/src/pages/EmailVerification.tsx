import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authSlice } from '../store/slices/authSlice';
import { authService } from '../services/authService';

type VerificationStatus = 'verifying' | 'success' | 'error' | 'expired' | 'invalid';

const LoadingSpinner: React.FC<{ className?: string }> = ({ className = "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" }) => {
  return <div className={className}></div>;
};

const EmailVerification: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('verifying');
  const [message, setMessage] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmailToken();
    } else {
      setVerificationStatus('invalid');
      setMessage('Invalid verification link. Please check your email for the correct link.');
    }
  }, [token]);

  const verifyEmailToken = async () => {
    if (!token) return;

    setVerificationStatus('verifying');

    try {
      const response = await authService.verifyEmail(token);

      if (response.success) {
        setVerificationStatus('success');
        setMessage('Your email has been successfully verified! You can now log in to your account.');
        
        // Update auth state if user data is returned
        if (response.data?.user) {
          dispatch(authSlice.actions.updateUser({
            id: response.data.user.id,
            email: response.data.user.email,
            name: response.data.user.displayName,
            role: response.data.user.role,
            phone: response.data.user.phone,
          }));
        }

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Email verified successfully! You can now log in.',
              type: 'success'
            }
          });
        }, 3000);
      } else {
        const errorMessage = response.message || 'Verification failed';
        
        if (errorMessage.includes('expired')) {
          setVerificationStatus('expired');
        } else if (errorMessage.includes('invalid')) {
          setVerificationStatus('invalid');
        } else {
          setVerificationStatus('error');
        }
        
        setMessage(errorMessage);
      }
    } catch (err) {
      setVerificationStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resendEmail) return;

    setIsResending(true);
    setResendMessage('');

    try {
      const response = await authService.resendEmailVerification(resendEmail);

      if (response.success) {
        setResendMessage('Verification email sent successfully! Please check your inbox.');
      } else {
        setResendMessage(response.message || 'Failed to resend verification email.');
      }
    } catch (err) {
      setResendMessage('Network error. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'success':
        return (
          <svg className="mx-auto h-16 w-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
      case 'expired':
      case 'invalid':
        return (
          <svg className="mx-auto h-16 w-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'verifying':
      default:
        return <LoadingSpinner className="mx-auto animate-spin rounded-full h-16 w-16 border-b-2 border-green-600" />;
    }
  };

  const getStatusColor = () => {
    switch (verificationStatus) {
      case 'success':
        return 'text-green-800';
      case 'error':
      case 'expired':
      case 'invalid':
        return 'text-red-800';
      default:
        return 'text-gray-800';
    }
  };

  const getBgColor = () => {
    switch (verificationStatus) {
      case 'success':
        return 'bg-green-50';
      case 'error':
      case 'expired':
      case 'invalid':
        return 'bg-red-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold text-green-600">AmarEV</h1>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Email Verification
          </h2>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Verification Status */}
          <div className={`rounded-md p-4 ${getBgColor()}`}>
            <div className="flex flex-col items-center">
              {getStatusIcon()}
              <h3 className={`mt-4 text-lg font-medium ${getStatusColor()}`}>
                {verificationStatus === 'verifying' && 'Verifying your email...'}
                {verificationStatus === 'success' && 'Email Verified!'}
                {verificationStatus === 'error' && 'Verification Failed'}
                {verificationStatus === 'expired' && 'Link Expired'}
                {verificationStatus === 'invalid' && 'Invalid Link'}
              </h3>
              <p className={`mt-2 text-sm text-center ${getStatusColor()}`}>
                {message}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-4">
            {verificationStatus === 'success' && (
              <div className="space-y-3">
                <Link
                  to="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Sign In to Your Account
                </Link>
                <p className="text-center text-sm text-gray-600">
                  Redirecting to login page in 3 seconds...
                </p>
              </div>
            )}

            {(verificationStatus === 'expired' || verificationStatus === 'invalid' || verificationStatus === 'error') && (
              <div className="space-y-4">
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Need a new verification link?
                  </h4>
                  <form onSubmit={handleResendVerification} className="space-y-3">
                    <div>
                      <label htmlFor="resend-email" className="block text-sm font-medium text-gray-700">
                        Email address
                      </label>
                      <input
                        id="resend-email"
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="Enter your email"
                      />
                    </div>
                    
                    {resendMessage && (
                      <div className={`p-3 rounded-md ${resendMessage.includes('successfully') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <p className="text-sm">{resendMessage}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isResending || !resendEmail}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isResending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        'Resend Verification Email'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-green-600 hover:text-green-500 font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;