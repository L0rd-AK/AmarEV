import { Request, Response } from 'express';
import { z } from 'zod';
import { routePlanningService, RoutePoint, RoutePlanningOptions } from '../services/RoutePlanningService';
import { logger } from '../utils/logger';

const routePointSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  name: z.string().optional(),
  address: z.string().optional(),
});

const calculateRouteSchema = z.object({
  start: routePointSchema,
  end: routePointSchema,
  waypoints: z.array(routePointSchema).optional().default([]),
  options: z.object({
    profile: z.enum(['driving-car', 'driving-hgv', 'cycling-regular', 'foot-walking']).optional(),
    avoidHighways: z.boolean().optional(),
    avoidTolls: z.boolean().optional(),
    avoidFerries: z.boolean().optional(),
    units: z.enum(['km', 'mi']).optional(),
    language: z.string().optional(),
    geometry: z.boolean().optional(),
    instructions: z.boolean().optional(),
    elevation: z.boolean().optional(),
    maneuvers: z.boolean().optional(),
  }).optional().default({}),
});

const planRouteWithChargingSchema = z.object({
  start: routePointSchema,
  end: routePointSchema,
  vehicleOptions: z.object({
    vehicleRange: z.number().positive(),
    currentBatteryLevel: z.number().min(0).max(100),
    minimumBatteryLevel: z.number().min(0).max(100).default(20),
    preferredPowerRating: z.number().positive().optional(),
    connectorTypes: z.array(z.string()).optional(),
    chargingBuffer: z.number().min(0).max(50).default(10),
  }),
  routeOptions: z.object({
    profile: z.enum(['driving-car', 'driving-hgv', 'cycling-regular', 'foot-walking']).optional(),
    avoidHighways: z.boolean().optional(),
    avoidTolls: z.boolean().optional(),
    avoidFerries: z.boolean().optional(),
    units: z.enum(['km', 'mi']).optional(),
    maxDetourDistance: z.number().positive().default(10),
    maxChargingStops: z.number().positive().default(3),
  }).optional().default({}),
});

const findChargingStationsSchema = z.object({
  routePoints: z.array(routePointSchema).min(2),
  maxDistance: z.number().positive().default(5),
  filters: z.object({
    connectorTypes: z.array(z.string()).optional(),
    minPowerRating: z.number().positive().optional(),
    operatorIds: z.array(z.string()).optional(),
  }).optional(),
});

const isochroneSchema = z.object({
  center: routePointSchema,
  ranges: z.array(z.number().positive()),
  rangeType: z.enum(['time', 'distance']).default('time'),
  profile: z.string().default('driving-car'),
});

export class RouteController {
  /**
   * Calculate basic route between points
   */
  async calculateRoute(req: Request, res: Response) {
    try {
      const validation = calculateRouteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { start, end, waypoints, options } = validation.data;

      logger.info('Calculating route', {
        start,
        end,
        waypointsCount: waypoints.length,
        userId: req.user?.id,
      });

      const result = await routePlanningService.calculateRoute(start, end, waypoints, options);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Route calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate route',
      });
    }
  }

  /**
   * Plan route with charging stops
   */
  async planRouteWithCharging(req: Request, res: Response) {
    try {
      const validation = planRouteWithChargingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { start, end, vehicleOptions, routeOptions } = validation.data;

      logger.info('Planning route with charging', {
        start,
        end,
        vehicleRange: vehicleOptions.vehicleRange,
        currentBatteryLevel: vehicleOptions.currentBatteryLevel,
        userId: req.user?.id,
      });

      const planningOptions: RoutePlanningOptions = {
        ...routeOptions,
        ...vehicleOptions,
      };

      const result = await routePlanningService.planRouteWithCharging(start, end, planningOptions);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Route planning with charging error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to plan route with charging',
      });
    }
  }

  /**
   * Find charging stations near a route
   */
  async findChargingStationsNearRoute(req: Request, res: Response) {
    try {
      const validation = findChargingStationsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { routePoints, maxDistance, filters } = validation.data;

      logger.info('Finding charging stations near route', {
        routePointsCount: routePoints.length,
        maxDistance,
        filters,
        userId: req.user?.id,
      });

      const stations = await routePlanningService.findChargingStationsNearRoute(
        routePoints,
        maxDistance,
        filters
      );

      res.json({
        success: true,
        data: {
          stations,
          totalFound: stations.length,
        },
      });
    } catch (error) {
      logger.error('Find charging stations error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to find charging stations',
      });
    }
  }

  /**
   * Get isochrone (reachable area) from a point
   */
  async getIsochrone(req: Request, res: Response) {
    try {
      const validation = isochroneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.error.errors,
        });
      }

      const { center, ranges, rangeType, profile } = validation.data;

      logger.info('Calculating isochrone', {
        center,
        ranges,
        rangeType,
        profile,
        userId: req.user?.id,
      });

      const result = await routePlanningService.getIsochrone(center, ranges, rangeType, profile);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Isochrone calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to calculate isochrone',
      });
    }
  }

  /**
   * Get route statistics and energy analysis
   */
  async getRouteAnalysis(req: Request, res: Response) {
    try {
      const { routeId } = req.params;
      
      // This would be implemented to analyze saved routes
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          routeId,
          analysis: {
            totalDistance: 0,
            totalDuration: 0,
            estimatedEnergyConsumption: 0,
            recommendedChargingStops: [],
            costEstimate: {
              electricity: 0,
              tolls: 0,
              parking: 0,
              total: 0,
            },
            alternativeRoutes: [],
          },
        },
      });
    } catch (error) {
      logger.error('Route analysis error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        routeId: req.params.routeId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to analyze route',
      });
    }
  }

  /**
   * Save a route for future reference
   */
  async saveRoute(req: Request, res: Response) {
    try {
      const { name, description, routeData } = req.body;
      const userId = req.user!.id;

      // This would save the route to the database
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          routeId: `route_${Date.now()}`,
          name,
          description,
          userId,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Save route error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to save route',
      });
    }
  }

  /**
   * Get user's saved routes
   */
  async getSavedRoutes(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // This would fetch saved routes from the database
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          routes: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      });
    } catch (error) {
      logger.error('Get saved routes error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get saved routes',
      });
    }
  }

  /**
   * Delete a saved route
   */
  async deleteRoute(req: Request, res: Response) {
    try {
      const { routeId } = req.params;
      const userId = req.user!.id;

      // This would delete the route from the database
      // For now, return a placeholder response
      res.json({
        success: true,
        message: 'Route deleted successfully',
      });
    } catch (error) {
      logger.error('Delete route error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        routeId: req.params.routeId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete route',
      });
    }
  }
}