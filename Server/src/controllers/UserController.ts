import { Response, Request } from 'express';
import { User } from '@/models';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { body, validationResult } from 'express-validator';

export class UserController {
  /**
   * Get user profile
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

      const user = req.user;

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

  /**
   * Update user profile
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => ({
            field: err.type === 'field' ? (err as any).path : 'unknown',
            message: err.msg
          }))
        });
        return;
      }

      const { displayName, phone, language } = req.body;

      // Get user from request (populated by auth middleware)
      const user = req.user;

      // Update fields if provided
      if (displayName !== undefined) {
        user.displayName = displayName.trim();
      }
      if (phone !== undefined) {
        user.phone = phone.trim() || undefined;
      }
      if (language !== undefined) {
        user.language = language;
      }

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
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
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Validation middleware for profile update
   */
  static validateProfileUpdate = [
    body('displayName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Display name must be between 2 and 100 characters'),
    
    body('phone')
      .optional()
      .isString()
      .trim()
      .matches(/^\+?[\d\s\-\(\)]+$/)
      .withMessage('Please enter a valid phone number')
      .isLength({ max: 20 })
      .withMessage('Phone number must be less than 20 characters'),
    
    body('language')
      .optional()
      .isIn(['en', 'bn'])
      .withMessage('Language must be either "en" or "bn"'),
  ];
}