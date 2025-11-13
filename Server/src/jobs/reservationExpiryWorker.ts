import { Worker, Job } from 'bullmq';
import { Reservation } from '../models/Reservation';
import { ReservationStatus } from '@chargebd/shared';
import { logger } from '../utils/logger';

interface ReservationExpiryJobData {
  reservationId: string;
}

let reservationExpiryWorker: Worker<ReservationExpiryJobData> | null = null;

/**
 * Initialize worker only if Redis is available
 */
export const initializeReservationExpiryWorker = async () => {
  try {
    const { redisConnection } = await import('../config/queue');
    
    if (!redisConnection || redisConnection.status !== 'ready') {
      logger.warn('Redis not available - reservation expiry worker will not start');
      return null;
    }

    reservationExpiryWorker = new Worker<ReservationExpiryJobData>(
  'reservation-expiry',
  async (job: Job<ReservationExpiryJobData>) => {
    const { reservationId } = job.data;

    try {
      logger.info(`Processing expiry check for reservation: ${reservationId}`);

      // Find the reservation
      const reservation = await Reservation.findById(reservationId);

      if (!reservation) {
        logger.warn(`Reservation ${reservationId} not found`);
        return { success: false, reason: 'Reservation not found' };
      }

      // Check if already paid
      if (reservation.isPaid) {
        logger.info(`Reservation ${reservationId} is already paid, skipping expiry`);
        return { success: true, reason: 'Already paid' };
      }

      // Check if already cancelled or expired
      if (
        reservation.status === ReservationStatus.CANCELED ||
        reservation.status === ReservationStatus.EXPIRED
      ) {
        logger.info(`Reservation ${reservationId} is already ${reservation.status}`);
        return { success: true, reason: `Already ${reservation.status}` };
      }

      // Check if payment deadline has passed
      const now = new Date();
      if (reservation.paymentDeadline && now >= reservation.paymentDeadline) {
        // Cancel the reservation due to non-payment
        reservation.status = ReservationStatus.EXPIRED;
        reservation.paymentStatus = 'expired';
        await reservation.save();

        logger.info(`Reservation ${reservationId} expired due to non-payment`);

        // TODO: Send email notification to user
        // You can add this to the email queue
        // await emailQueue.add('reservation-expired', {
        //   userId: reservation.userId,
        //   reservationId: reservation._id,
        // });

        return {
          success: true,
          action: 'expired',
          reservationId,
          reason: 'Payment deadline exceeded',
        };
      } else {
        logger.info(
          `Reservation ${reservationId} payment deadline not yet reached (deadline: ${reservation.paymentDeadline})`
        );
        return {
          success: true,
          reason: 'Deadline not yet reached',
        };
      }
    } catch (error) {
      logger.error(`Error processing expiry for reservation ${reservationId}:`, error);
      throw error; // This will trigger retry
    }
  },
      { connection: redisConnection, concurrency: 5 }
    );

    // Worker event handlers
    reservationExpiryWorker.on('completed', (job: Job<ReservationExpiryJobData>, result: any) => {
      logger.info(`Reservation expiry job ${job.id} completed:`, result);
    });

    reservationExpiryWorker.on('failed', (job: Job<ReservationExpiryJobData> | undefined, err: Error) => {
      logger.error(`Reservation expiry job ${job?.id} failed:`, err);
    });

    reservationExpiryWorker.on('error', (err: Error) => {
      logger.error('Reservation expiry worker error:', err);
    });

    logger.info('✅ Reservation expiry worker started');
    return reservationExpiryWorker;
  } catch (error) {
    logger.error('Failed to initialize reservation expiry worker:', error);
    return null;
  }
};

export { reservationExpiryWorker };
export default { initializeReservationExpiryWorker };
