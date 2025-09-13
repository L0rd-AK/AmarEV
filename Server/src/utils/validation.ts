import { z } from 'zod';
import { UserRole, ConnectorStandard, ConnectorType, ConnectorStatus, ReservationStatus, PaymentProvider } from '@chargebd/shared';

// Auth validation schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50),
  phone: z.string().regex(/^(\+?880|880|01)?[13-9]\d{8}$/, 'Invalid Bangladesh phone number').optional(),
  language: z.enum(['en', 'bn']).default('en'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// User validation schemas
export const updateUserSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  phone: z.string().regex(/^(\+?880|880|01)?[13-9]\d{8}$/, 'Invalid Bangladesh phone number').optional(),
  language: z.enum(['en', 'bn']).optional(),
});

// Vehicle validation schemas
export const createVehicleSchema = z.object({
  make: z.string().min(1, 'Make is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  year: z.number().int().min(2010).max(new Date().getFullYear() + 2).optional(),
  connectorType: z.array(z.nativeEnum(ConnectorStandard)).min(1, 'At least one connector type is required'),
  usableKWh: z.number().min(10, 'Battery capacity must be at least 10 kWh').max(200),
  maxACkW: z.number().min(3, 'AC charging power must be at least 3 kW').max(50),
  maxDCkW: z.number().min(10, 'DC charging power must be at least 10 kW').max(350),
  isDefault: z.boolean().default(false),
});

export const updateVehicleSchema = createVehicleSchema.partial();

// Station validation schemas
export const locationSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

export const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  area: z.string().min(1, 'Area is required'),
  city: z.string().min(1, 'City is required'),
  division: z.string().min(1, 'Division is required'),
  postalCode: z.string().optional(),
});

export const openingHoursSchema = z.object({
  monday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  tuesday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  wednesday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  thursday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  friday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  saturday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
  sunday: z.object({ open: z.string(), close: z.string() }).nullable().optional(),
});

export const createStationSchema = z.object({
  name: z.string().min(1, 'Station name is required').max(100),
  location: locationSchema,
  address: addressSchema,
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string().url('Invalid photo URL')).default([]),
  timezone: z.string().default('Asia/Dhaka'),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
  openingHours: openingHoursSchema.optional(),
});

export const updateStationSchema = createStationSchema.partial();

export const stationSearchSchema = z.object({
  bbox: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/, 'Invalid bbox format').optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(100).max(50000).default(5000).optional(),
  ac_min_kw: z.coerce.number().min(3).max(50).optional(),
  dc_min_kw: z.coerce.number().min(10).max(350).optional(),
  connector_type: z.nativeEnum(ConnectorStandard).optional(),
  open_now: z.coerce.boolean().optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

// Connector validation schemas
export const createConnectorSchema = z.object({
  stationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid station ID'),
  type: z.nativeEnum(ConnectorType),
  standard: z.nativeEnum(ConnectorStandard),
  maxKw: z.number().min(3).max(350),
  pricePerKWhBDT: z.number().min(0),
  pricePerMinuteBDT: z.number().min(0),
  sessionFeeBDT: z.number().min(0).default(0),
  status: z.nativeEnum(ConnectorStatus).default(ConnectorStatus.AVAILABLE),
});

export const updateConnectorSchema = createConnectorSchema.partial().omit({ stationId: true });

// Reservation validation schemas
export const createReservationSchema = z.object({
  stationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid station ID'),
  connectorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid connector ID'),
  vehicleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID'),
  startTime: z.string().datetime('Invalid start time format'),
  endTime: z.string().datetime('Invalid end time format'),
  notes: z.string().max(500).optional(),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const updateReservationStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  notes: z.string().max(500).optional(),
});

// Session validation schemas
export const createSessionSchema = z.object({
  reservationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid reservation ID').optional(),
  stationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid station ID'),
  connectorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid connector ID'),
  vehicleId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID'),
});

export const updateSessionSchema = z.object({
  endTime: z.string().datetime().optional(),
  totalEnergyKWh: z.number().min(0).optional(),
  averagePowerKw: z.number().min(0).optional(),
  totalCostBDT: z.number().min(0).optional(),
});

// Payment validation schemas
export const createPaymentIntentSchema = z.object({
  provider: z.nativeEnum(PaymentProvider),
  amount: z.number().min(10, 'Minimum amount is 10 BDT').max(100000),
  currency: z.string().default('BDT'),
  reservationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid reservation ID').optional(),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID').optional(),
});

export const confirmPaymentSchema = z.object({
  paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid payment ID'),
  gatewayTransactionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Review validation schemas
export const createReviewSchema = z.object({
  stationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid station ID'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).default([]),
});

export const updateReviewSchema = createReviewSchema.partial().omit({ stationId: true });

// Route planning validation schemas
export const routePlanSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  vehicle: z.object({
    currentSocPercent: z.number().min(0).max(100),
    usableKWh: z.number().min(10).max(200),
    maxACkW: z.number().min(3).max(50),
    maxDCkW: z.number().min(10).max(350),
    connectorTypes: z.array(z.nativeEnum(ConnectorStandard)).min(1),
  }),
  waypoints: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).optional(),
  maxStops: z.number().int().min(0).max(10).default(3),
});

// Common validation schemas
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).refine((data) => {
  if (data.from && data.to) {
    return new Date(data.to) > new Date(data.from);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['to'],
});