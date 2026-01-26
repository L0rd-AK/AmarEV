# ESP32 Device Integration API Documentation

**Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Theoretical/Academic Implementation

---

## Overview

This API enables ESP32 microcontrollers to register, authenticate, and send telemetry data to the AmarEV charging station management platform. This is a **theoretical implementation** for academic documentation purposes.

## Base URL

```
Production: https://api.amarev.com
Development: http://localhost:5000
```

All endpoints are prefixed with `/api/device`

---

## Authentication

### Device Authentication

Devices authenticate using an API key obtained during registration.

**Header:**
```
X-Device-API-Key: your_device_api_key_here
```

**Alternative:**
```
Authorization: Bearer your_device_api_key_here
```

### Operator Authentication

Device management endpoints require JWT authentication with operator or admin role.

**Header:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Endpoints

### 1. Register Device

Register a new ESP32 device to the system.

**Endpoint:** `POST /api/device/register`

**Authentication:** Operator JWT required

**Request Body:**
```json
{
  "deviceId": "DEV-STATION001-PORT1",
  "stationId": "507f1f77bcf86cd799439011",
  "portId": "507f191e810c19729de860ea",
  "name": "Station A - Port 1 Monitor",
  "type": "esp32",
  "firmwareVersion": "1.0.0",
  "macAddress": "AA:BB:CC:DD:EE:FF"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| deviceId | string | Yes | Unique device identifier (alphanumeric, hyphens, underscores) |
| stationId | string | Yes | MongoDB ObjectId of the station |
| portId | string | No | Connector/port ID this device monitors |
| name | string | Yes | Human-readable device name |
| type | string | No | Device type (esp32, esp32-s3, esp8266) |
| firmwareVersion | string | No | Firmware version (default: 1.0.0) |
| macAddress | string | No | MAC address in format AA:BB:CC:DD:EE:FF |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "deviceId": "DEV-STATION001-PORT1",
    "apiKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "stationId": "507f1f77bcf86cd799439011",
    "name": "Station A - Port 1 Monitor",
    "type": "esp32"
  }
}
```

**⚠️ IMPORTANT:** The `apiKey` is returned **only once**. Store it securely in the ESP32 firmware.

**Error Responses:**
```json
// 400 Bad Request - Missing fields
{
  "success": false,
  "message": "Missing required fields: deviceId, stationId, name"
}

// 401 Unauthorized
{
  "success": false,
  "message": "Authentication required"
}

// 409 Conflict - Device already exists
{
  "success": false,
  "message": "Device ID already registered"
}
```

---

### 2. Send Telemetry Data

Submit sensor readings and device status.

**Endpoint:** `POST /api/device/telemetry`

**Authentication:** Device API key required

**Headers:**
```
Content-Type: application/json
X-Device-API-Key: your_device_api_key_here
```

**Request Body:**
```json
{
  "deviceId": "DEV-STATION001-PORT1",
  "stationId": "507f1f77bcf86cd799439011",
  "portId": "507f191e810c19729de860ea",
  "voltage": 220.5,
  "current": 16.2,
  "power": 3500,
  "energyWh": 1250.5,
  "temperature": 42.5,
  "humidity": 65.0,
  "connectorStatus": "charging",
  "rssi": -65,
  "uptime": 86400,
  "timestamp": "2026-01-26T10:30:00Z"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| deviceId | string | Yes | Device identifier |
| stationId | string | No | Station ID (for validation) |
| portId | string | No | Port/connector ID |
| voltage | number | No | Voltage in Volts (0-1000) |
| current | number | No | Current in Amperes (0-500) |
| power | number | No | Power in Watts |
| energyWh | number | No | Total energy delivered in Wh |
| temperature | number | No | Temperature in Celsius (-40 to 125) |
| humidity | number | No | Humidity percentage (0-100) |
| connectorStatus | string | No | 'connected', 'disconnected', 'charging', 'idle' |
| rssi | number | No | WiFi signal strength in dBm (-100 to 0) |
| uptime | number | No | Device uptime in seconds |
| timestamp | string | No | ISO 8601 timestamp (server time used if omitted) |
| errorCode | string | No | Error code if fault detected |
| errorMessage | string | No | Error description |

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2026-01-26T10:30:15Z"
}
```

**Error Responses:**
```json
// 400 Bad Request
{
  "success": false,
  "message": "Missing deviceId in telemetry data"
}

// 401 Unauthorized
{
  "success": false,
  "message": "Invalid device credentials"
}
```

**Rate Limiting:** 2 requests per second per device

---

### 3. Health Check

Lightweight ping endpoint for devices to maintain connection.

**Endpoint:** `GET /api/device/:deviceId/health`

**Authentication:** Device API key required

**Response (200 OK):**
```json
{
  "success": true,
  "timestamp": "2026-01-26T10:30:00Z",
  "serverTime": 1706265000000
}
```

---

### 4. Get Device Status

Retrieve current device health and status.

**Endpoint:** `GET /api/device/:deviceId/status`

