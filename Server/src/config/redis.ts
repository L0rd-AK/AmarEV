import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

export let redisClient: RedisClientType;

export const connectRedis = async (): Promise<void> => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: isDevelopment ? false : (retries) => Math.min(retries * 50, 1000),
        connectTimeout: isDevelopment ? 2000 : 30000,
      },
    });

    redisClient.on('error', (error) => {
      if (isDevelopment) {
        logger.warn('Redis not available in development mode:', error.message);
      } else {
        logger.error('Redis client error:', error);
      }
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
      if (!isDevelopment) {
        logger.info('Redis client reconnecting');
      }
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection ended');
    });

    await redisClient.connect();
    logger.info('✅ Redis connected successfully');
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      logger.warn('Redis not available in development mode - caching will be disabled');
      redisClient = null as any; // Set to null to indicate Redis is not available
      return; // Don't throw in development
    } else {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis disconnected successfully');
    }
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
    throw error;
  }
};

// Utility functions for Redis operations
export const setCache = async (key: string, value: string, ttl?: number): Promise<void> => {
  try {
    if (!redisClient) {
      // Redis not available, skip caching
      return;
    }
    if (ttl) {
      await redisClient.setEx(key, ttl, value);
    } else {
      await redisClient.set(key, value);
    }
  } catch (error) {
    logger.error('Error setting cache:', error);
    // Don't throw in development if Redis is unavailable
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }
};

export const getCache = async (key: string): Promise<string | null> => {
  try {
    if (!redisClient) {
      // Redis not available, return null (cache miss)
      return null;
    }
    return await redisClient.get(key);
  } catch (error) {
    logger.error('Error getting cache:', error);
    // Don't throw in development if Redis is unavailable
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    if (!redisClient) {
      // Redis not available, skip deletion
      return;
    }
    await redisClient.del(key);
  } catch (error) {
    logger.error('Error deleting cache:', error);
    // Don't throw in development if Redis is unavailable
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }
};

export const publish = async (channel: string, message: string): Promise<void> => {
  try {
    if (!redisClient) {
      // Redis not available, skip publishing
      return;
    }
    await redisClient.publish(channel, message);
  } catch (error) {
    logger.error('Error publishing message:', error);
    // Don't throw in development if Redis is unavailable
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }
};