import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first, before any other imports
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { setupSocketIO } from '@/config/socket';
import { errorHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { authRoutes } from '@/routes/auth';
import { userRoutes } from '@/routes/users';
import { stationRoutes } from '@/routes/stations';
import { vehicleRoutes } from '@/routes/vehicles';
import { reservationRoutes } from '@/routes/reservations';
import { sessionRoutes } from '@/routes/sessions';
import paymentRoutes from '@/routes/payments';
import routeRoutes from '@/routes/routes';
import { reviewRoutes } from '@/routes/reviews';
import { adminRoutes } from '@/routes/admin';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.BASE_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.BASE_URL,
      'http://localhost:3000',
      'http://localhost:3001',  // Additional port for client
      'http://localhost:5173',
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('✅ MongoDB connected successfully');

    // Connect to Redis (optional for development)
    try {
      await connectRedis();
      logger.info('✅ Redis connected successfully');
      
      // Initialize background workers (only if Redis is available)
      const { initializeWorkers } = await import('@/jobs');
      await initializeWorkers();
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        logger.warn('⚠️ Redis is not available - continuing without Redis');
        logger.warn('⚠️ Payment timeout and reminder features will be disabled');
      } else {
        logger.error('❌ Redis connection error:', error);
        throw error;
      }
    }

    // Setup Socket.IO
    setupSocketIO(io);
    logger.info('✅ Socket.IO configured successfully');

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📱 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🌐 CORS origin: ${process.env.BASE_URL}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Start the server
startServer();