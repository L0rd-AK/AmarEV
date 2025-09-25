import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload, TokenType, UserRole } from '@chargebd/shared';
import { RefreshToken, RefreshTokenDocument } from '@/models/RefreshToken';
import { logger } from '@/utils/logger';

interface TokenOptions {
  expiresIn?: string | number;
  audience?: string;
  issuer?: string;
}

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly defaultAccessTokenExpiry = '15m';
  private readonly defaultRefreshTokenExpiry = '7d';

  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'fallback-secret';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT secrets must be provided in production');
      }
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId: string, email: string, role: UserRole, options: TokenOptions = {}): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role,
      type: TokenType.ACCESS,
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || this.defaultAccessTokenExpiry,
      audience: options.audience,
      issuer: options.issuer,
    };

    return jwt.sign(payload, this.accessTokenSecret, tokenOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, email: string, role: UserRole, options: TokenOptions = {}): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role,
      type: TokenType.REFRESH,
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || this.defaultRefreshTokenExpiry,
      audience: options.audience,
      issuer: options.issuer,
    };

    return jwt.sign(payload, this.refreshTokenSecret, tokenOptions);
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      if (decoded.type !== TokenType.ACCESS) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.error('Access token verification failed:', error);
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as JWTPayload;
      
      if (decoded.type !== TokenType.REFRESH) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(userId: string, email: string, role: UserRole) {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(userId, email, role);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(userId: string, token: string, expiresIn: string = this.defaultRefreshTokenExpiry): Promise<RefreshTokenDocument> {
    try {
      // Calculate expiration date
      const expiresAt = this.calculateExpirationDate(expiresIn);

      // Remove existing refresh tokens for this user (optional - for single session)
      // await RefreshToken.deleteMany({ userId });

      // Store new refresh token
      const refreshTokenDoc = new RefreshToken({
        userId,
        token,
        expiresAt,
      });

      await refreshTokenDoc.save();
      logger.info(`Refresh token stored for user ${userId}`);
      
      return refreshTokenDoc;
    } catch (error) {
      logger.error('Error storing refresh token:', error);
      throw new Error('Failed to store refresh token');
    }
  }

  /**
   * Remove refresh token from database
   */
  async removeRefreshToken(token: string): Promise<void> {
    try {
      await RefreshToken.deleteOne({ token });
      logger.info('Refresh token removed');
    } catch (error) {
      logger.error('Error removing refresh token:', error);
      throw new Error('Failed to remove refresh token');
    }
  }

  /**
   * Remove all refresh tokens for a user
   */
  async removeAllRefreshTokens(userId: string): Promise<void> {
    try {
      await RefreshToken.deleteMany({ userId });
      logger.info(`All refresh tokens removed for user ${userId}`);
    } catch (error) {
      logger.error('Error removing refresh tokens:', error);
      throw new Error('Failed to remove refresh tokens');
    }
  }

  /**
   * Verify refresh token exists in database
   */
  async verifyStoredRefreshToken(token: string): Promise<RefreshTokenDocument | null> {
    try {
      const storedToken = await RefreshToken.findOne({ token });
      
      if (!storedToken) {
        return null;
      }

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        await this.removeRefreshToken(token);
        return null;
      }

      return storedToken;
    } catch (error) {
      logger.error('Error verifying stored refresh token:', error);
      return null;
    }
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId: string, email: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role: UserRole.USER, // Default role for verification
      type: TokenType.EMAIL_VERIFICATION,
    };

    return jwt.sign(payload, this.accessTokenSecret, { expiresIn: '24h' });
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId: string, email: string): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role: UserRole.USER, // Default role for reset
      type: TokenType.PASSWORD_RESET,
    };

    return jwt.sign(payload, this.accessTokenSecret, { expiresIn: '1h' });
  }

  /**
   * Verify email verification token
   */
  verifyEmailVerificationToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      if (decoded.type !== TokenType.EMAIL_VERIFICATION) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.error('Email verification token verification failed:', error);
      throw new Error('Invalid email verification token');
    }
  }

  /**
   * Verify password reset token
   */
  verifyPasswordResetToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      if (decoded.type !== TokenType.PASSWORD_RESET) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      logger.error('Password reset token verification failed:', error);
      throw new Error('Invalid password reset token');
    }
  }

  /**
   * Generate secure random token (for non-JWT tokens)
   */
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Calculate expiration date from expiry string
   */
  private calculateExpirationDate(expiresIn: string): Date {
    const now = new Date();
    const expiry = this.parseExpiryString(expiresIn);
    return new Date(now.getTime() + expiry);
  }

  /**
   * Parse expiry string to milliseconds
   */
  private parseExpiryString(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiry format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error('Invalid expiry unit');
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();