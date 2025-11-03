import { Router } from 'express';
import { ReservationController } from '../controllers/ReservationController';
import { authenticateToken } from '../middleware/authMiddleware';

export const reservationRoutes = Router();

// Check availability for a connector and time slot
reservationRoutes.post('/check-availability', authenticateToken, ReservationController.checkAvailability);

// Get available time slots for a connector on a specific date
reservationRoutes.get('/available-slots', authenticateToken, ReservationController.getAvailableSlots);

// Get all reservations for the authenticated user
reservationRoutes.get('/', authenticateToken, ReservationController.getUserReservations);

// Create a new reservation
reservationRoutes.post('/', authenticateToken, ReservationController.createReservation);

// Get reservations for a specific station (operators/admins only)
reservationRoutes.get('/station/:stationId', authenticateToken, ReservationController.getStationReservations);

// Get a specific reservation by ID
reservationRoutes.get('/:id', authenticateToken, ReservationController.getReservationById);

// Update a reservation (confirm, check-in, complete)
reservationRoutes.put('/:id', authenticateToken, ReservationController.updateReservation);

// Cancel a reservation
reservationRoutes.delete('/:id', authenticateToken, ReservationController.cancelReservation);
