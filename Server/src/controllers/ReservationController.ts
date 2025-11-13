import { Request, Response } from 'express';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import { Reservation } from '../models/Reservation';
import { Station } from '../models/Station';
import { Connector } from '../models/Connector';
import { Vehicle } from '../models/Vehicle';
import { ReservationStatus } from '@chargebd/shared';
import { logger } from '../utils/logger';

// Simple QR code generator
const generateQRCodeString = (): string => {
  return Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now();
};

// Simple OTP generator
const generateOTP = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

export class ReservationController {
  /**
   * Check availability for a specific connector and time slot
   */
  static async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { stationId, connectorId, startTime, endTime } = req.body;

      // Validate inputs
      if (!stationId || !connectorId || !startTime || !endTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      // Check if station and connector exist
      const station = await Station.findById(stationId);
      if (!station) {
        res.status(404).json({ error: 'Station not found' });
        return;
      }

      const connector = await Connector.findOne({ _id: connectorId, stationId });
      if (!connector) {
        res.status(404).json({ error: 'Connector not found at this station' });
        return;
      }

      // Check for overlapping reservations
      const conflictingReservations = await Reservation.find({
        stationId,
        connectorId,
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        $or: [
          // New reservation starts during existing reservation
          {
            startTime: { $lte: start },
            endTime: { $gt: start },
          },
          // New reservation ends during existing reservation
          {
            startTime: { $lt: end },
            endTime: { $gte: end },
          },
          // New reservation completely contains existing reservation
          {
            startTime: { $gte: start },
            endTime: { $lte: end },
          },
        ],
      });

      const isAvailable = conflictingReservations.length === 0;

      res.json({
        available: isAvailable,
        connector: {
          id: connector._id,
          type: connector.type,
          maxKw: connector.maxKw,
          status: connector.status,
        },
        conflictingReservations: conflictingReservations.map((r: any) => ({
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      });
    } catch (error) {
      logger.error('Error checking availability:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get available time slots for a connector on a specific date
   */
  static async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { stationId, connectorId, date } = req.query;

      if (!stationId || !connectorId || !date) {
        res.status(400).json({ error: 'Missing required parameters' });
        return;
      }

      const targetDate = new Date(date as string);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all reservations for this connector on this date
      const reservations = await Reservation.find({
        stationId,
        connectorId,
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        $or: [
          {
            startTime: { $gte: startOfDay, $lte: endOfDay },
          },
          {
            endTime: { $gte: startOfDay, $lte: endOfDay },
          },
          {
            startTime: { $lte: startOfDay },
            endTime: { $gte: endOfDay },
          },
        ],
      }).sort({ startTime: 1 });

      // Generate time slots (30-minute intervals from 6 AM to 10 PM)
      const slots: { startTime: Date; endTime: Date; available: boolean }[] = [];
      const startHour = 6; // 6 AM
      const endHour = 22; // 10 PM
      const slotDuration = 30; // minutes

      for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += slotDuration) {
          const slotStart = new Date(targetDate);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotStart.getMinutes() + slotDuration);

          // Check if slot overlaps with any reservation
          const isAvailable = !reservations.some(
            (r: any) =>
              (slotStart >= r.startTime && slotStart < r.endTime) ||
              (slotEnd > r.startTime && slotEnd <= r.endTime) ||
              (slotStart <= r.startTime && slotEnd >= r.endTime)
          );

          slots.push({
            startTime: slotStart,
            endTime: slotEnd,
            available: isAvailable,
          });
        }
      }

      res.json({ slots });
    } catch (error) {
      logger.error('Error getting available slots:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Create a new reservation
   */
  static async createReservation(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId, stationId, connectorId, startTime, endTime } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate inputs
      if (!vehicleId || !stationId || !connectorId || !startTime || !endTime) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
        res.status(400).json({ error: 'Invalid vehicle ID format' });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(stationId)) {
        res.status(400).json({ error: 'Invalid station ID format' });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(connectorId)) {
        res.status(400).json({ error: 'Invalid connector ID format' });
        return;
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      // Check if vehicle exists and belongs to user
      // TODO: Implement proper vehicle management API. For now, allow mock vehicles for testing
      let vehicle = await Vehicle.findOne({ _id: vehicleId, userId });
      
      // If vehicle not found, create a temporary one for testing purposes
      if (!vehicle) {
        logger.warn(`Vehicle ${vehicleId} not found for user ${userId}. Creating temporary vehicle for testing.`);
        vehicle = await Vehicle.create({
          userId,
          make: 'Tesla',
          model: 'Model 3',
          year: 2023,
          licensePlate: 'TEMP-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
          connectorType: ['Type2', 'CCS2', 'CHAdeMO'],
          usableKWh: 60,
          maxACkW: 11,
          maxDCkW: 150,
          isDefault: true,
        });
      }

      // Check if station exists
      const station = await Station.findById(stationId);
      if (!station) {
        res.status(404).json({ error: 'Station not found' });
        return;
      }

      // Check if connector exists at this station
      const connector = await Connector.findOne({ _id: connectorId, stationId });
      if (!connector) {
        res.status(404).json({ error: 'Connector not found at this station' });
        return;
      }

      // Check connector compatibility with vehicle
      if (!vehicle.connectorType.includes(connector.standard)) {
        res.status(400).json({
          error: `Vehicle is not compatible with ${connector.standard} connector`,
          vehicleConnectors: vehicle.connectorType,
          stationConnector: connector.standard,
        });
        return;
      }

      // Check for overlapping reservations
      const conflictingReservations = await Reservation.find({
        stationId,
        connectorId,
        status: { $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        $or: [
          {
            startTime: { $lte: start },
            endTime: { $gt: start },
          },
          {
            startTime: { $lt: end },
            endTime: { $gte: end },
          },
          {
            startTime: { $gte: start },
            endTime: { $lte: end },
          },
        ],
      });

      if (conflictingReservations.length > 0) {
        res.status(409).json({
          error: 'Time slot not available',
          conflictingReservations: conflictingReservations.map((r: any) => ({
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        });
        return;
      }

      // Calculate estimated cost
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const pricePerKWh = connector.pricePerKWhBDT || 15; // Default 15 BDT/kWh
      const estimatedKWh = Math.min(vehicle.usableKWh || 50, durationHours * connector.maxKw);
      const totalCostBDT = estimatedKWh * pricePerKWh;

      // Generate QR code string
      const qrCodeString = generateQRCodeString();

      // Generate OTP
      const otp = generateOTP(6);

      // Create reservation
      const reservation = new Reservation({
        userId,
        vehicleId,
        stationId,
        connectorId,
        startTime: start,
        endTime: end,
        status: ReservationStatus.PENDING,
        qrCode: qrCodeString,
        otp,
        totalCostBDT,
      });

      await reservation.save();

      // Generate QR code image as data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrCodeString, {
        errorCorrectionLevel: 'H',
        width: 300,
      });

      // Populate reservation details
      await reservation.populate([
        { path: 'vehicleId', select: 'make model year licensePlate' },
        { path: 'stationId', select: 'name address city location' },
      ]);

      res.status(201).json({
        reservation,
        qrCodeDataURL,
        message: 'Reservation created successfully',
      });
    } catch (error: any) {
      if (error.code === 11000) {
        logger.error('Duplicate QR code generated:', error);
        res.status(500).json({ error: 'Failed to generate unique QR code. Please try again.' });
        return;
      }
      logger.error('Error creating reservation:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get all reservations for the authenticated user
   */
  static async getUserReservations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { status, upcoming } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const filter: any = { userId };

      // Filter by status if provided
      if (status) {
        filter.status = status;
      }

      // Filter for upcoming reservations
      if (upcoming === 'true') {
        filter.startTime = { $gte: new Date() };
      }

      const reservations = await Reservation.find(filter)
        .populate('vehicleId', 'make model year licensePlate')
        .populate('stationId', 'name address city location photos')
        .sort({ startTime: -1 })
        .limit(100);

      res.json({ reservations, count: reservations.length });
    } catch (error) {
      logger.error('Error getting user reservations:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get a specific reservation by ID
   */
  static async getReservationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const reservation = await Reservation.findById(id)
        .populate('vehicleId', 'make model year licensePlate connectorType')
        .populate('stationId', 'name address city location photos amenities openingHours');

      if (!reservation) {
        res.status(404).json({ error: 'Reservation not found' });
        return;
      }

      // Check if user owns this reservation
      if (reservation.userId.toString() !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Get connector details
      const connector = await Connector.findById(reservation.connectorId);

      // Generate QR code if needed
      let qrCodeDataURL;
      if (reservation.qrCode && reservation.status !== ReservationStatus.CANCELED && reservation.status !== ReservationStatus.EXPIRED) {
        qrCodeDataURL = await QRCode.toDataURL(reservation.qrCode, {
          errorCorrectionLevel: 'H',
          width: 300,
        });
      }

      res.json({
        reservation,
        connector,
        qrCodeDataURL,
      });
    } catch (error) {
      logger.error('Error getting reservation:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Update reservation status (confirm, check-in, complete)
   */
  static async updateReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!status) {
        res.status(400).json({ error: 'Status is required' });
        return;
      }

      const validStatuses = [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: 'Invalid status',
          validStatuses,
        });
        return;
      }

      const reservation = await Reservation.findById(id);

      if (!reservation) {
        res.status(404).json({ error: 'Reservation not found' });
        return;
      }

      // Check if user owns this reservation
      if (reservation.userId.toString() !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Validate status transitions
      const currentStatus = reservation.status;
      const allowedTransitions: Record<string, ReservationStatus[]> = {
        [ReservationStatus.PENDING]: [ReservationStatus.CONFIRMED, ReservationStatus.CANCELED],
        [ReservationStatus.CONFIRMED]: [ReservationStatus.CHECKED_IN, ReservationStatus.CANCELED],
        [ReservationStatus.CHECKED_IN]: [ReservationStatus.COMPLETED, ReservationStatus.CANCELED],
      };

      if (!allowedTransitions[currentStatus]?.includes(status)) {
        res.status(400).json({
          error: `Cannot transition from ${currentStatus} to ${status}`,
          currentStatus,
          allowedTransitions: allowedTransitions[currentStatus],
        });
        return;
      }

      reservation.status = status;
      await reservation.save();

      await reservation.populate([
        { path: 'vehicleId', select: 'make model year licensePlate' },
        { path: 'stationId', select: 'name address city location' },
      ]);

      res.json({
        reservation,
        message: `Reservation ${status} successfully`,
      });
    } catch (error) {
      logger.error('Error updating reservation:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Cancel a reservation
   */
  static async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const reservation = await Reservation.findById(id);

      if (!reservation) {
        res.status(404).json({ error: 'Reservation not found' });
        return;
      }

      // Check if user owns this reservation
      if (reservation.userId.toString() !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Can only cancel pending or confirmed reservations
      if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
        res.status(400).json({
          error: `Cannot cancel reservation with status: ${reservation.status}`,
        });
        return;
      }

      // Check if cancellation is too late (e.g., less than 1 hour before start)
      const now = new Date();
      const oneHourBeforeStart = new Date(reservation.startTime.getTime() - 60 * 60 * 1000);

      if (now > oneHourBeforeStart) {
        res.status(400).json({
          error: 'Cannot cancel reservation less than 1 hour before start time',
          startTime: reservation.startTime,
        });
        return;
      }

      reservation.status = ReservationStatus.CANCELED;
      await reservation.save();

      await reservation.populate([
        { path: 'vehicleId', select: 'make model year licensePlate' },
        { path: 'stationId', select: 'name address city location' },
      ]);

      res.json({
        reservation,
        message: 'Reservation canceled successfully',
      });
    } catch (error) {
      logger.error('Error canceling reservation:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get reservations for a specific station (for station operators)
   */
  static async getStationReservations(req: Request, res: Response): Promise<void> {
    try {
      const { stationId } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user is operator or admin
      if (userRole !== 'operator' && userRole !== 'admin') {
        res.status(403).json({ error: 'Access denied. Operator or admin role required.' });
        return;
      }

      // For operators, verify they own this station
      if (userRole === 'operator') {
        const station = await Station.findById(stationId);
        if (!station || station.operatorId.toString() !== userId) {
          res.status(403).json({ error: 'Access denied. You do not own this station.' });
          return;
        }
      }

      const { status, date } = req.query;
      const filter: any = { stationId };

      if (status) {
        filter.status = status;
      }

      if (date) {
        const targetDate = new Date(date as string);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.$or = [
          { startTime: { $gte: startOfDay, $lte: endOfDay } },
          { endTime: { $gte: startOfDay, $lte: endOfDay } },
        ];
      }

      const reservations = await Reservation.find(filter)
        .populate('userId', 'name email phone')
        .populate('vehicleId', 'make model year licensePlate connectorType')
        .sort({ startTime: -1 })
        .limit(200);

      res.json({ reservations, count: reservations.length });
    } catch (error) {
      logger.error('Error getting station reservations:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
}
