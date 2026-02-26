import { Request, Response } from 'express';
import { Session, SessionDocument } from '../models/Session';
import { Reservation } from '../models/Reservation';
import { Connector } from '../models/Connector';
import { ReservationStatus, SessionStatus } from '@chargebd/shared';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Simulated ESP32 Charging Session Controller
 * 
 * This simulates the ESP32 device behavior:
 * - When user presses "Start Charging", a session is created
 * - Simulated telemetry data (voltage, current, power, energy) is generated
 * - Admin dashboard can see live charging data
 * - Session auto-stops when booking window ends
 */

// In-memory store for active simulation intervals
const activeSimulations: Map<string, NodeJS.Timeout> = new Map();

// In-memory store for latest telemetry per session (for quick read)
const sessionTelemetry: Map<string, {
  sessionId: string;
  reservationId: string;
  userId: string;
  stationName: string;
  connectorType: string;
  userName: string;
  voltage: number;
  current: number;
  power: number;
  energyKWh: number;
  temperature: number;
  connectorStatus: string;
  startedAt: Date;
  lastUpdated: Date;
  elapsedSeconds: number;
}> = new Map();

export class ChargingSimulationController {

  /**
   * POST /api/sessions/charging/start
   * Start a simulated charging session for a confirmed reservation
   * Only works during the booking time window
   */
  static async startCharging(req: Request, res: Response): Promise<void> {
    try {
      const { reservationId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (!reservationId) {
        res.status(400).json({ success: false, message: 'Reservation ID is required' });
        return;
      }

      // Find the reservation
      const reservation = await Reservation.findById(reservationId)
        .populate('stationId', 'name address')
        .populate('connectorId', 'standard type maxKw pricePerKWhBDT')
        .populate('vehicleId', 'make model')
        .populate('userId', 'displayName email');

      if (!reservation) {
        res.status(404).json({ success: false, message: 'Reservation not found' });
        return;
      }

      // Verify ownership
      if (reservation.userId._id.toString() !== userId) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      // Check reservation status - must be CONFIRMED or CHECKED_IN
      if (![ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN].includes(reservation.status)) {
        res.status(400).json({ 
          success: false, 
          message: `Cannot start charging for reservation with status: ${reservation.status}. Reservation must be confirmed.` 
        });
        return;
      }

      // Check that the reservation is paid
      if (!reservation.isPaid) {
        res.status(400).json({ 
          success: false, 
          message: 'Payment must be completed before starting a charging session.' 
        });
        return;
      }

      // Check if we're within the booking time window (with 5 min grace before and after)
      const now = new Date();
      const gracePeriodMs = 5 * 60 * 1000; // 5 minutes grace
      const bookingStart = new Date(reservation.startTime.getTime() - gracePeriodMs);
      const bookingEnd = new Date(reservation.endTime);

      if (now < bookingStart) {
        res.status(400).json({ 
          success: false, 
          message: 'Charging can only be started during your booking time window',
          bookingStartTime: reservation.startTime,
        });
        return;
      }

      if (now > bookingEnd) {
        res.status(400).json({ 
          success: false, 
          message: 'Your booking time has expired',
          bookingEndTime: reservation.endTime,
        });
        return;
      }

      // Check if there's already an active session for this reservation
      const existingSession = await Session.findOne({ 
        reservationId: reservation._id, 
        status: SessionStatus.ACTIVE 
      });

      if (existingSession) {
        res.status(409).json({ 
          success: false, 
          message: 'Charging session is already active for this reservation',
          sessionId: existingSession._id,
        });
        return;
      }

      // Create a new charging session
      const session = new Session({
        reservationId: reservation._id,
        userId: reservation.userId._id,
        stationId: reservation.stationId._id,
        connectorId: reservation.connectorId._id,
        vehicleId: reservation.vehicleId._id,
        startTime: now,
        status: SessionStatus.ACTIVE,
        totalEnergyKWh: 0,
        averagePowerKw: 0,
        totalCostBDT: 0,
        events: [],
      });

      await session.save();

      const sessionId = (session._id as mongoose.Types.ObjectId).toString();

      // Update reservation status to CHECKED_IN
      reservation.status = ReservationStatus.CHECKED_IN;
      await reservation.save();

      // Start the simulation
      const stationData = reservation.stationId as any;
      const connectorData = reservation.connectorId as any;
      const userData = reservation.userId as any;
      const maxKw = connectorData?.maxKw || 50;

      ChargingSimulationController.startSimulation(
        sessionId,
        reservationId,
        userId,
        stationData?.name || 'Unknown Station',
        `${connectorData?.standard || 'Unknown'} (${connectorData?.type || 'Unknown'})`,
        userData?.displayName || userData?.email || 'Unknown User',
        maxKw,
        reservation.endTime,
        connectorData?.pricePerKWhBDT || 15
      );

      logger.info(`Charging simulation started: session=${sessionId}, reservation=${reservationId}, user=${userId}`);

      res.status(200).json({
        success: true,
        message: 'Charging session started successfully',
        data: {
          sessionId,
          reservationId,
          startTime: now,
          estimatedEndTime: reservation.endTime,
        },
      });
    } catch (error: any) {
      logger.error('Error starting charging simulation:', error);
      res.status(500).json({ success: false, message: 'Failed to start charging session' });
    }
  }

  /**
   * POST /api/sessions/charging/stop
   * Stop an active charging session
   */
  static async stopCharging(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      if (!sessionId) {
        res.status(400).json({ success: false, message: 'Session ID is required' });
        return;
      }

      const session = await Session.findById(sessionId) as SessionDocument | null;
      if (!session) {
        res.status(404).json({ success: false, message: 'Session not found' });
        return;
      }

      if (session.userId.toString() !== userId) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      if (session.status !== SessionStatus.ACTIVE) {
        res.status(400).json({ success: false, message: 'Session is not active' });
        return;
      }

      // Stop simulation
      ChargingSimulationController.stopSimulation(sessionId);

      // Finalize session
      const telemetry = sessionTelemetry.get(sessionId);
      session.endTime = new Date();
      session.status = SessionStatus.COMPLETED;
      session.totalEnergyKWh = telemetry?.energyKWh || 0;
      session.averagePowerKw = telemetry?.power ? telemetry.power / 1000 : 0;
      session.totalCostBDT = (telemetry?.energyKWh || 0) * 15; // Simple price calc
      await session.save();

      // Update reservation to COMPLETED
      if (session.reservationId) {
        await Reservation.findByIdAndUpdate(session.reservationId, {
          status: ReservationStatus.COMPLETED,
        });
      }

      // Remove telemetry data
      sessionTelemetry.delete(sessionId);

      logger.info(`Charging simulation stopped: session=${sessionId}`);

      res.status(200).json({
        success: true,
        message: 'Charging session stopped',
        data: {
          sessionId,
          totalEnergyKWh: session.totalEnergyKWh,
          totalCostBDT: session.totalCostBDT,
          duration: session.endTime!.getTime() - session.startTime.getTime(),
        },
      });
    } catch (error: any) {
      logger.error('Error stopping charging simulation:', error);
      res.status(500).json({ success: false, message: 'Failed to stop charging session' });
    }
  }

