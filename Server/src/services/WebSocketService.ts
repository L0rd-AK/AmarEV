import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { User, UserDocument } from '../models/User';
import { Station } from '../models/Station';
import { Connector } from '../models/Connector';
import { Reservation } from '../models/Reservation';
import { Session } from '../models/Session';
import { UserRole, StationStatus, ConnectorStatus, ReservationStatus, SessionStatus } from '@chargebd/shared';
import { logger } from '../utils/logger';

export interface AuthenticatedSocket extends Socket {
  user?: UserDocument;
  userId?: string;
}

export interface SocketEvents {
  // Client to Server
  'auth': (token: string) => void;
  'join:station': (stationId: string) => void;
  'leave:station': (stationId: string) => void;
  'join:reservation': (reservationId: string) => void;
  'leave:reservation': (reservationId: string) => void;
  'join:session': (sessionId: string) => void;
  'leave:session': (sessionId: string) => void;
  'station:status:update': (stationId: string, status: StationStatus) => void;
  'connector:status:update': (connectorId: string, status: ConnectorStatus) => void;
  'session:start': (sessionData: any) => void;
  'session:stop': (sessionId: string) => void;

  // Server to Client
  'authenticated': (userData: any) => void;
  'auth:error': (error: string) => void;
  'station:updated': (stationData: any) => void;
  'connector:updated': (connectorData: any) => void;
  'reservation:updated': (reservationData: any) => void;
  'session:updated': (sessionData: any) => void;
  'notification': (notification: any) => void;
  'error': (error: string) => void;
}

