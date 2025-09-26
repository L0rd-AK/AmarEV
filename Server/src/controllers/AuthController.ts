import { Request, Response, NextFunction } from 'express';
import { User, UserDocument } from '@/models/User';
import { jwtService } from '@/utils/jwt';
import { getEmailService } from '@/services/EmailService';
import { logger } from '@/utils/logger';
import { UserRole } from '@chargebd/shared';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';

// Import UserStatus separately to avoid potential import issues
const { UserStatus } = require('@chargebd/shared');

// Define AuthenticatedRequest interface
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50, 'Display name must be less than 50 characters').optional(),
  phone: z.string().regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format').optional(),
  language: z.enum(['en', 'bn']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  ),
});

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      // Debug: Log the incoming request body
      logger.info('Registration attempt', { body: req.body });
      
      // Validate request body
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await User.findOne({ email: validatedData.email });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
        return;
      }

      // Create new user
      const user = new User({
        email: validatedData.email,
        passwordHash: validatedData.password, // Will be hashed by pre-save middleware
        displayName: validatedData.displayName,
        phone: validatedData.phone,
        language: validatedData.language || 'en',
        role: UserRole.USER,
        status: UserStatus.PENDING_VERIFICATION,
      });

      await user.save();

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const emailSent = await getEmailService().sendEmailVerification({
        email: user.email,
        displayName: user.displayName,
        verificationToken,
        verificationLink,
      });

      if (!emailSent) {
        logger.warn('Failed to send verification email', { userId: user._id, email: user.email });
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        data: {
          userId: user._id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          status: (user as any).status,
          emailVerificationSent: emailSent,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * User login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { email, password } = loginSchema.parse(req.body);

      // Find user by email
      const user = await User.findOne({ email }) as UserDocument | null;
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed login attempts'
        });
        return;
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        // Increment login attempts
        await user.incrementLoginAttempts();
        
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Reset login attempts on successful login
      if ((user as any).loginAttempts && (user as any).loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Generate JWT tokens
      const { accessToken, refreshToken } = jwtService.generateTokenPair(
        (user._id as string).toString(),
        user.email,
        user.role
      );

      // Store refresh token in database
      await jwtService.storeRefreshToken((user._id as string).toString(), refreshToken);

      // Update last login
      (user as any).lastLogin = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: (user as any).status,
            isEmailVerified: user.isEmailVerified,
            phone: user.phone,
            language: user.language,
          },
          tokens: {
            accessToken,
            refreshToken,
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Refresh JWT token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { refreshToken } = refreshTokenSchema.parse(req.body);

      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);

      // Check if refresh token exists in database
      const storedToken = await jwtService.verifyStoredRefreshToken(refreshToken);
      if (!storedToken) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
        return;
      }

      // Check if user still exists and is active
      const user = await User.findById(decoded.userId) as UserDocument | null;
      if (!user || (user as any).status !== UserStatus.ACTIVE) {
        // Remove invalid refresh token
        await jwtService.removeRefreshToken(refreshToken);
        res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
        return;
      }

      // Generate new token pair
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = jwtService.generateTokenPair(
        (user._id as string).toString(),
        user.email,
        user.role
      );

      // Remove old refresh token and store new one
      await jwtService.removeRefreshToken(refreshToken);
      await jwtService.storeRefreshToken((user._id as string).toString(), newRefreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  }

  /**
   * User logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        // Remove refresh token from database
        await jwtService.removeRefreshToken(refreshToken);
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Remove all refresh tokens for the user
      await jwtService.removeAllRefreshTokens(req.user.userId);

      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error) {
      logger.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Forgot password - send reset email
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { email } = forgotPasswordSchema.parse(req.body);

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not for security
        res.json({
          success: true,
          message: 'If an account with that email exists, you will receive a password reset email.'
        });
        return;
      }

      // Generate password reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send password reset email
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const emailSent = await getEmailService().sendPasswordReset({
        email: user.email,
        displayName: user.displayName,
        resetToken,
        resetLink,
      });

      if (!emailSent) {
        logger.warn('Failed to send password reset email', { userId: user._id, email: user.email });
      }

      res.json({
        success: true,
        message: 'If an account with that email exists, you will receive a password reset email.'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { token, password } = resetPasswordSchema.parse(req.body);

      // Find user by reset token
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
        return;
      }

      // Update password and clear reset token
      user.passwordHash = password; // Will be hashed by pre-save middleware
      (user as any).passwordResetToken = undefined;
      (user as any).passwordResetExpires = undefined;

      // Reset login attempts if any
      if ((user as any).loginAttempts && (user as any).loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      await user.save();

      // Remove all refresh tokens (logout from all devices)
      await jwtService.removeAllRefreshTokens((user._id as string).toString());

      res.json({
        success: true,
        message: 'Password reset successful. Please log in with your new password.'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Verify email address
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { token } = verifyEmailSchema.parse(req.body);

      // Find user by verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
        return;
      }

      // Update user as verified
      user.isEmailVerified = true;
      (user as any).status = UserStatus.ACTIVE;
      (user as any).emailVerificationToken = undefined;
      (user as any).emailVerificationExpires = undefined;
      await user.save();

      // Send welcome email
      await getEmailService().sendWelcomeEmail(user.email, user.displayName);

      res.json({
        success: true,
        message: 'Email verified successfully. Your account is now active.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: (user as any).status,
            isEmailVerified: user.isEmailVerified,
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Resend email verification
   */
  static async resendEmailVerification(req: Request, res: Response): Promise<void> {
    try {
      const { email } = forgotPasswordSchema.parse(req.body); // Reuse email validation

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      if (user.isEmailVerified) {
        res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
        return;
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const emailSent = await getEmailService().sendEmailVerification({
        email: user.email,
        displayName: user.displayName,
        verificationToken,
        verificationLink,
      });

      if (!emailSent) {
        logger.warn('Failed to send verification email', { userId: user._id, email: user.email });
        res.status(500).json({
          success: false,
          message: 'Failed to send verification email'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Resend verification email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Change password (authenticated user)
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validate request body
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      // Find user
      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Update password
      user.passwordHash = newPassword; // Will be hashed by pre-save middleware
      await user.save();

      // Optionally logout from all devices except current
      // await jwtService.removeAllRefreshTokens(user._id.toString());

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
        return;
      }

      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Find user
      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            status: (user as any).status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            phone: user.phone,
            language: user.language,
            lastLogin: (user as any).lastLogin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}