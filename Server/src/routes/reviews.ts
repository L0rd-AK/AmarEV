import { Router } from 'express';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth';
import { ReviewController } from '../controllers/ReviewController';
import { UserRole } from '@chargebd/shared';

export const reviewRoutes = Router();

reviewRoutes.get('/station/:stationId', optionalAuthenticate, ReviewController.getStationReviews);
reviewRoutes.get('/station/:stationId/stats', ReviewController.getReviewStats);
reviewRoutes.post('/station/:stationId', authenticate, ReviewController.createReview);
reviewRoutes.get('/', authenticate, ReviewController.getUserReviews);
reviewRoutes.put('/:id', authenticate, ReviewController.updateReview);
reviewRoutes.delete('/:id', authenticate, ReviewController.deleteReview);
reviewRoutes.put('/:id/flag', authenticate, authorize(UserRole.ADMIN), ReviewController.flagReview);