  /**
   * GET /api/sessions/charging/status/:reservationId
   * Get current charging status for a reservation
   */
  static async getChargingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      // Find active session for this reservation
      const session = await Session.findOne({ 
        reservationId, 
        status: SessionStatus.ACTIVE 
      }) as SessionDocument | null;

      if (!session) {
        res.status(200).json({
          success: true,
          data: { isCharging: false },
        });
        return;
      }

      // Verify ownership
      if (session.userId.toString() !== userId) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const sessionIdStr = (session._id as mongoose.Types.ObjectId).toString();
      const telemetry = sessionTelemetry.get(sessionIdStr);

      res.status(200).json({
        success: true,
        data: {
          isCharging: true,
          sessionId: session._id,
          voltage: telemetry?.voltage || 0,
          current: telemetry?.current || 0,
          power: telemetry?.power || 0,
          energyKWh: telemetry?.energyKWh || 0,
          temperature: telemetry?.temperature || 0,
          connectorStatus: telemetry?.connectorStatus || 'idle',
          startedAt: session.startTime,
          elapsedSeconds: telemetry?.elapsedSeconds || 0,
        },
      });
    } catch (error: any) {
      logger.error('Error getting charging status:', error);
      res.status(500).json({ success: false, message: 'Failed to get charging status' });
    }
  }

  /**
   * GET /api/sessions/charging/active
   * Get all active charging sessions (Admin only)
   * Used by admin dashboard to monitor live charging
   */
  static async getActiveChargingSessions(req: Request, res: Response): Promise<void> {
    try {
      const activeSessions: any[] = [];

      sessionTelemetry.forEach((telemetry) => {
        activeSessions.push({
          ...telemetry,
        });
      });

      // Sort by most recently started
      activeSessions.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      res.status(200).json({
        success: true,
        count: activeSessions.length,
        data: activeSessions,
      });
    } catch (error: any) {
      logger.error('Error getting active charging sessions:', error);
      res.status(500).json({ success: false, message: 'Failed to get active sessions' });
    }
  }

  /**
   * Start the ESP32 simulation for a session
   * Generates realistic voltage, current, power readings every 3 seconds
   */
  private static startSimulation(
    sessionId: string,
    reservationId: string,
    userId: string,
    stationName: string,
    connectorType: string,
    userName: string,
    maxKw: number,
    bookingEndTime: Date,
    pricePerKWh: number
  ): void {
    const startTime = new Date();
    let totalEnergyKWh = 0;
    let elapsedSeconds = 0;

    // Simulated charging phases: ramp-up, constant, taper
    const generateReadings = () => {
      elapsedSeconds += 3;
      const elapsedMinutes = elapsedSeconds / 60;
      const totalDurationMinutes = (bookingEndTime.getTime() - startTime.getTime()) / 60000;
      const progress = Math.min(elapsedMinutes / totalDurationMinutes, 1);

      // Simulate realistic charging curve
      let currentAmps: number;
      let voltage: number;

      if (progress < 0.1) {
        // Ramp-up phase (first 10%)
        const rampProgress = progress / 0.1;
        voltage = 380 + Math.random() * 10;
        currentAmps = rampProgress * (maxKw * 1000 / voltage) * (0.8 + Math.random() * 0.2);
      } else if (progress < 0.7) {
        // Constant power phase (10-70%)
        voltage = 390 + Math.random() * 15;
        currentAmps = (maxKw * 1000 / voltage) * (0.85 + Math.random() * 0.15);
      } else {
        // Taper phase (70-100%) - gradually reduce
        const taperProgress = (progress - 0.7) / 0.3;
        voltage = 400 + Math.random() * 10;
        currentAmps = (maxKw * 1000 / voltage) * (0.85 - taperProgress * 0.5) * (0.9 + Math.random() * 0.1);
      }

      // Add small realistic fluctuations
      voltage = Math.round((voltage + (Math.random() - 0.5) * 5) * 10) / 10;
      currentAmps = Math.max(0.5, Math.round(currentAmps * 100) / 100);
      const power = Math.round(voltage * currentAmps); // Watts
      const incrementKWh = (power / 1000) * (3 / 3600); // 3 seconds worth of energy
      totalEnergyKWh += incrementKWh;

      // Simulate temperature (starts at 25°C, gradually increases)
      const temperature = Math.round((25 + progress * 20 + (Math.random() - 0.5) * 2) * 10) / 10;

      // Store latest telemetry
      sessionTelemetry.set(sessionId, {
        sessionId,
        reservationId,
        userId,
        stationName,
        connectorType,
        userName,
        voltage,
        current: currentAmps,
        power,
        energyKWh: Math.round(totalEnergyKWh * 1000) / 1000,
        temperature,
        connectorStatus: 'charging',
        startedAt: startTime,
        lastUpdated: new Date(),
        elapsedSeconds,
      });

      // Also update the Session document periodically (every 30 seconds)
      if (elapsedSeconds % 30 === 0) {
        Session.findByIdAndUpdate(sessionId, {
          totalEnergyKWh: Math.round(totalEnergyKWh * 1000) / 1000,
          averagePowerKw: Math.round((power / 1000) * 100) / 100,
          $push: {
            events: {
              timestamp: new Date(),
              powerKw: Math.round((power / 1000) * 100) / 100,
              voltage,
              current: currentAmps,
              energyKWh: Math.round(totalEnergyKWh * 1000) / 1000,
            },
          },
        }).catch(err => logger.error('Error updating session telemetry:', err));
      }

      // Auto-stop if booking time has ended
      if (new Date() >= bookingEndTime) {
        logger.info(`Booking time ended, auto-stopping session ${sessionId}`);
        ChargingSimulationController.stopSimulation(sessionId);
        
        // Finalize session
        Session.findByIdAndUpdate(sessionId, {
          endTime: new Date(),
          status: SessionStatus.COMPLETED,
          totalEnergyKWh: Math.round(totalEnergyKWh * 1000) / 1000,
          totalCostBDT: Math.round(totalEnergyKWh * pricePerKWh * 100) / 100,
        }).catch(err => logger.error('Error finalizing session:', err));

        Reservation.findByIdAndUpdate(reservationId, {
          status: ReservationStatus.COMPLETED,
        }).catch(err => logger.error('Error completing reservation:', err));

        sessionTelemetry.delete(sessionId);
      }
    };

    // Generate initial reading
    generateReadings();

    // Generate readings every 3 seconds
    const intervalId = setInterval(generateReadings, 3000);
    activeSimulations.set(sessionId, intervalId);
  }

  /**
   * Stop an active simulation
   */
  private static stopSimulation(sessionId: string): void {
    const intervalId = activeSimulations.get(sessionId);
    if (intervalId) {
      clearInterval(intervalId);
      activeSimulations.delete(sessionId);
    }
  }
}
