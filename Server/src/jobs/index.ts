/**
 * Worker initialization
 * Starts all background job workers (only if Redis is available)
 */
import { logger } from '../utils/logger';

let reservationExpiryWorker: any = null;
let paymentReminderWorker: any = null;

/**
 * Initialize all background workers
 * This function should be called after Redis connection is established
 */
export const initializeWorkers = async () => {
  try {
    // Try to import worker initialization functions
    const { initializeReservationExpiryWorker } = await import('./reservationExpiryWorker');
    const { initializePaymentReminderWorker } = await import('./paymentReminderWorker');
    
    // Initialize workers (they will check Redis availability internally)
    reservationExpiryWorker = await initializeReservationExpiryWorker();
    paymentReminderWorker = await initializePaymentReminderWorker();
    
    if (reservationExpiryWorker && paymentReminderWorker) {
      logger.info('✅ Background workers initialized successfully');
    } else {
      logger.warn('⚠️ Background workers not started - Redis is not available');
      logger.warn('⚠️ Payment timeout and reminder features are disabled');
    }
  } catch (error: any) {
    logger.error('❌ Failed to initialize background workers:', error.message);
    logger.warn('⚠️ Payment timeout and reminder features are disabled');
  }
};

export { reservationExpiryWorker, paymentReminderWorker };

// Graceful shutdown handling
const shutdown = async () => {
  logger.info('Shutting down workers...');
  
  try {
    if (reservationExpiryWorker) await reservationExpiryWorker.close();
    if (paymentReminderWorker) await paymentReminderWorker.close();
    logger.info('All workers closed gracefully');
  } catch (error) {
    logger.error('Error closing workers:', error);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
