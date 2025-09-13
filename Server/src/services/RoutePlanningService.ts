import axios from 'axios';
import { Station } from '../models/Station';
import { logger } from '../utils/logger';

export interface RoutePoint {
  longitude: number;
  latitude: number;
  name?: string;
  address?: string;
}

export interface RouteWaypoint extends RoutePoint {
  stationId?: string;
  connectorTypes?: string[];
  powerRating?: number;
  estimatedChargingTime?: number; // minutes
}

export interface RouteOptions {
  profile?: 'driving-car' | 'driving-hgv' | 'cycling-regular' | 'foot-walking';
  avoidHighways?: boolean;
  avoidTolls?: boolean;
  avoidFerries?: boolean;
  units?: 'km' | 'mi';
  language?: string;
  geometry?: boolean;
  instructions?: boolean;
  elevation?: boolean;
  maneuvers?: boolean;
  radiuses?: number[];
  bearings?: number[][];
  skipSegments?: number[];
}

export interface RoutePlanningOptions extends RouteOptions {
  vehicleRange: number; // km
  currentBatteryLevel: number; // percentage
  minimumBatteryLevel: number; // percentage
  preferredPowerRating?: number; // kW
  connectorTypes?: string[];
  maxDetourDistance?: number; // km
  maxChargingStops?: number;
  chargingBuffer?: number; // percentage
}

export interface RouteSegment {
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
  geometry?: any;
}

export interface RouteStep {
  distance: number;
  duration: number;
  type: number;
  instruction: string;
  name: string;
  wayPoints: number[];
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  segments: RouteSegment[];
  geometry?: any;
  waypoints: RouteWaypoint[];
  chargingStops: RouteWaypoint[];
  totalEnergyConsumption?: number; // kWh
  batteryLevelAtDestination?: number; // percentage
  warnings?: string[];
}

export interface OpenRouteServiceResponse {
  routes: Array<{
    summary: {
      distance: number;
      duration: number;
    };
    segments: RouteSegment[];
    geometry?: any;
    waypoints: number[];
  }>;
  metadata: any;
}

export class RoutePlanningService {
  private apiKey: string;
  private baseUrl: string = 'https://api.openrouteservice.org/v2';

