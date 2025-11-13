import { Response } from 'express';
import { Review } from '../models/Review';
import { Station } from '../models/Station';
import { Session } from '../models/Session';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class ReviewController {
  /**
   * Get all reviews for a specific station
   */
  static async getStationReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { stationId } = req.params;
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      if (!mongoose.Types.ObjectId.isValid(stationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid station ID',
        });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const sort: any = { [sortBy as string]: sortOrder === 'desc' ? -1 : 1 };

      const [reviews, total, stats] = await Promise.all([
        Review.find({ stationId, flagged: false })
          .populate('userId', 'displayName email')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit)),
        Review.countDocuments({ stationId, flagged: false }),
        Review.aggregate([
          { $match: { stationId: new mongoose.Types.ObjectId(stationId), flagged: false } },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
              ratingDistribution: {
                $push: '$rating',
              },
            },
          },
        ]),
      ]);

      // Calculate rating distribution
      let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      if (stats.length > 0 && stats[0].ratingDistribution) {
        stats[0].ratingDistribution.forEach((rating: number) => {
          ratingDistribution[rating as keyof typeof ratingDistribution]++;
        });
      }

      res.json({
        success: true,
        data: {
          reviews,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
          statistics: {
            averageRating: stats[0]?.averageRating || 0,
            totalReviews: stats[0]?.totalReviews || 0,
            ratingDistribution,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching station reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create a new review for a station
   */
  static async createReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { stationId } = req.params;
      const { rating, comment, photos } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(stationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid station ID',
        });
        return;
      }

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5',
        });
        return;
      }

      // Check if station exists
      const station = await Station.findById(stationId);
      if (!station) {
        res.status(404).json({
          success: false,
          message: 'Station not found',
        });
        return;
      }

      // Check if user has completed a session at this station
      const hasSession = await Session.findOne({
        userId,
        stationId,
        status: 'COMPLETED',
      });

      if (!hasSession) {
        res.status(403).json({
          success: false,
          message: 'You can only review stations where you have completed a charging session',
        });
        return;
      }

      // Check if user already reviewed this station
      const existingReview = await Review.findOne({ userId, stationId });
      if (existingReview) {
        res.status(400).json({
          success: false,
          message: 'You have already reviewed this station. You can update your existing review.',
        });
        return;
      }

      // Create review
      const review = await Review.create({
        userId,
        stationId,
        rating,
        comment,
        photos: photos || [],
      });

      await review.populate('userId', 'displayName email');

      logger.info(`New review created for station ${stationId} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: { review },
      });
    } catch (error) {
      logger.error('Error creating review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create review',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all reviews by the authenticated user
   */
  static async getUserReviews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const reviews = await Review.find({ userId })
        .populate('stationId', 'name address')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: { reviews },
      });
    } catch (error) {
      logger.error('Error fetching user reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reviews',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update an existing review
   */
  static async updateReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rating, comment, photos } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid review ID',
        });
        return;
      }

      const review = await Review.findById(id);

      if (!review) {
        res.status(404).json({
          success: false,
          message: 'Review not found',
        });
        return;
      }

      // Check if user owns the review
      if (review.userId.toString() !== userId.toString()) {
        res.status(403).json({
          success: false,
          message: 'You can only update your own reviews',
        });
        return;
      }

      // Update review fields
      if (rating !== undefined) {
        if (rating < 1 || rating > 5) {
          res.status(400).json({
            success: false,
            message: 'Rating must be between 1 and 5',
          });
          return;
        }
        review.rating = rating;
      }

      if (comment !== undefined) review.comment = comment;
      if (photos !== undefined) review.photos = photos;

      await review.save();
      await review.populate('userId', 'displayName email');

      logger.info(`Review ${id} updated by user ${userId}`);

      res.json({
        success: true,
        message: 'Review updated successfully',
        data: { review },
      });
    } catch (error) {
      logger.error('Error updating review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update review',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete a review
   */
  static async deleteReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?._id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid review ID',
        });
        return;
      }

      const review = await Review.findById(id);

      if (!review) {
        res.status(404).json({
          success: false,
          message: 'Review not found',
        });
        return;
      }

      // Users can delete own reviews, admins can delete any review
      if (review.userId.toString() !== userId.toString() && userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'You can only delete your own reviews',
        });
        return;
      }

      await review.deleteOne();

      logger.info(`Review ${id} deleted by user ${userId}`);

      res.json({
        success: true,
        message: 'Review deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete review',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Flag a review as inappropriate (Admin only)
   */
  static async flagReview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid review ID',
        });
        return;
      }

      const review = await Review.findById(id);

      if (!review) {
        res.status(404).json({
          success: false,
          message: 'Review not found',
        });
        return;
      }

      review.flagged = true;
      review.flaggedReason = reason;
      await review.save();

      logger.info(`Review ${id} flagged: ${reason}`);

      res.json({
        success: true,
        message: 'Review flagged successfully',
        data: { review },
      });
    } catch (error) {
      logger.error('Error flagging review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to flag review',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get review statistics for a station
   */
  static async getReviewStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { stationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(stationId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid station ID',
        });
        return;
      }

      const stats = await Review.aggregate([
        {
          $match: {
            stationId: new mongoose.Types.ObjectId(stationId),
            flagged: false,
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            ratings: { $push: '$rating' },
          },
        },
      ]);

      if (stats.length === 0) {
        res.json({
          success: true,
          data: {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          },
        });
        return;
      }

      // Calculate rating distribution
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      stats[0].ratings.forEach((rating: number) => {
        ratingDistribution[rating as keyof typeof ratingDistribution]++;
      });

      res.json({
        success: true,
        data: {
          averageRating: stats[0].averageRating,
          totalReviews: stats[0].totalReviews,
          ratingDistribution,
        },
      });
    } catch (error) {
      logger.error('Error fetching review stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch review statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
