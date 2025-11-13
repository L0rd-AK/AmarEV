import { Response } from 'express';
import { User } from '../models/User';
import { Station } from '../models/Station';
import { Session } from '../models/Session';
import { Reservation } from '../models/Reservation';
import { Payment } from '../models/Payment';
import { Review } from '../models/Review';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { PaymentStatus, ReservationStatus, SessionStatus, UserStatus } from '@chargebd/shared';

export class AdminController {
  /**
   * Get comprehensive admin dashboard analytics
   */
  static async getDashboardAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, period = 'day' } = req.query;

      // Date filter
      const dateFilter: any = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
      }

      // Parallel fetch all statistics
      const [
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        totalStations,
        activeStations,
        totalConnectors,
        totalSessions,
        activeSessions,
        completedSessions,
        totalReservations,
        activeReservations,
        totalRevenue,
        totalEnergyDelivered,
        averageSessionCost,
        averageSessionDuration,
        totalReviews,
        averageRating,
        userGrowth,
        revenueByPeriod,
        topStations,
        recentUsers,
      ] = await Promise.all([
        // User stats
        User.countDocuments(),
        User.countDocuments({ status: UserStatus.ACTIVE }),
        User.countDocuments({
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 30)),
          },
        }),

        // Station stats
        Station.countDocuments(),
        Station.countDocuments({ isActive: true }),
        Station.aggregate([
          { $unwind: '$connectors' },
          { $count: 'total' },
        ]),

        // Session stats
        Session.countDocuments(dateFilter),
        Session.countDocuments({ ...dateFilter, status: SessionStatus.ACTIVE }),
        Session.countDocuments({ ...dateFilter, status: SessionStatus.COMPLETED }),

        // Reservation stats
        Reservation.countDocuments(dateFilter),
        Reservation.countDocuments({
          ...dateFilter,
          status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        }),

        // Revenue and energy stats
        Payment.aggregate([
          { $match: { ...dateFilter, status: PaymentStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$amountBDT' },
            },
          },
        ]),

        Session.aggregate([
          { $match: { ...dateFilter, status: SessionStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              totalEnergy: { $sum: '$totalEnergyKWh' },
            },
          },
        ]),

        Session.aggregate([
          { $match: { ...dateFilter, status: SessionStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              avgCost: { $avg: '$totalCostBDT' },
            },
          },
        ]),

        Session.aggregate([
          { $match: { ...dateFilter, status: SessionStatus.COMPLETED } },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: { $subtract: ['$endTime', '$startTime'] } },
            },
          },
        ]),

        // Review stats
        Review.countDocuments(dateFilter),
        Review.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
            },
          },
        ]),

        // User growth over time
        User.aggregate([
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          { $limit: 12 },
        ]),

        // Revenue by period
        Payment.aggregate([
          { $match: { status: PaymentStatus.COMPLETED } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: period === 'day' ? { $dayOfMonth: '$createdAt' } : null,
              },
              revenue: { $sum: '$amountBDT' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
          { $limit: 30 },
        ]),

        // Top performing stations
        Session.aggregate([
          { $match: { status: SessionStatus.COMPLETED } },
          {
            $group: {
              _id: '$stationId',
              totalSessions: { $sum: 1 },
              totalRevenue: { $sum: '$totalCostBDT' },
              totalEnergy: { $sum: '$totalEnergyKWh' },
            },
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'stations',
              localField: '_id',
              foreignField: '_id',
              as: 'station',
            },
          },
          { $unwind: '$station' },
        ]),

        // Recent users
        User.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .select('email displayName role status createdAt'),
      ]);

      const analytics = {
        overview: {
          totalUsers,
          activeUsers,
          newUsersThisMonth,
          totalStations,
          activeStations,
          totalConnectors: totalConnectors[0]?.total || 0,
          totalSessions,
          activeSessions,
          completedSessions,
          totalReservations,
          activeReservations,
          totalRevenue: totalRevenue[0]?.totalRevenue || 0,
          totalEnergyDelivered: totalEnergyDelivered[0]?.totalEnergy || 0,
          averageSessionCost: averageSessionCost[0]?.avgCost || 0,
          averageSessionDuration: averageSessionDuration[0]?.avgDuration || 0,
          totalReviews,
          averageRating: averageRating[0]?.avgRating || 0,
        },
        growth: {
          users: userGrowth,
          revenue: revenueByPeriod,
        },
        topStations: topStations.map((s) => ({
          id: s._id,
          name: s.station.name,
          location: `${s.station.address.area}, ${s.station.address.city}`,
          totalSessions: s.totalSessions,
          totalRevenue: s.totalRevenue,
          totalEnergy: s.totalEnergy,
        })),
        recentUsers: recentUsers.map((u) => ({
          id: u._id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          status: u.status,
          joinedAt: u.createdAt,
        })),
      };

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error fetching admin analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all users with pagination and filters
   */
  static async getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const query: any = {};

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
        ];
      }

      if (role) query.role = role;
      if (status) query.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const sort: any = { [sortBy as string]: sortOrder === 'desc' ? -1 : 1 };

      const [users, total] = await Promise.all([
        User.find(query)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .select('-passwordHash'),
        User.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update user status (activate, suspend, deactivate)
   */
  static async updateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!Object.values(UserStatus).includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status value',
        });
        return;
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true }
      ).select('-passwordHash');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      logger.info(`User status updated: ${userId} -> ${status}`);

      res.json({
        success: true,
        message: 'User status updated successfully',
        data: { user },
      });
    } catch (error) {
      logger.error('Error updating user status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system statistics and health
   */
  static async getSystemStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        sessionsLast24h,
        sessionsLast7d,
        sessionsLast30d,
        revenueLast24h,
        revenueLast7d,
        revenueLast30d,
        newUsersLast24h,
        newUsersLast7d,
        newUsersLast30d,
        flaggedReviews,
        pendingReservations,
      ] = await Promise.all([
        Session.countDocuments({ createdAt: { $gte: last24h } }),
        Session.countDocuments({ createdAt: { $gte: last7d } }),
        Session.countDocuments({ createdAt: { $gte: last30d } }),

        Payment.aggregate([
          { $match: { createdAt: { $gte: last24h }, status: PaymentStatus.COMPLETED } },
          { $group: { _id: null, total: { $sum: '$amountBDT' } } },
        ]),

        Payment.aggregate([
          { $match: { createdAt: { $gte: last7d }, status: PaymentStatus.COMPLETED } },
          { $group: { _id: null, total: { $sum: '$amountBDT' } } },
        ]),

        Payment.aggregate([
          { $match: { createdAt: { $gte: last30d }, status: PaymentStatus.COMPLETED } },
          { $group: { _id: null, total: { $sum: '$amountBDT' } } },
        ]),

        User.countDocuments({ createdAt: { $gte: last24h } }),
        User.countDocuments({ createdAt: { $gte: last7d } }),
        User.countDocuments({ createdAt: { $gte: last30d } }),

        Review.countDocuments({ flagged: true }),
        Reservation.countDocuments({ status: ReservationStatus.CONFIRMED }),
      ]);

      res.json({
        success: true,
        data: {
          sessions: {
            last24h: sessionsLast24h,
            last7d: sessionsLast7d,
            last30d: sessionsLast30d,
          },
          revenue: {
            last24h: revenueLast24h[0]?.total || 0,
            last7d: revenueLast7d[0]?.total || 0,
            last30d: revenueLast30d[0]?.total || 0,
          },
          users: {
            newLast24h: newUsersLast24h,
            newLast7d: newUsersLast7d,
            newLast30d: newUsersLast30d,
          },
          alerts: {
            flaggedReviews,
            pendingReservations,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching system stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