  constructor() {
    this.apiKey = process.env.ORS_API_KEY || '';
    
    // Only require API key in production or when explicitly testing route planning
    if (process.env.NODE_ENV === 'production' && !this.apiKey) {
      throw new Error('OpenRouteService API key not configured for production');
    }

    if (process.env.NODE_ENV !== 'production' && !this.apiKey) {
      console.warn('OpenRouteService running in development mode without API key - route planning will be mocked');
    }
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(
    start: RoutePoint,
    end: RoutePoint,
    waypoints: RoutePoint[] = [],
    options: RouteOptions = {}
  ): Promise<RouteResult> {
    // Return mock data if API key is not configured (development mode)
    if (!this.apiKey) {
      console.warn('Returning mock route data - OpenRouteService API key not configured');
      return this.getMockRoute(start, end, waypoints);
    }

    try {
      const coordinates = [
        [start.longitude, start.latitude],
        ...waypoints.map(wp => [wp.longitude, wp.latitude]),
        [end.longitude, end.latitude],
      ];

      const requestBody = {
        coordinates,
        profile: options.profile || 'driving-car',
        format: 'json',
        units: options.units || 'km',
        language: options.language || 'en',
        geometry: options.geometry !== false,
        instructions: options.instructions !== false,
        elevation: options.elevation || false,
        maneuvers: options.maneuvers || false,
        options: {
          avoid_features: [
            ...(options.avoidHighways ? ['highways'] : []),
            ...(options.avoidTolls ? ['tollways'] : []),
            ...(options.avoidFerries ? ['ferries'] : []),
          ].filter(Boolean),
        },
      };

      if (options.radiuses) {
        requestBody.radiuses = options.radiuses;
      }

      if (options.bearings) {
        requestBody.bearings = options.bearings;
      }

      if (options.skipSegments) {
        requestBody.skip_segments = options.skipSegments;
      }

      logger.info('Calculating route with OpenRouteService', {
        start,
        end,
        waypointsCount: waypoints.length,
        profile: options.profile,
      });

      const response = await axios.post<OpenRouteServiceResponse>(
        `${this.baseUrl}/directions/${options.profile || 'driving-car'}`,
        requestBody,
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = response.data.routes[0];

      return {
        distance: route.summary.distance * 1000, // Convert km to meters
        duration: route.summary.duration,
        segments: route.segments,
        geometry: route.geometry,
        waypoints: [
          { ...start, name: start.name || 'Start' },
          ...waypoints,
          { ...end, name: end.name || 'Destination' },
        ],
        chargingStops: waypoints.filter(wp => 'stationId' in wp) as RouteWaypoint[],
      };
    } catch (error) {
      logger.error('Route calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        start,
        end,
        waypointsCount: waypoints.length,
      });
      throw error;
    }
  }

  /**
   * Plan route with charging stops
   */
  async planRouteWithCharging(
    start: RoutePoint,
    end: RoutePoint,
    options: RoutePlanningOptions
  ): Promise<RouteResult> {
    try {
      // First, calculate the direct route to get distance and energy requirements
      const directRoute = await this.calculateRoute(start, end, [], options);

      // Calculate energy consumption and determine if charging is needed
      const {
        needsCharging,
        chargingStops,
        energyAnalysis,
      } = await this.analyzeEnergyRequirements(start, end, directRoute, options);

      if (!needsCharging) {
        return {
          ...directRoute,
          totalEnergyConsumption: energyAnalysis.totalConsumption,
          batteryLevelAtDestination: energyAnalysis.batteryAtDestination,
        };
      }

      // Find charging stations along the route
      const routeWithCharging = await this.calculateRoute(start, end, chargingStops, options);

      return {
        ...routeWithCharging,
        chargingStops,
        totalEnergyConsumption: energyAnalysis.totalConsumption,
        batteryLevelAtDestination: energyAnalysis.batteryAtDestination,
        warnings: energyAnalysis.warnings,
      };
    } catch (error) {
      logger.error('Route planning with charging error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        start,
        end,
        options,
      });
      throw error;
    }
  }

