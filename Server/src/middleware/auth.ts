import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { User, UserDocument } from '@/models/User';
import { UserRole } from '@chargebd/shared';
import { logger } from '@/utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: UserDocument;
  userId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET!;
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private static readonly TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.TOKEN_EXPIRES_IN,
    });
  }

  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRES_IN,
    });
  }

  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
  }

  static verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, this.JWT_REFRESH_SECRET) as JWTPayload;
  }

  static async createTokens(user: UserDocument): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      userId: user._id.toString(),
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
        error: {
          message: 'Access token is required',
          code: 'MISSING_TOKEN',
          statusCode: 401,
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const payload = AuthService.verifyAccessToken(token);
      
      // Fetch user from database
      const user = await User.findById(payload.userId);
      if (!user) {
        res.status(401).json({
          error: {
            message: 'Invalid token - user not found',
            code: 'INVALID_TOKEN',
            statusCode: 401,
          },
        });
        return;
      }

      req.user = user;
      req.userId = user._id.toString();
      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      res.status(401).json({
        error: {
          message: 'Invalid or expired access token',
          code: 'TOKEN_INVALID',
          statusCode: 401,
        },
      });
      return;
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
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
        req.userId = user._id.toString();
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