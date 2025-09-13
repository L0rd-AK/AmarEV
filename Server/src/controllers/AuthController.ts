import { Request, Response, NextFunction } from 'express';
import { User } from '@/models/User';
import { AuthService, AuthenticatedRequest } from '@/middleware/auth';
import { registerSchema, loginSchema, refreshTokenSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { ValidationUtils } from '@chargebd/shared';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: validatedData.email.toLowerCase() });
      if (existingUser) {
        res.status(409).json({
          error: {
            message: 'User with this email already exists',
            code: 'USER_EXISTS',
            statusCode: 409,
          },
        });
        return;
      }

      // Hash password
      const passwordHash = await AuthService.hashPassword(validatedData.password);

      // Create user
      const user = new User({
        email: validatedData.email.toLowerCase(),
        passwordHash,
        displayName: validatedData.displayName,
        phone: validatedData.phone,
        language: validatedData.language,
      });

      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = await AuthService.createTokens(user);

      logger.info(`User registered successfully: ${user.email}`);

      res.status(201).json({
        message: 'User registered successfully',
        user: user.toJSON(),
        accessToken,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
      if (!user) {
        res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS',
            statusCode: 401,
          },
        });
        return;
      }

      // Verify password
      const isValidPassword = await AuthService.comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS',
            statusCode: 401,
          },
        });
        return;
      }

      // Generate tokens
      const { accessToken, refreshToken } = await AuthService.createTokens(user);

      logger.info(`User logged in successfully: ${user.email}`);

      res.json({
        message: 'Login successful',
        user: user.toJSON(),
        accessToken,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request body
      const { refreshToken } = refreshTokenSchema.parse(req.body);

      // Verify refresh token
      const payload = AuthService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await User.findById(payload.userId);
      if (!user) {
        res.status(401).json({
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN',
            statusCode: 401,
          },
        });
        return;
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = await AuthService.createTokens(user);

      res.json({
        message: 'Tokens refreshed successfully',
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: {
            message: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN',
            statusCode: 401,
          },
        });
        return;
      }
      next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // In a production environment, you would typically:
      // 1. Add the token to a blacklist/revoked tokens list
      // 2. Store blacklisted tokens in Redis with TTL
      // 3. Check blacklist in authentication middleware
      
      logger.info(`User logged out: ${req.user?.email}`);

      res.json({
        message: 'Logout successful',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED',
            statusCode: 401,
          },
        });
        return;
      }

      res.json({
        user: req.user.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // TODO: Implement email verification
      // 1. Generate verification token
      // 2. Send email with verification link
      // 3. Verify token and update user.isEmailVerified
      
      res.status(501).json({
        message: 'Email verification not implemented yet',
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // TODO: Implement password reset
      // 1. Validate email
      // 2. Generate reset token
      // 3. Send reset email
      // 4. Store reset token with expiration
      
      res.status(501).json({
        message: 'Password reset not implemented yet',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // TODO: Implement password reset
      // 1. Validate reset token
      // 2. Validate new password
      // 3. Hash and update password
      // 4. Invalidate reset token
      
      res.status(501).json({
        message: 'Password reset not implemented yet',
      });
    } catch (error) {
      next(error);
    }
  }
}