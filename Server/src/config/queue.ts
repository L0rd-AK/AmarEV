import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';

// Redis connection configuration
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true, // Don't connect immediately
  retryStrategy: (times) => {
    if (times > 3) {
      logger.warn('Redis connection failed after 3 attempts - queues will be disabled');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 2000);
  },
});

let redisAvailable = false;

redisConnection.on('connect', () => {
  logger.info('Redis connected for BullMQ');
  redisAvailable = true;
});

redisConnection.on('error', (err) => {
  logger.warn('Redis connection error - queues will be disabled:', err.message);
  redisAvailable = false;
});

// Try to connect
redisConnection.connect().catch((err) => {
  logger.warn('Redis not available - payment timeout features will be disabled:', err.message);
  redisAvailable = false;
});

// Queue options
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Create queues conditionally
export let reservationExpiryQueue: Queue | null = null;
export let paymentReminderQueue: Queue | null = null;
export let emailQueue: Queue | null = null;

// Initialize queues after a short delay to allow Redis connection
setTimeout(() => {
  if (redisAvailable) {
    try {
      reservationExpiryQueue = new Queue('reservation-expiry', defaultQueueOptions);
      paymentReminderQueue = new Queue('payment-reminder', defaultQueueOptions);
      emailQueue = new Queue('email', defaultQueueOptions);
      logger.info('BullMQ queues initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize BullMQ queues:', error);
    }
  } else {
    logger.warn('BullMQ queues not initialized - Redis is not available');
    logger.warn('Payment timeout and reminder features are disabled');
  }
}, 2000);

/**
 * Check if Redis is available and connected
 * @returns true if Redis is available, false otherwise
 */
export const isRedisAvailable = (): boolean => {
  return redisAvailable && redisConnection.status === 'ready';
};

export { redisConnection };
