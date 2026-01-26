import React from 'react';
import { Device, DeviceStatus } from '@chargebd/shared';

/**
 * THEORETICAL DEVICE STATUS INDICATOR
 * Visual component showing ESP32 device connection status
 * Displays online/offline status with color-coded indicators
 */

interface DeviceStatusIndicatorProps {
  device: Device;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const DeviceStatusIndicator: React.FC<DeviceStatusIndicatorProps> = ({
  device,
  showDetails = false,
  size = 'medium',
}) => {
  const getStatusColor = (status: DeviceStatus): string => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'fault':
        return 'bg-red-500';
      case 'maintenance':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusText = (status: DeviceStatus): string => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'fault':
        return 'Fault';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unknown';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-2 h-2';
      case 'medium':
        return 'w-3 h-3';
      case 'large':
        return 'w-4 h-4';
    }
  };

  const isRecentlyActive = () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return new Date(device.lastSeen) >= twoMinutesAgo;
  };

  const getLastSeenText = () => {
    const now = Date.now();
    const lastSeen = new Date(device.lastSeen).getTime();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`${getSizeClasses()} rounded-full ${getStatusColor(device.status)}`}
        />
        {device.status === 'online' && isRecentlyActive() && (
          <div
            className={`${getSizeClasses()} rounded-full ${getStatusColor(device.status)} absolute inset-0 animate-ping opacity-75`}
          />
        )}
      </div>
      
      {showDetails && (
        <div className="flex flex-col text-sm">
          <span className="font-medium text-gray-900">
            {getStatusText(device.status)}
          </span>
          <span className="text-xs text-gray-500">
            Last seen: {getLastSeenText()}
          </span>
          {device.rssi && (
            <span className="text-xs text-gray-500">
              Signal: {device.rssi} dBm
            </span>
          )}
        </div>
      )}
    </div>
  );
};
