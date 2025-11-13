import { Response, Request } from 'express';
import { User } from '@/models';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { body, validationResult } from 'express-validator';
import { Session } from '../models/Session';
import { Reservation } from '../models/Reservation';
import { paymentService } from '../services/PaymentService';
import { SessionStatus } from '@chargebd/shared';

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

  /**
   * Get user statistics - sessions, energy usage, payments, reservations
   */
  static async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const userId = req.userId!;

      // Fetch all data in parallel
      const [sessions, reservations, paymentStats] = await Promise.all([
        Session.find({ userId }).populate('stationId', 'name').lean(),
        Reservation.find({ userId }).lean(),
        paymentService.getUserPaymentStats(userId),
      ]);

      // Calculate session statistics
      const activeSessions = sessions.filter(s => s.status === SessionStatus.ACTIVE);
      const completedSessions = sessions.filter(s => s.status === SessionStatus.COMPLETED);
      
      // Calculate total energy used (from completed sessions)
      const totalEnergyKWh = completedSessions.reduce((sum, session) => {
        return sum + (session.totalEnergyKWh || 0);
      }, 0);

      // Calculate favorite stations
      const stationVisits: Record<string, { name: string; count: number; spent: number }> = {};
      
      completedSessions.forEach((session: any) => {
        const stationId = session.stationId?._id?.toString() || session.stationId?.toString();
        const stationName = session.stationId?.name || 'Unknown Station';
        
        if (!stationVisits[stationId]) {
          stationVisits[stationId] = { name: stationName, count: 0, spent: 0 };
        }
        
        stationVisits[stationId].count++;
        stationVisits[stationId].spent += session.totalCostBDT || 0;
      });

      const favoriteStations = Object.entries(stationVisits)
        .map(([id, data]) => ({
          _id: id,
          name: data.name,
          visitCount: data.count,
          totalSpent: data.spent,
        }))
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Build recent activity
      const recentActivity: any[] = [];

      // Add recent completed sessions
      completedSessions
        .sort((a: any, b: any) => {
          const dateA = new Date(a.endTime || a.createdAt).getTime();
          const dateB = new Date(b.endTime || b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 5)
        .forEach((session: any) => {
          recentActivity.push({
            type: 'session',
            title: 'Charging Session Completed',
            description: `${session.totalEnergyKWh?.toFixed(1) || 0} kWh at ${
              session.stationId?.name || 'Unknown Station'
            }`,
            date: session.endTime || session.createdAt,
            amount: session.totalCostBDT,
          });
        });

      // Add recent reservations
      reservations
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 5)
        .forEach((reservation: any) => {
          recentActivity.push({
            type: 'reservation',
            title: 'Reservation Created',
            description: `${reservation.stationId?.name || 'Station'} - ${reservation.connectorType}`,
            date: reservation.createdAt,
          });
        });

      // Sort all activities by date
      recentActivity.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      res.json({
        success: true,
        data: {
          totalSessions: sessions.length,
          completedSessions: completedSessions.length,
          activeSessions: activeSessions.length,
          totalEnergyUsed: totalEnergyKWh,
          totalSpent: paymentStats.totalSpent || 0,
          totalReservations: reservations.length,
          favoriteStations,
          recentActivity: recentActivity.slice(0, 10),
        },
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
}