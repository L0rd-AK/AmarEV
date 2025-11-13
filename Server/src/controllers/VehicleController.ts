import { Request, Response } from 'express';
import { Vehicle } from '../models/Vehicle';
import { logger } from '../utils/logger';

export class VehicleController {
  /**
   * Get all vehicles for the authenticated user
   */
  static async getUserVehicles(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const vehicles = await Vehicle.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
      res.json({ vehicles, count: vehicles.length });
    } catch (error) {
      logger.error('Error getting user vehicles:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Create a new vehicle
   */
  static async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const {
        make,
        model,
        year,
        licensePlate,
        connectorType,
        usableKWh,
        maxACkW,
        maxDCkW,
        isDefault,
      } = req.body;

      // Validate required fields
      if (!make || !model || !year || !licensePlate || !connectorType || !usableKWh) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // If this is set as default, unset other defaults
      if (isDefault) {
        await Vehicle.updateMany({ userId, isDefault: true }, { isDefault: false });
      }

      // Create vehicle
      const vehicle = new Vehicle({
        userId,
        make,
        model,
        year,
        licensePlate,
        connectorType,
        usableKWh,
        maxACkW,
        maxDCkW,
        isDefault: isDefault || false,
      });

      await vehicle.save();

      res.status(201).json({ vehicle });
    } catch (error) {
      logger.error('Error creating vehicle:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Update a vehicle
   */
  static async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const vehicle = await Vehicle.findOne({ _id: id, userId });

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found or does not belong to you' });
        return;
      }

      const {
        make,
        model,
        year,
        licensePlate,
        connectorType,
        usableKWh,
        maxACkW,
        maxDCkW,
        isDefault,
      } = req.body;

      // If this is set as default, unset other defaults
      if (isDefault && !vehicle.isDefault) {
        await Vehicle.updateMany({ userId, isDefault: true }, { isDefault: false });
      }

      // Update fields
      if (make) vehicle.make = make;
      if (model) vehicle.model = model;
      if (year) vehicle.year = year;
      if (licensePlate) vehicle.licensePlate = licensePlate;
      if (connectorType) vehicle.connectorType = connectorType;
      if (usableKWh) vehicle.usableKWh = usableKWh;
      if (maxACkW !== undefined) vehicle.maxACkW = maxACkW;
      if (maxDCkW !== undefined) vehicle.maxDCkW = maxDCkW;
      if (isDefault !== undefined) vehicle.isDefault = isDefault;

      await vehicle.save();

      res.json({ vehicle });
    } catch (error) {
      logger.error('Error updating vehicle:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Delete a vehicle
   */
  static async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const vehicle = await Vehicle.findOne({ _id: id, userId });

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found or does not belong to you' });
        return;
      }

      await vehicle.deleteOne();

      res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
      logger.error('Error deleting vehicle:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  /**
   * Get a specific vehicle by ID
   */
  static async getVehicleById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const vehicle = await Vehicle.findOne({ _id: id, userId });

      if (!vehicle) {
        res.status(404).json({ error: 'Vehicle not found or does not belong to you' });
        return;
      }

      res.json({ vehicle });
    } catch (error) {
      logger.error('Error getting vehicle:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
}
