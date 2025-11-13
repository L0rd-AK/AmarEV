import { Worker, Job } from 'bullmq';
import { Reservation } from '../models/Reservation';
import { User } from '../models/User';
import { EmailService } from '../services/EmailService';
import { logger } from '../utils/logger';

interface PaymentReminderJobData {
  reservationId: string;
}

let paymentReminderWorker: Worker<PaymentReminderJobData> | null = null;

/**
 * Initialize worker only if Redis is available
 */
export const initializePaymentReminderWorker = async () => {
  try {
    const { redisConnection } = await import('../config/queue');
    
    if (!redisConnection || redisConnection.status !== 'ready') {
      logger.warn('Redis not available - payment reminder worker will not start');
      return null;
    }

    paymentReminderWorker = new Worker<PaymentReminderJobData>(
  'payment-reminder',
  async (job: Job<PaymentReminderJobData>) => {
    const { reservationId } = job.data;

    try {
      logger.info(`Processing payment reminder for reservation: ${reservationId}`);

      // Find the reservation with populated data
      const reservation = await Reservation.findById(reservationId)
        .populate('userId', 'email displayName')
        .populate('stationId', 'name address')
        .populate('connectorId', 'type standard');

      if (!reservation) {
        logger.warn(`Reservation ${reservationId} not found for reminder`);
        return { success: false, reason: 'Reservation not found' };
      }

      // Check if already paid
      if (reservation.isPaid) {
        logger.info(`Reservation ${reservationId} is already paid, skipping reminder`);
        return { success: true, reason: 'Already paid' };
      }

      // Check if already cancelled or expired
      if (reservation.status === 'canceled' || reservation.status === 'expired') {
        logger.info(`Reservation ${reservationId} is ${reservation.status}, skipping reminder`);
        return { success: true, reason: `Already ${reservation.status}` };
      }

      // Get user details
      const user = reservation.userId as any;
      if (!user || !user.email) {
        logger.warn(`User email not found for reservation ${reservationId}`);
        return { success: false, reason: 'User email not found' };
      }

      // Calculate time remaining
      const now = new Date();
      const deadline = reservation.paymentDeadline || new Date();
      const minutesRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));

      if (minutesRemaining <= 0) {
        logger.info(`Reservation ${reservationId} deadline already passed, skipping reminder`);
        return { success: true, reason: 'Deadline passed' };
      }

      // Send reminder email
      const emailService = new EmailService();
      const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/my-reservations`;
      
      await emailService.sendEmail(
        user.email,
        'Complete Your Payment - Reservation Expiring Soon',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #EF4444;">⏰ Payment Reminder</h2>
            <p>Hi ${user.displayName || 'there'},</p>
            <p>Your reservation at <strong>${(reservation.stationId as any)?.name || 'charging station'}</strong> will expire soon!</p>
            
            <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px;"><strong>Time Remaining: ${minutesRemaining} minutes</strong></p>
              <p style="margin: 10px 0 0 0;">Reservation Amount: ৳${reservation.totalCostBDT?.toFixed(2) || '0.00'}</p>
            </div>

            <p>Please complete your payment to confirm your reservation:</p>
            
            <a href="${paymentUrl}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
              Pay Now
            </a>

            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              If you don't complete the payment within ${minutesRemaining} minutes, your reservation will be automatically cancelled.
            </p>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            
            <p style="color: #999; font-size: 12px;">
              This is an automated message from AmarEV. Please do not reply to this email.
            </p>
          </div>
        `
      );

      logger.info(`Payment reminder sent for reservation ${reservationId} to ${user.email}`);

      return {
        success: true,
        action: 'reminder_sent',
        reservationId,
        userEmail: user.email,
        minutesRemaining,
      };
    } catch (error) {
      logger.error(`Error sending payment reminder for reservation ${reservationId}:`, error);
      throw error;
    }
  },
      { connection: redisConnection, concurrency: 5 }
    );

    // Worker event handlers
    paymentReminderWorker.on('completed', (job: Job<PaymentReminderJobData>, result: any) => {
      logger.info(`Payment reminder job ${job.id} completed:`, result);
    });

    paymentReminderWorker.on('failed', (job: Job<PaymentReminderJobData> | undefined, err: Error) => {
      logger.error(`Payment reminder job ${job?.id} failed:`, err);
    });

    logger.info('✅ Payment reminder worker started');
    return paymentReminderWorker;
  } catch (error) {
    logger.error('Failed to initialize payment reminder worker:', error);
    return null;
  }
};

export { paymentReminderWorker };
export default { initializePaymentReminderWorker };