  /**
   * Find charging stations near a route
   */
  async findChargingStationsNearRoute(
    routePoints: RoutePoint[],
    maxDistance: number = 5, // km
    filters?: {
      connectorTypes?: string[];
      minPowerRating?: number;
      operatorIds?: string[];
    }
  ): Promise<RouteWaypoint[]> {
    try {
      const stations: RouteWaypoint[] = [];

      // Create a buffer around the route and find stations within it
      for (const point of routePoints) {
        const nearbyStations = await Station.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [point.longitude, point.latitude],
              },
              distanceField: 'distance',
              maxDistance: maxDistance * 1000, // Convert km to meters
              spherical: true,
            },
          },
          {
            $match: {
              isActive: true,
              isPublic: true,
              ...(filters?.operatorIds && { operatorId: { $in: filters.operatorIds } }),
            },
          },
          {
            $lookup: {
              from: 'connectors',
              localField: '_id',
              foreignField: 'stationId',
              as: 'connectors',
            },
          },
          {
            $match: {
              'connectors.0': { $exists: true },
              ...(filters?.connectorTypes && {
                'connectors.type': { $in: filters.connectorTypes },
              }),
              ...(filters?.minPowerRating && {
                'connectors.powerRating': { $gte: filters.minPowerRating },
              }),
            },
          },
          {
            $project: {
              name: 1,
              location: 1,
              address: 1,
              connectors: 1,
              amenities: 1,
              operatorId: 1,
              distance: 1,
            },
          },
          {
            $limit: 3, // Limit to 3 stations per route point
          },
        ]);

        for (const station of nearbyStations) {
          const waypoint: RouteWaypoint = {
            longitude: station.location.coordinates[0],
            latitude: station.location.coordinates[1],
            name: station.name,
            address: station.address ? `${station.address.street}, ${station.address.city}` : undefined,
            stationId: station._id.toString(),
            connectorTypes: station.connectors.map((c: any) => c.type),
            powerRating: Math.max(...station.connectors.map((c: any) => c.powerRating)),
          };

          // Avoid duplicate stations
          if (!stations.find(s => s.stationId === waypoint.stationId)) {
            stations.push(waypoint);
          }
        }
      }

      return stations.sort((a, b) => (b.powerRating || 0) - (a.powerRating || 0));
    } catch (error) {
      logger.error('Error finding charging stations near route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        routePointsCount: routePoints.length,
        maxDistance,
        filters,
      });
      throw error;
    }
  }

  /**
   * Analyze energy requirements for a route
   */
  private async analyzeEnergyRequirements(
    start: RoutePoint,
    end: RoutePoint,
    route: RouteResult,
    options: RoutePlanningOptions
  ): Promise<{
    needsCharging: boolean;
    chargingStops: RouteWaypoint[];
    energyAnalysis: {
      totalConsumption: number;
      batteryAtDestination: number;
      warnings: string[];
    };
  }> {
    const warnings: string[] = [];

    // Calculate energy consumption (simplified model)
    // Average EV consumes ~0.2 kWh per km
    const consumptionRate = 0.2; // kWh/km
    const distanceKm = route.distance / 1000;
    const totalConsumption = distanceKm * consumptionRate;

    // Calculate available energy
    const maxEnergy = options.vehicleRange * consumptionRate; // Total battery capacity
    const currentEnergy = (options.currentBatteryLevel / 100) * maxEnergy;
    const minimumEnergy = (options.minimumBatteryLevel / 100) * maxEnergy;
    const usableEnergy = currentEnergy - minimumEnergy;

    let batteryAtDestination = options.currentBatteryLevel - (totalConsumption / maxEnergy) * 100;

    // Add charging buffer
    const bufferEnergy = ((options.chargingBuffer || 10) / 100) * maxEnergy;
    const totalEnergyNeeded = totalConsumption + bufferEnergy;

    let needsCharging = usableEnergy < totalEnergyNeeded;
    let chargingStops: RouteWaypoint[] = [];

    if (needsCharging) {
      warnings.push('Charging required for this route');

      // Find optimal charging stops
      const routePoints = this.generateRoutePoints(route, 50); // Every 50km
      chargingStops = await this.findOptimalChargingStops(
        routePoints,
        options,
        totalEnergyNeeded - usableEnergy
      );

      if (chargingStops.length === 0) {
        warnings.push('No suitable charging stations found along the route');
        needsCharging = false; // Can't charge, so plan without charging
      } else {
        // Recalculate battery level with charging stops
        batteryAtDestination = this.calculateBatteryWithCharging(
          options,
          route,
          chargingStops
        );
      }
    }

    if (batteryAtDestination < options.minimumBatteryLevel) {
      warnings.push(
        `Battery level at destination (${batteryAtDestination.toFixed(1)}%) below minimum (${options.minimumBatteryLevel}%)`
      );
    }

    return {
      needsCharging,
      chargingStops,
      energyAnalysis: {
        totalConsumption,
        batteryAtDestination,
        warnings,
      },
    };
  }

  /**
   * Generate route points at regular intervals
   */
  private generateRoutePoints(route: RouteResult, intervalKm: number): RoutePoint[] {
    const points: RoutePoint[] = [];
    const totalDistance = route.distance / 1000; // Convert to km
    const numPoints = Math.floor(totalDistance / intervalKm);

    // For simplicity, we'll create points along the direct line
    // In a real implementation, you'd interpolate along the actual route geometry
    const startWp = route.waypoints[0];
    const endWp = route.waypoints[route.waypoints.length - 1];

    for (let i = 1; i <= numPoints; i++) {
      const ratio = i / (numPoints + 1);
      const lat = startWp.latitude + (endWp.latitude - startWp.latitude) * ratio;
      const lng = startWp.longitude + (endWp.longitude - startWp.longitude) * ratio;

      points.push({
        longitude: lng,
        latitude: lat,
        name: `Route Point ${i}`,
      });
    }

    return points;
  }

  /**
   * Find optimal charging stops based on energy requirements
   */
  private async findOptimalChargingStops(
    routePoints: RoutePoint[],
    options: RoutePlanningOptions,
    energyDeficit: number
  ): Promise<RouteWaypoint[]> {
    const allStations = await this.findChargingStationsNearRoute(routePoints, options.maxDetourDistance, {
      connectorTypes: options.connectorTypes,
      minPowerRating: options.preferredPowerRating,
    });

    // Simple greedy algorithm to select charging stops
    const selectedStops: RouteWaypoint[] = [];
    let remainingEnergyNeeded = energyDeficit;

    for (const station of allStations) {
      if (remainingEnergyNeeded <= 0 || selectedStops.length >= (options.maxChargingStops || 3)) {
        break;
      }

      // Estimate charging time and energy gain (simplified)
      const chargingPower = station.powerRating || 50; // kW
      const chargingTime = Math.min(60, (remainingEnergyNeeded / chargingPower) * 60); // minutes
      const energyGained = (chargingTime / 60) * chargingPower; // kWh

      station.estimatedChargingTime = chargingTime;
      selectedStops.push(station);
      remainingEnergyNeeded -= energyGained;
    }

    return selectedStops;
  }

  /**
   * Calculate battery level with charging stops
   */
  private calculateBatteryWithCharging(
    options: RoutePlanningOptions,
    route: RouteResult,
    chargingStops: RouteWaypoint[]
  ): number {
    // Simplified calculation
    // In a real implementation, you'd calculate consumption and charging for each segment
    const totalChargingEnergy = chargingStops.reduce((total, stop) => {
      const chargingPower = stop.powerRating || 50;
      const chargingTime = stop.estimatedChargingTime || 30;
      return total + (chargingTime / 60) * chargingPower;
    }, 0);

    const maxEnergy = options.vehicleRange * 0.2; // Approximate battery capacity
    const consumptionRate = 0.2; // kWh/km
    const totalConsumption = (route.distance / 1000) * consumptionRate;

    const currentEnergy = (options.currentBatteryLevel / 100) * maxEnergy;
    const finalEnergy = currentEnergy + totalChargingEnergy - totalConsumption;

    return Math.min(100, (finalEnergy / maxEnergy) * 100);
  }

  /**
   * Get isochrone (reachable area) from a point
   */
  async getIsochrone(
    center: RoutePoint,
    ranges: number[], // in seconds or meters
    rangeType: 'time' | 'distance' = 'time',
    profile: string = 'driving-car'
  ): Promise<any> {
    try {
      const requestBody = {
        locations: [[center.longitude, center.latitude]],
        range: ranges,
        range_type: rangeType,
        profile,
        format: 'geojson',
      };

      const response = await axios.post(
        `${this.baseUrl}/isochrones/${profile}`,
        requestBody,
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Isochrone calculation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        center,
        ranges,
        rangeType,
      });
      throw error;
    }
  }

  /**
   * Return mock route data for development when API key is not available
   */
  private getMockRoute(start: RoutePoint, end: RoutePoint, waypoints: RoutePoint[] = []): RouteResult {
    // Calculate simple straight-line distance
    const distance = this.calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
    const duration = Math.round(distance * 60); // Rough estimate: 1km per minute
    
    return {
      distance: Math.round(distance * 1000), // Convert to meters
      duration: duration,
      geometry: {
        type: 'LineString',
        coordinates: [
          [start.longitude, start.latitude],
          ...waypoints.map(wp => [wp.longitude, wp.latitude]),
          [end.longitude, end.latitude]
        ]
      },
      waypoints: waypoints.length,
      ascent: 0,
      descent: 0
    };
  }

  /**
   * Calculate straight-line distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const routePlanningService = new RoutePlanningService();