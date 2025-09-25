import { Request, Response, NextFunction } from 'express';
import { jwtService } from '@/utils/jwt';
import { User } from '@/models/User';
import { UserRole, UserStatus } from '@chargebd/shared';
import { logger } from '@/utils/logger';

// Extend Express Request type to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      email: string;
      role: UserRole;
    };
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false,
        message: 'Access token required' 
      });
      return;
    }

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      res.status(401).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(403).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
    return;
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuthentication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next(); // Continue without user
      return;
    }

    const decoded = jwtService.verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    
    if (user && user.status === UserStatus.ACTIVE) {
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }

    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions' 
      });
      return;
    }

    next();
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Operator or admin middleware
 */
export const requireOperatorOrAdmin = authorize(UserRole.OPERATOR, UserRole.ADMIN);

/**
 * Authenticated user middleware (any role)
 */
export const requireAuth = authenticateToken;

/**
 * Check if user owns resource or is admin
 */
export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ 
          success: false,
          message: 'Authentication required' 
        });
        return;
      }

      // Admin can access any resource
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      // Get resource user ID from request (params, body, or query)
      const resourceUserId = req.params[resourceUserIdField] || 
                           req.body[resourceUserIdField] || 
                           req.query[resourceUserIdField];

      if (!resourceUserId) {
        res.status(400).json({ 
          success: false,
          message: 'Resource user ID not provided' 
        });
        return;
      }

      // Check ownership
      if (req.user.userId !== resourceUserId) {
        res.status(403).json({ 
          success: false,
          message: 'Access denied - not resource owner' 
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error' 
      });
      return;
    }
  };
};

/**
 * Rate limiting middleware for authentication routes
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    const record = attempts.get(key);
    
    if (!record || now > record.resetTime) {
      // First attempt or window expired
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    // Increment attempt count
    record.count++;
    next();
  };
};

/**
 * Validate email verification status
 */
export const requireEmailVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user || !user.isEmailVerified) {
      res.status(403).json({ 
        success: false,
        message: 'Email verification required' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Email verification check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
    return;
  }
};

/**
 * Check account status (not suspended/banned)
 */
export const checkAccountStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    if (user.status === UserStatus.SUSPENDED) {
      res.status(403).json({ 
        success: false,
        message: 'Account suspended' 
      });
      return;
    }

    if (user.status === UserStatus.INACTIVE) {
      res.status(403).json({ 
        success: false,
        message: 'Account inactive' 
      });
      return;
    }

    if (user.isAccountLocked()) {
      res.status(403).json({ 
        success: false,
        message: 'Account locked due to multiple failed login attempts' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Account status check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
    return;
  }
};