**Authentication:** User JWT required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "deviceId": "DEV-STATION001-PORT1",
    "status": "online",
    "lastSeen": "2026-01-26T10:30:00Z",
    "isOnline": true,
    "uptime": 86400,
    "rssi": -65,
    "temperature": 42.5,
    "recentErrors": 0
  }
}
```

---

### 5. Get Telemetry History

Retrieve historical telemetry data for a device.

**Endpoint:** `GET /api/device/:deviceId/telemetry`

**Authentication:** User JWT required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | string | No | ISO 8601 start date |
| endDate | string | No | ISO 8601 end date |
| limit | number | No | Max records to return (default: 100, max: 1000) |

**Example Request:**
```
GET /api/device/DEV-001/telemetry?startDate=2026-01-26T00:00:00Z&limit=50
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "deviceId": "507f191e810c19729de860ea",
      "stationId": "507f1f77bcf86cd799439011",
      "portId": "port_1",
      "type": "sensor_data",
      "timestamp": "2026-01-26T10:30:00Z",
      "voltage": 220.5,
      "current": 16.2,
      "power": 3500,
      "temperature": 42.5,
      "connectorStatus": "charging",
      "rssi": -65
    }
  ]
}
```

---

### 6. Get Station Devices

List all devices registered to a station.

**Endpoint:** `GET /api/station/:stationId/devices`

**Authentication:** User JWT required

**Response (200 OK):**
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "deviceId": "DEV-STATION001-PORT1",
      "stationId": "507f1f77bcf86cd799439011",
      "portId": "port_1",
      "name": "Port 1 Monitor",
      "type": "esp32",
      "firmwareVersion": "1.0.0",
      "status": "online",
      "lastSeen": "2026-01-26T10:30:00Z",
      "rssi": -65,
      "isActive": true,
      "createdAt": "2026-01-20T08:00:00Z"
    }
  ]
}
```

---

### 7. Update Device

Update device configuration.

**Endpoint:** `PUT /api/device/:deviceId`

**Authentication:** Operator JWT required

**Request Body:**
```json
{
  "name": "Updated Device Name",
  "firmwareVersion": "1.1.0",
  "status": "maintenance",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device updated successfully",
  "data": { /* updated device object */ }
}
```

---

### 8. Delete Device

Deactivate a device (soft delete).

**Endpoint:** `DELETE /api/device/:deviceId`

**Authentication:** Operator JWT required

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device deactivated successfully"
}
```

---

## WebSocket Events

Devices trigger real-time updates via Socket.IO.

### Server-to-Client Events

**Namespace:** `/operator`

#### `device:updated`
Emitted when device sends telemetry.

```javascript
{
  "deviceId": "DEV-001",
  "stationId": "507f1f77bcf86cd799439011",
  "status": "online",
  "lastSeen": "2026-01-26T10:30:00Z",
  "telemetry": {
    "voltage": 220.5,
    "current": 16.2,
    "power": 3500,
    "temperature": 42.5,
    "connectorStatus": "charging"
  },
  "timestamp": "2026-01-26T10:30:00Z"
}
```

#### `device:offline`
Emitted when device goes offline (no telemetry for 2+ minutes).

```javascript
{
  "deviceId": "DEV-001",
  "stationId": "507f1f77bcf86cd799439011",
  "lastSeen": "2026-01-26T10:28:00Z",
  "timestamp": "2026-01-26T10:30:00Z"
}
```

#### `device:alert`
Emitted when device reports anomalies.

```javascript
{
  "deviceId": "DEV-001",
  "stationId": "507f1f77bcf86cd799439011",
  "alerts": [
    "High temperature: 85.5°C",
    "Weak WiFi signal: -88 dBm"
  ],
  "severity": "medium",
  "timestamp": "2026-01-26T10:30:00Z"
}
```

**Namespace:** `/public`

#### `connector:updated`
Emitted when connector status changes based on device telemetry.

```javascript
{
  "connectorId": "507f191e810c19729de860ea",
  "status": "occupied",
  "timestamp": "2026-01-26T10:30:00Z"
}
```

---

## Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | BAD_REQUEST | Invalid request format or missing fields |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Device or resource not found |
| 409 | CONFLICT | Device ID already registered |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error |

---

## Device Status Enum

| Status | Description |
|--------|-------------|
| `online` | Device is actively sending telemetry |
| `offline` | No telemetry received for 2+ minutes |
| `fault` | Device reported an error |
| `maintenance` | Manually set to maintenance mode |

---

## Connector Status Enum

| Status | Description |
|--------|-------------|
| `disconnected` | No vehicle connected |
| `connected` | Vehicle connected, not charging |
| `charging` | Active charging session |
| `idle` | Connected but idle |

---

## Best Practices

### 1. Telemetry Frequency
- **Recommended:** Every 30 seconds during normal operation
- **During charging:** Every 10-15 seconds for accurate energy tracking
- **Idle/No vehicle:** Every 60 seconds to conserve bandwidth

### 2. Error Reporting
Always include `errorCode` and `errorMessage` when sending error telemetry:
```json
{
  "deviceId": "DEV-001",
  "errorCode": "TEMP_HIGH",
  "errorMessage": "Temperature exceeded 80°C threshold",
  "temperature": 85.5
}
```

### 3. Timestamp Format
Use ISO 8601 format: `2026-01-26T10:30:00Z`  
Server will use current time if omitted.

### 4. Network Resilience
- Implement exponential backoff on failed requests
- Queue telemetry locally if offline, sync when reconnected
- Maximum 5 consecutive failures before device restart

### 5. Security
- **Never** expose API keys in logs or Serial output
- Use HTTPS in production
- Implement certificate pinning
- Rotate API keys periodically

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /telemetry` | 2 requests/second per device |
| `GET /health` | 1 request/minute per device |
| Device management | 10 requests/minute per operator |

---

## Example Integration (ESP32)

```cpp
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* API_ENDPOINT = "http://api.amarev.com/api/device/telemetry";
const char* API_KEY = "your_api_key_here";

void sendTelemetry() {
  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-API-Key", API_KEY);
  
  StaticJsonDocument<512> doc;
  doc["deviceId"] = "DEV-001";
  doc["voltage"] = 220.5;
  doc["current"] = 16.2;
  doc["temperature"] = 42.5;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpCode = http.POST(payload);
  http.end();
}
```

---

## Support

This is theoretical demonstration documentation. For production implementation, consult the full technical specifications and security guidelines.

**Documentation Version:** 1.0  
**API Version:** v1  
**Last Updated:** January 26, 2026