export class WebSocketService {
  private io: SocketIOServer;
  private authenticatedSockets: Map<string, AuthenticatedSocket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Client connected: ${socket.id}`);

      // Authentication
      socket.on('auth', async (token: string) => {
        try {
          await this.authenticateSocket(socket, token);
        } catch (error) {
          logger.error('Socket authentication error:', error);
          socket.emit('auth:error', 'Authentication failed');
        }
      });

      // Station events
      socket.on('join:station', async (stationId: string) => {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        try {
          await socket.join(`station:${stationId}`);
          logger.info(`User ${socket.userId} joined station room: ${stationId}`);
        } catch (error) {
          logger.error('Error joining station room:', error);
          socket.emit('error', 'Failed to join station room');
        }
      });

      socket.on('leave:station', async (stationId: string) => {
        try {
          await socket.leave(`station:${stationId}`);
          logger.info(`User ${socket.userId} left station room: ${stationId}`);
        } catch (error) {
          logger.error('Error leaving station room:', error);
        }
      });

      // Reservation events
      socket.on('join:reservation', async (reservationId: string) => {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        try {
          const reservation = await Reservation.findById(reservationId);
          if (!reservation) {
            socket.emit('error', 'Reservation not found');
            return;
          }

          // Check if user has access to this reservation
          if (
            reservation.userId.toString() !== socket.userId &&
            socket.user.role !== UserRole.ADMIN &&
            socket.user.role !== UserRole.OPERATOR
          ) {
            socket.emit('error', 'Access denied');
            return;
          }

          await socket.join(`reservation:${reservationId}`);
          logger.info(`User ${socket.userId} joined reservation room: ${reservationId}`);
        } catch (error) {
          logger.error('Error joining reservation room:', error);
          socket.emit('error', 'Failed to join reservation room');
        }
      });

      socket.on('leave:reservation', async (reservationId: string) => {
        try {
          await socket.leave(`reservation:${reservationId}`);
          logger.info(`User ${socket.userId} left reservation room: ${reservationId}`);
        } catch (error) {
          logger.error('Error leaving reservation room:', error);
        }
      });

      // Session events
      socket.on('join:session', async (sessionId: string) => {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        try {
          const session = await Session.findById(sessionId);
          if (!session) {
            socket.emit('error', 'Session not found');
            return;
          }

          // Check if user has access to this session
          if (
            session.userId.toString() !== socket.userId &&
            socket.user.role !== UserRole.ADMIN &&
            socket.user.role !== UserRole.OPERATOR
          ) {
            socket.emit('error', 'Access denied');
            return;
          }

          await socket.join(`session:${sessionId}`);
          logger.info(`User ${socket.userId} joined session room: ${sessionId}`);
        } catch (error) {
          logger.error('Error joining session room:', error);
          socket.emit('error', 'Failed to join session room');
        }
      });

      socket.on('leave:session', async (sessionId: string) => {
        try {
          await socket.leave(`session:${sessionId}`);
          logger.info(`User ${socket.userId} left session room: ${sessionId}`);
        } catch (error) {
          logger.error('Error leaving session room:', error);
        }
      });

      // Operator/Admin events
      socket.on('station:status:update', async (stationId: string, status: StationStatus) => {
        if (!socket.user || (socket.user.role !== UserRole.ADMIN && socket.user.role !== UserRole.OPERATOR)) {
          socket.emit('error', 'Access denied');
          return;
        }

        try {
          const station = await Station.findById(stationId);
          if (!station) {
            socket.emit('error', 'Station not found');
            return;
          }

          station.status = status;
          await station.save();

          // Broadcast to all clients in this station room
          this.io.to(`station:${stationId}`).emit('station:updated', {
            stationId,
            status,
            updatedAt: new Date(),
            updatedBy: socket.userId,
          });

          logger.info(`Station ${stationId} status updated to ${status} by ${socket.userId}`);
        } catch (error) {
          logger.error('Error updating station status:', error);
          socket.emit('error', 'Failed to update station status');
        }
      });

      socket.on('connector:status:update', async (connectorId: string, status: ConnectorStatus) => {
        if (!socket.user || (socket.user.role !== UserRole.ADMIN && socket.user.role !== UserRole.OPERATOR)) {
          socket.emit('error', 'Access denied');
          return;
        }

        try {
          const connector = await Connector.findById(connectorId).populate('stationId');
          if (!connector) {
            socket.emit('error', 'Connector not found');
            return;
          }

          connector.status = status;
          await connector.save();

          // Broadcast to all clients in this station room
          const stationId = connector.stationId._id.toString();
          this.io.to(`station:${stationId}`).emit('connector:updated', {
            connectorId,
            stationId,
            status,
            updatedAt: new Date(),
            updatedBy: socket.userId,
          });

          logger.info(`Connector ${connectorId} status updated to ${status} by ${socket.userId}`);
        } catch (error) {
          logger.error('Error updating connector status:', error);
          socket.emit('error', 'Failed to update connector status');
        }
      });

      // Disconnection
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.authenticatedSockets.delete(socket.userId);
        }
        logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket, token: string): Promise<void> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await User.findById(payload.userId);

      if (!user) {
        throw new Error('User not found');
      }

      socket.user = user;
      socket.userId = user._id.toString();
      this.authenticatedSockets.set(socket.userId, socket);

      socket.emit('authenticated', {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      logger.info(`Socket authenticated for user: ${user.email}`);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Public methods for broadcasting events

  /**
   * Broadcast station update to all clients subscribed to the station
   */
  public broadcastStationUpdate(stationId: string, data: any): void {
    this.io.to(`station:${stationId}`).emit('station:updated', {
      stationId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast connector update to all clients subscribed to the station
   */
  public broadcastConnectorUpdate(stationId: string, connectorId: string, data: any): void {
    this.io.to(`station:${stationId}`).emit('connector:updated', {
      stationId,
      connectorId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast reservation update to all clients subscribed to the reservation
   */
  public broadcastReservationUpdate(reservationId: string, data: any): void {
    this.io.to(`reservation:${reservationId}`).emit('reservation:updated', {
      reservationId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast session update to all clients subscribed to the session
   */
  public broadcastSessionUpdate(sessionId: string, data: any): void {
    this.io.to(`session:${sessionId}`).emit('session:updated', {
      sessionId,
      ...data,
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to a specific user
   */
  public sendNotificationToUser(userId: string, notification: any): void {
    const socket = this.authenticatedSockets.get(userId);
    if (socket) {
      socket.emit('notification', {
        ...notification,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Send notification to multiple users
   */
  public sendNotificationToUsers(userIds: string[], notification: any): void {
    userIds.forEach(userId => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  /**
   * Broadcast notification to all users with specific role
   */
  public broadcastToRole(role: UserRole, notification: any): void {
    this.authenticatedSockets.forEach((socket) => {
      if (socket.user && socket.user.role === role) {
        socket.emit('notification', {
          ...notification,
          timestamp: new Date(),
        });
      }
    });
  }

  /**
   * Get all connected users
   */
  public getConnectedUsers(): { userId: string; email: string; role: UserRole }[] {
    const users: { userId: string; email: string; role: UserRole }[] = [];
    this.authenticatedSockets.forEach((socket) => {
      if (socket.user) {
        users.push({
          userId: socket.userId!,
          email: socket.user.email,
          role: socket.user.role,
        });
      }
    });
    return users;
  }

  /**
   * Get socket instance
   */
  public getSocketIO(): SocketIOServer {
    return this.io;
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const initializeWebSocketService = (server: HTTPServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
  }
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized');
  }
  return webSocketService;
};