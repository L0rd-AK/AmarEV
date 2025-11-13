import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { User, UserDocument } from '@/models/User';
import { UserRole, TokenType } from '@chargebd/shared';
import { logger } from '@/utils/logger';
import { jwtService } from '@/utils/jwt';

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: UserDocument;
  userId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  type?: TokenType;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static get JWT_SECRET(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return secret;
  }

  private static get JWT_REFRESH_SECRET(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }
    return secret;
  }

  private static readonly TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): string {
    const fullPayload = { ...payload, type: TokenType.ACCESS };
    return jwt.sign(fullPayload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_EXPIRES_IN,
    } as any);
  }

  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'type'>): string {
    const fullPayload = { ...payload, type: TokenType.REFRESH };
    return jwt.sign(fullPayload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
    } as any);
  }

  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      
      // Log the decoded token for debugging
      logger.debug('Token decoded successfully', {
        userId: decoded.userId,
        type: decoded.type,
        exp: decoded.exp
      });
      
      return decoded;
    } catch (error: any) {
      logger.error('JWT verification failed in AuthService', {
        errorName: error.name,
        errorMessage: error.message,
        tokenPreview: token.substring(0, 30) + '...',
        secret: 'JWT_SECRET is ' + (this.JWT_SECRET ? 'defined' : 'undefined')
      });
      throw error;
    }
  }

  static verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_REFRESH_SECRET) as JWTPayload;
  }

  static async createTokens(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      userId: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return { accessToken, refreshToken };
  }
}

// Authentication middleware
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: {
          message: 'Access token is required',
          code: 'MISSING_TOKEN',
          statusCode: 401,
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token format
    if (!token || token.length < 10) {
      logger.warn('Invalid token format received', {
        tokenPreview: token?.substring(0, 20) || 'empty',
        tokenLength: token?.length || 0
      });
      res.status(401).json({
        success: false,
        message: 'Invalid token format',
        error: {
          message: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT',
          statusCode: 401,
        },
      });
      return;
    }

    try {
      // Use jwtService for verification (consistent with token generation)
      const payload = jwtService.verifyAccessToken(token);
      
      // Fetch user from database
      const user = await User.findById(payload.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid token - user not found',
          error: {
            message: 'Invalid token - user not found',
            code: 'INVALID_TOKEN',
            statusCode: 401,
          },
        });
        return;
      }

      req.user = user;
      req.userId = (user._id as any).toString();
      next();
    } catch (jwtError: any) {
      const errorMessage = jwtError.name === 'TokenExpiredError' 
        ? 'Token has expired' 
        : jwtError.name === 'JsonWebTokenError'
        ? 'Token is malformed or invalid'
        : 'Invalid token';
      
      logger.warn('JWT verification failed', {
        errorName: jwtError.name,
        errorMessage: jwtError.message,
        tokenPreview: token.substring(0, 20) + '...',
      });
      
      res.status(401).json({
        success: false,
        message: errorMessage,
        error: {
          message: errorMessage,
          code: jwtError.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
          statusCode: 401,
        },
      });
      return;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: {
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        statusCode: 500,
      },
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = AuthService.verifyAccessToken(token);
      const user = await User.findById(payload.userId);
      
      if (user) {
        req.user = user;
        req.userId = (user._id as any).toString();
      }
    } catch (jwtError) {
      // Ignore JWT errors in optional authentication
      logger.debug('Optional JWT verification failed:', jwtError);
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401,
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          statusCode: 403,
        },
      });
      return;
    }

    next();
  };
};

// Check if user owns resource or is admin/operator
export const authorizeOwnerOrRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          statusCode: 401,
        },
      });
      return;
    }

    const resourceUserId = req.params.userId || req.body.userId;
    const isOwner = resourceUserId === req.userId;
    const hasRole = roles.includes(req.user.role);

    if (!isOwner && !hasRole) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED',
          statusCode: 403,
        },
      });
      return;
    }

    next();
  };
};