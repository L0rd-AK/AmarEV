/**
 * Utility functions for date/time operations
 */
export class DateUtils {
  static formatForTimezone(date: Date, timezone: string = 'Asia/Dhaka'): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }

  static isWithinTimeWindow(
    currentTime: Date,
    startTime: string,
    endTime: string,
    timezone: string = 'Asia/Dhaka'
  ): boolean {
    const now = new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }));
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (startTotalMinutes <= endTotalMinutes) {
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    } else {
      // Crosses midnight
      return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
    }
  }

  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  static getTimeDifferenceInMinutes(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }
}

/**
 * Geospatial utility functions
 */
export class GeoUtils {
  static readonly EARTH_RADIUS_KM = 6371;

  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c * 1000; // Return in meters
  }

  static isWithinRadius(
    centerLat: number,
    centerLng: number,
    pointLat: number,
    pointLng: number,
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLng, pointLat, pointLng);
    return distance <= radiusMeters;
  }

  static getBoundingBox(
    centerLat: number,
    centerLng: number,
    radiusMeters: number
  ): {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  } {
    const latDelta = radiusMeters / (this.EARTH_RADIUS_KM * 1000) * (180 / Math.PI);
    const lngDelta = radiusMeters / (this.EARTH_RADIUS_KM * 1000 * Math.cos(this.toRadians(centerLat))) * (180 / Math.PI);

    return {
      northEast: {
        lat: centerLat + latDelta,
        lng: centerLng + lngDelta,
      },
      southWest: {
        lat: centerLat - latDelta,
        lng: centerLng - lngDelta,
      },
    };
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

/**
 * Validation utility functions
 */
export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidBangladeshiPhone(phone: string): boolean {
    // Bangladesh phone number format: +880 or 880 or 01 followed by 9 digits
    const phoneRegex = /^(\+?880|880|01)?[13-9]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }

  static isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  static isValidLatitude(lat: number): boolean {
    return lat >= -90 && lat <= 90;
  }

  static isValidLongitude(lng: number): boolean {
    return lng >= -180 && lng <= 180;
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>\"']/g, '');
  }
}

/**
 * Price calculation utilities
 */
export class PriceUtils {
  static calculateSessionCost(
    energyKWh: number,
    durationMinutes: number,
    pricePerKWh: number,
    pricePerMinute: number,
    sessionFee: number = 0
  ): number {
    const energyCost = energyKWh * pricePerKWh;
    const timeCost = durationMinutes * pricePerMinute;
    return Math.round((energyCost + timeCost + sessionFee) * 100) / 100; // Round to 2 decimal places
  }

  static estimateChargingTime(
    currentSocPercent: number,
    targetSocPercent: number,
    batteryCapacityKWh: number,
    chargingPowerKW: number,
    efficiency: number = 0.9
  ): number {
    const energyNeeded = ((targetSocPercent - currentSocPercent) / 100) * batteryCapacityKWh;
    const adjustedEnergyNeeded = energyNeeded / efficiency;
    return Math.ceil((adjustedEnergyNeeded / chargingPowerKW) * 60); // Return in minutes
  }

  static estimateRange(socPercent: number, batteryCapacityKWh: number, efficiencyKWhPer100Km: number = 20): number {
    const usableEnergy = (socPercent / 100) * batteryCapacityKWh;
    return Math.round((usableEnergy / efficiencyKWhPer100Km) * 100); // Return in km
  }

  static formatCurrency(amount: number, currency: string = 'BDT'): string {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

/**
 * Random ID and code generation utilities
 */
export class IdUtils {
  static generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  static generateQRCode(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  static generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateTransactionId(prefix: string = 'TXN'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }
}

/**
 * Array and object manipulation utilities
 */
export class ArrayUtils {
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  static sortBy<T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  static createApiError(
    message: string,
    code: string,
    statusCode: number,
    errors?: Array<{ field: string; message: string }>
  ) {
    return {
      message,
      code,
      statusCode,
      errors,
    };
  }

  static isApiError(error: any): error is { message: string; code: string; statusCode: number } {
    return error && typeof error.message === 'string' && typeof error.code === 'string' && typeof error.statusCode === 'number';
  }
}

/**
 * String manipulation utilities
 */
export class StringUtils {
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  static truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static removeSpecialChars(text: string): string {
    return text.replace(/[^\w\s]/gi, '');
  }
}