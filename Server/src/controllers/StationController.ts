import { Request, Response } from 'express';
import { Station, StationDocument } from '@/models/Station';
import { Connector, ConnectorDocument } from '@/models/Connector';
import { Session } from '@/models/Session';
import { Reservation } from '@/models/Reservation';
import { Review } from '@/models/Review';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { ConnectorStatus, StationSearchParams } from '@chargebd/shared';
import { Types } from 'mongoose';

export class StationController {
  /**
   * Get all stations with filters
   */
  static async getStations(req: Request, res: Response): Promise<void> {
    try {
      const {
        bbox,
        lat,
        lng,
        radius = 5000,
        ac_min_kw,
        dc_min_kw,
        connector_type,
        open_now,
        amenities,
        limit = 50,
        offset = 0,
        city,
        area,
        search,
      } = req.query as any;

      const query: any = { isActive: true };

      // Location-based search
      if (bbox) {
        const [swLng, swLat, neLng, neLat] = bbox.split(',').map(Number);
        query.location = {
          $geoWithin: {
            $box: [
              [swLng, swLat],
              [neLng, neLat],
            ],
          },
        };
      } else if (lat && lng) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            $maxDistance: parseInt(radius),
          },
        };
      }

      // City/Area filters
      if (city) query['address.city'] = new RegExp(city, 'i');
      if (area) query['address.area'] = new RegExp(area, 'i');

      // Text search
      if (search) {
        query.$text = { $search: search };
      }

      // Amenities filter
      if (amenities) {
        const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
        query.amenities = { $all: amenitiesArray };
      }

      // Opening hours filter
      if (open_now === 'true') {
        const now = new Date();
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
        const currentTime = now.toTimeString().slice(0, 5); // HH:mm format

        query[`openingHours.${dayOfWeek}.open`] = { $lte: currentTime };
        query[`openingHours.${dayOfWeek}.close`] = { $gte: currentTime };
      }

      const stations = await Station.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .select('-__v')
        .lean();

      // Get connectors for each station
      const stationsWithConnectors = await Promise.all(
        stations.map(async (station) => {
          const connectors = await Connector.find({ stationId: station._id })
            .select('-__v')
            .lean();

          // Apply connector filters
          let filteredConnectors = connectors;

          if (connector_type) {
            filteredConnectors = filteredConnectors.filter(
              (c) => c.standard === connector_type
            );
          }

          if (ac_min_kw) {
            filteredConnectors = filteredConnectors.filter(
              (c) => c.type === 'AC' && c.maxKw >= parseFloat(ac_min_kw)
            );
          }

          if (dc_min_kw) {
            filteredConnectors = filteredConnectors.filter(
              (c) => c.type === 'DC' && c.maxKw >= parseFloat(dc_min_kw)
            );
          }

          // Skip station if no connectors match filters
          if (
            (connector_type || ac_min_kw || dc_min_kw) &&
            filteredConnectors.length === 0
          ) {
            return null;
          }

          // Calculate availability
          const availableConnectors = connectors.filter(
            (c) => c.status === ConnectorStatus.AVAILABLE
          ).length;

          return {
            ...station,
            connectors: connectors.map((c) => ({
              ...c,
              _id: c._id.toString(),
              stationId: c.stationId.toString(),
            })),
            availableConnectors,
            totalConnectors: connectors.length,
          };
        })
      );

      // Remove null stations (filtered out)
      const validStations = stationsWithConnectors.filter((s) => s !== null);

      res.json({
        success: true,
        data: {
          stations: validStations,
          total: validStations.length,
          offset: parseInt(offset),
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Error fetching stations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch stations',
          code: 'FETCH_STATIONS_ERROR',
        },
      });
    }
  }

  /**
   * Get station by ID
   */
  static async getStationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid station ID',
            code: 'INVALID_STATION_ID',
          },
        });
        return;
      }

      const station = await Station.findById(id).populate('operatorId', 'displayName email').lean();

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Get connectors
      const connectors = await Connector.find({ stationId: id }).lean();

      // Get reviews with ratings
      const reviews = await Review.find({ stationId: id })
        .populate('userId', 'displayName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const totalReviews = await Review.countDocuments({ stationId: id });
      const avgRating = totalReviews > 0
        ? (await Review.aggregate([
            { $match: { stationId: new Types.ObjectId(id) } },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } },
          ]))[0]?.avgRating || 0
        : 0;

      // Calculate real-time availability
      const availableConnectors = connectors.filter(
        (c) => c.status === ConnectorStatus.AVAILABLE
      ).length;

      res.json({
        success: true,
        data: {
          station: {
            ...station,
            connectors,
            reviews: reviews.slice(0, 5), // Return top 5 reviews
            rating: Math.round(avgRating * 10) / 10,
            totalReviews,
            availableConnectors,
            totalConnectors: connectors.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching station:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch station',
          code: 'FETCH_STATION_ERROR',
        },
      });
    }
  }

  /**
   * Create new station (Operator/Admin only)
   */
  static async createStation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stationData = req.body;
      const userId = req.userId;

      // Create station
      const station = new Station({
        ...stationData,
        operatorId: userId,
      });

      await station.save();

      res.status(201).json({
        success: true,
        message: 'Station created successfully',
        data: { station },
      });
    } catch (error: any) {
      logger.error('Error creating station:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to create station',
          code: 'CREATE_STATION_ERROR',
        },
      });
    }
  }

  /**
   * Update station (Operator/Admin only)
   */
  static async updateStation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.userId;
      const userRole = req.user?.role;

      const station = await Station.findById(id);

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Check ownership (unless admin)
      if (userRole !== 'admin' && station.operatorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to update this station',
            code: 'FORBIDDEN',
          },
        });
        return;
      }

      // Update station
      Object.assign(station, updates);
      await station.save();

      res.json({
        success: true,
        message: 'Station updated successfully',
        data: { station },
      });
    } catch (error: any) {
      logger.error('Error updating station:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to update station',
          code: 'UPDATE_STATION_ERROR',
        },
      });
    }
  }

  /**
   * Delete station (Operator/Admin only)
   */
  static async deleteStation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const userRole = req.user?.role;

      const station = await Station.findById(id);

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Check ownership (unless admin)
      if (userRole !== 'admin' && station.operatorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to delete this station',
            code: 'FORBIDDEN',
          },
        });
        return;
      }

      // Soft delete by setting isActive to false
      station.isActive = false;
      await station.save();

      res.json({
        success: true,
        message: 'Station deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting station:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to delete station',
          code: 'DELETE_STATION_ERROR',
        },
      });
    }
  }

  /**
   * Get operator's stations
   */
  static async getOperatorStations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId;

      const stations = await Station.find({ operatorId: userId }).lean();

      // Get connectors and stats for each station
      const stationsWithStats = await Promise.all(
        stations.map(async (station) => {
          const connectors = await Connector.find({ stationId: station._id }).lean();
          const totalSessions = await Session.countDocuments({ stationId: station._id });
          const activeSessions = await Session.countDocuments({
            stationId: station._id,
            status: 'active',
          });
          const totalRevenue = await Session.aggregate([
            { $match: { stationId: station._id, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalCostBDT' } } },
          ]);

          const availableConnectors = connectors.filter(
            (c) => c.status === ConnectorStatus.AVAILABLE
          ).length;

          return {
            ...station,
            connectors: connectors.length,
            availableConnectors,
            totalSessions,
            activeSessions,
            totalRevenue: totalRevenue[0]?.total || 0,
          };
        })
      );

      res.json({
        success: true,
        data: { stations: stationsWithStats },
      });
    } catch (error) {
      logger.error('Error fetching operator stations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch stations',
          code: 'FETCH_OPERATOR_STATIONS_ERROR',
        },
      });
    }
  }

  /**
   * Get station analytics
   */
  static async getStationAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { startDate, endDate, period = 'day' } = req.query;
      const userId = req.userId;
      const userRole = req.user?.role;

      const station = await Station.findById(id);

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Check ownership (unless admin)
      if (userRole !== 'admin' && station.operatorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to view this data',
            code: 'FORBIDDEN',
          },
        });
        return;
      }

      const dateFilter: any = { stationId: id };
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate as string);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate as string);
      }

      // Sessions analytics
      const totalSessions = await Session.countDocuments(dateFilter);
      const completedSessions = await Session.countDocuments({
        ...dateFilter,
        status: 'completed',
      });

      // Revenue analytics
      const revenueData = await Session.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalCostBDT' },
            totalEnergy: { $sum: '$totalEnergyKWh' },
            avgSessionCost: { $avg: '$totalCostBDT' },
            avgEnergyDelivered: { $avg: '$totalEnergyKWh' },
          },
        },
      ]);

      // Connector utilization
      const connectors = await Connector.find({ stationId: id }).lean();
      const connectorStats = await Promise.all(
        connectors.map(async (connector) => {
          const sessionsCount = await Session.countDocuments({
            ...dateFilter,
            connectorId: connector._id,
          });
          const totalEnergy = await Session.aggregate([
            { $match: { ...dateFilter, connectorId: connector._id } },
            { $group: { _id: null, energy: { $sum: '$totalEnergyKWh' } } },
          ]);

          return {
            connectorId: connector._id,
            type: connector.type,
            standard: connector.standard,
            status: connector.status,
            sessionsCount,
            totalEnergy: totalEnergy[0]?.energy || 0,
          };
        })
      );

      // Time-series data
      let groupBy: any;
      switch (period) {
        case 'hour':
          groupBy = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' },
          };
          break;
        case 'day':
          groupBy = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          };
          break;
        case 'month':
          groupBy = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          };
          break;
        default:
          groupBy = {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          };
      }

      const timeSeriesData = await Session.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: groupBy,
            sessions: { $sum: 1 },
            revenue: { $sum: '$totalCostBDT' },
            energy: { $sum: '$totalEnergyKWh' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
      ]);

      res.json({
        success: true,
        data: {
          overview: {
            totalSessions,
            completedSessions,
            totalRevenue: revenueData[0]?.totalRevenue || 0,
            totalEnergy: revenueData[0]?.totalEnergy || 0,
            avgSessionCost: revenueData[0]?.avgSessionCost || 0,
            avgEnergyDelivered: revenueData[0]?.avgEnergyDelivered || 0,
          },
          connectorStats,
          timeSeries: timeSeriesData,
        },
      });
    } catch (error) {
      logger.error('Error fetching station analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to fetch analytics',
          code: 'FETCH_ANALYTICS_ERROR',
        },
      });
    }
  }

  /**
   * Search nearby stations
   */
  static async searchNearby(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lng, radius = 5000, limit = 20 } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Latitude and longitude are required',
            code: 'MISSING_COORDINATES',
          },
        });
        return;
      }

      const stations = await Station.find({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
            },
            $maxDistance: parseInt(radius as string),
          },
        },
      })
        .limit(parseInt(limit as string))
        .lean();

      // Get connectors for each station
      const stationsWithConnectors = await Promise.all(
        stations.map(async (station) => {
          const connectors = await Connector.find({ stationId: station._id }).lean();
          const availableConnectors = connectors.filter(
            (c) => c.status === ConnectorStatus.AVAILABLE
          ).length;

          return {
            ...station,
            connectors,
            availableConnectors,
            totalConnectors: connectors.length,
          };
        })
      );

      res.json({
        success: true,
        data: { stations: stationsWithConnectors },
      });
    } catch (error) {
      logger.error('Error searching nearby stations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to search nearby stations',
          code: 'SEARCH_NEARBY_ERROR',
        },
      });
    }
  }

  /**
   * Add connector to station
   */
  static async addConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const connectorData = req.body;
      const userId = req.userId;
      const userRole = req.user?.role;

      const station = await Station.findById(id);

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Check ownership (unless admin)
      if (userRole !== 'admin' && station.operatorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to add connectors to this station',
            code: 'FORBIDDEN',
          },
        });
        return;
      }

      const connector = new Connector({
        ...connectorData,
        stationId: id,
      });

      await connector.save();

      res.status(201).json({
        success: true,
        message: 'Connector added successfully',
        data: { connector },
      });
    } catch (error: any) {
      logger.error('Error adding connector:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to add connector',
          code: 'ADD_CONNECTOR_ERROR',
        },
      });
    }
  }

  /**
   * Update connector
   */
  static async updateConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id, connectorId } = req.params;
      const updates = req.body;
      const userId = req.userId;
      const userRole = req.user?.role;

      const station = await Station.findById(id);

      if (!station) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Station not found',
            code: 'STATION_NOT_FOUND',
          },
        });
        return;
      }

      // Check ownership (unless admin)
      if (userRole !== 'admin' && station.operatorId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to update this connector',
            code: 'FORBIDDEN',
          },
        });
        return;
      }

      const connector = await Connector.findOneAndUpdate(
        { _id: connectorId, stationId: id },
        updates,
        { new: true }
      );

      if (!connector) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Connector not found',
            code: 'CONNECTOR_NOT_FOUND',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Connector updated successfully',
        data: { connector },
      });
    } catch (error: any) {
      logger.error('Error updating connector:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to update connector',
          code: 'UPDATE_CONNECTOR_ERROR',
        },
      });
    }
  }
}
