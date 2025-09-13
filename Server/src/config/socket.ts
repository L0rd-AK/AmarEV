import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { ConnectorStatus } from '@chargebd/shared';

export interface SocketData {
  userId?: string;
  role?: string;
}

export let io: SocketIOServer;

export const setupSocketIO = (server: SocketIOServer): void => {
  io = server;

  // Public namespace for map and general station updates
  const publicNamespace = io.of('/public');
  
  publicNamespace.on('connection', (socket) => {
    logger.info(`Public client connected: ${socket.id}`);

    socket.on('join_station', (data: { stationId: string }) => {
      const { stationId } = data;
      socket.join(`station:${stationId}`);
      logger.debug(`Client ${socket.id} joined station room: ${stationId}`);
    });

    socket.on('leave_station', (data: { stationId: string }) => {
      const { stationId } = data;
      socket.leave(`station:${stationId}`);
      logger.debug(`Client ${socket.id} left station room: ${stationId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Public client disconnected: ${socket.id}`);
    });
  });

  // User namespace for authenticated user-specific updates
  const userNamespace = io.of('/user');
  
  userNamespace.use(async (socket, next) => {
    try {
      // Extract token from handshake auth
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // TODO: Verify JWT token and extract user data
      // For now, we'll skip authentication middleware setup
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  userNamespace.on('connection', (socket) => {
    logger.info(`User client connected: ${socket.id}`);
    
    const userId = socket.data.userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('subscribe_user', (data: { userId: string }) => {
      const { userId } = data;
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
      logger.debug(`Client ${socket.id} subscribed to user: ${userId}`);
    });

    socket.on('unsubscribe_user', (data: { userId: string }) => {
      const { userId } = data;
      socket.leave(`user:${userId}`);
      logger.debug(`Client ${socket.id} unsubscribed from user: ${userId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`User client disconnected: ${socket.id}`);
    });
  });

  // Operator namespace for station management
  const operatorNamespace = io.of('/operator');
  
  operatorNamespace.use(async (socket, next) => {
    try {
      // TODO: Verify operator/admin role
      next();
    } catch (error) {
      next(new Error('Authorization error'));
    }
  });

  operatorNamespace.on('connection', (socket) => {
    logger.info(`Operator client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Operator client disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.IO configured with multiple namespaces');
};

// Utility functions for broadcasting events
export const broadcastStationStatus = (stationId: string, connectors: Array<{ id: string; status: ConnectorStatus }>) => {
  if (io) {
    io.of('/public').to(`station:${stationId}`).emit('station.status', {
      stationId,
      connectors,
      timestamp: new Date().toISOString(),
    });
  }
};

export const broadcastReservationUpdate = (userId: string, reservation: any) => {
  if (io) {
    io.of('/user').to(`user:${userId}`).emit('reservation.updated', {
      reservation,
      timestamp: new Date().toISOString(),
    });
  }
};

export const broadcastSessionUpdate = (userId: string, session: any) => {
  if (io) {
    io.of('/user').to(`user:${userId}`).emit('session.updated', {
      session,
      timestamp: new Date().toISOString(),
    });
  }
};

export const broadcastPricingUpdate = (stationId: string, window: any) => {
  if (io) {
    io.of('/public').to(`station:${stationId}`).emit('pricing.updated', {
      stationId,
      window,
      timestamp: new Date().toISOString(),
    });
  }
};