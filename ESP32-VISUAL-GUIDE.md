# 🎯 ESP32 Integration - Visual Implementation Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AMAREV ESP32 IOT SYSTEM                             │
│                     (Theoretical Implementation)                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   CHARGING STATION   │
                    │   (Physical Setup)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │      ESP32 DEVICE    │
                    │  ┌─────────────────┐ │
                    │  │ WiFi Module     │ │
                    │  │ Sensors:        │ │
                    │  │ - DHT22         │ │
                    │  │ - ACS712        │ │
                    │  │ - Voltage Div   │ │
                    │  │ - Relay Status  │ │
                    │  └─────────────────┘ │
                    └──────────┬───────────┘
                               │
                               │ HTTP POST
                               │ /api/device/telemetry
                               │ Every 30 seconds
                               │
                    ┌──────────▼───────────┐
                    │   BACKEND SERVER     │
                    │   (Node.js/Express)  │
                    │                      │
                    │ ┌────────────────┐   │
                    │ │ Device Routes  │   │
                    │ │ Authentication │   │
                    │ │ Telemetry Proc │   │
                    │ └────────────────┘   │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
      ┌─────────▼────────┐ ┌──▼───────┐  ┌──▼──────────┐
      │    MongoDB       │ │ Socket.IO│  │ Cron Jobs   │
      │                  │ │          │  │             │
      │ - devices        │ │ Events:  │  │ - Offline   │
      │ - telemetries    │ │ device:* │  │   Detection │
      │ (TTL 90 days)    │ │ connector│  │   (2 min)   │
      └──────────────────┘ └──┬───────┘  └─────────────┘
                               │
                               │ WebSocket
                               │ Real-time Updates
                               │
                    ┌──────────▼───────────┐
                    │  FRONTEND (React)    │
                    │                      │
                    │ ┌────────────────┐   │
                    │ │ Redux Store    │   │
                    │ │ deviceSlice    │   │
                    │ └────────────────┘   │
                    │                      │
                    │ ┌────────────────┐   │
                    │ │ Components:    │   │
                    │ │ - DeviceStatus │   │
                    │ │ - Monitoring   │   │
                    │ │ - Dashboard    │   │
                    │ └────────────────┘   │
                    └──────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  OPERATOR DASHBOARD  │
                    │  (Web Browser)       │
                    │                      │
                    │  👁 Real-time Status │
                    │  📊 Live Telemetry   │
                    │  🔔 Alerts           │
                    └──────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND STRUCTURE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Server/src/
│
├── models/                        (MongoDB Schemas)
│   ├── Device.ts                  ✅ 200+ lines
│   │   • deviceId (unique)        
│   │   • stationId (reference)
│   │   • status enum
│   │   • lastSeen timestamp
│   │   • apiKey (hashed)
│   │
│   └── DeviceTelemetry.ts         ✅ 130+ lines
│       • voltage, current, power
│       • temperature, humidity
│       • TTL index (90 days)
│
├── services/
│   └── DeviceManagementService.ts ✅ 450+ lines
│       ┌──────────────────────────────────────┐
│       │ registerDevice()                     │
│       │ processTelemetry()                   │
│       │ detectOfflineDevices()               │
│       │ updateConnectorStatus()              │
│       │ checkForAlerts()                     │
│       │ authenticateDevice()                 │
│       │ getDeviceHealth()                    │
│       │ getTelemetryHistory()                │
│       └──────────────────────────────────────┘
│
├── controllers/
│   └── DeviceController.ts        ✅ 350+ lines
│       ┌──────────────────────────────────────┐
│       │ registerDevice                       │
│       │ receiveTelemetry                     │
│       │ getDeviceStatus                      │
│       │ healthCheck                          │
│       │ getTelemetryHistory                  │
│       │ getStationDevices                    │
│       │ updateDevice                         │
│       │ deleteDevice                         │
│       └──────────────────────────────────────┘
│
├── routes/
│   └── devices.ts                 ✅ 80+ lines
│       ┌──────────────────────────────────────┐
│       │ POST   /device/register              │
│       │ POST   /device/telemetry             │
│       │ GET    /device/:id/status            │
│       │ GET    /device/:id/health            │
│       │ GET    /device/:id/telemetry         │
│       │ GET    /station/:id/devices          │
│       │ PUT    /device/:id                   │
│       │ DELETE /device/:id                   │
│       └──────────────────────────────────────┘
│
├── middleware/
│   └── deviceAuth.ts              ✅ 80+ lines
│       ┌──────────────────────────────────────┐
│       │ authenticateDevice()                 │
│       │ requireOperatorRole()                │
│       └──────────────────────────────────────┘
│
└── index.ts                       ✅ Updated
    • Device routes added
    • Cron job: detectOfflineDevices()
    • Runs every 2 minutes
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND STRUCTURE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Client/src/
│
├── services/
│   └── deviceService.ts           ✅ 90+ lines
│       ┌──────────────────────────────────────┐
│       │ registerDevice()                     │
│       │ getStationDevices()                  │
│       │ getDeviceStatus()                    │
│       │ getTelemetryHistory()                │
│       │ updateDevice()                       │
│       │ deleteDevice()                       │
│       └──────────────────────────────────────┘
│
├── store/
│   ├── store.ts                   ✅ Updated
│   │   • devices reducer added
│   │
│   └── slices/
│       └── deviceSlice.ts         ✅ 150+ lines
│           ┌──────────────────────────────────┐
│           │ State:                           │
│           │ • devices: Record<id, Device>    │
│           │ • telemetry: Record<id, Data[]>  │
│           │ • stationDevices: Map            │
│           │                                  │
│           │ Actions:                         │
│           │ • setDevice                      │
│           │ • updateDeviceStatus             │
│           │ • addTelemetry                   │
│           │                                  │
│           │ Selectors:                       │
│           │ • selectStationDevices           │
│           │ • selectOnlineDevices            │
│           └──────────────────────────────────┘
│
└── components/
    └── Device/
        ├── DeviceStatusIndicator.tsx  ✅ 120+ lines
        │   ┌──────────────────────────────┐
        │   │ • Green pulse (online)       │
        │   │ • Gray (offline)             │
        │   │ • Red (fault)                │
        │   │ • Yellow (maintenance)       │
        │   │ • Last seen time             │
        │   │ • Signal strength            │
        │   └──────────────────────────────┘
        │
        └── DeviceMonitoringWidget.tsx     ✅ 180+ lines
            ┌──────────────────────────────┐
            │ Summary Stats:               │
            │ • Total devices              │
            │ • Online count               │
            │ • Offline count              │
            │ • Fault count                │
            │                              │
            │ Device List:                 │
            │ • Click to select            │
            │ • Real-time status           │
            │                              │
            │ Telemetry Display:           │
            │ • Voltage, Current, Power    │
            │ • Temperature                │
            │ • Energy delivered           │
            │ • Connector status           │
            └──────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TELEMETRY DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: Sensor Reading (ESP32)
┌────────────────────────────┐
│  void loop() {             │
│    voltage = readVoltage() │ ──┐
│    current = readCurrent() │   │
│    temp = readTemp()       │   │ Build JSON
│  }                         │   │ Payload
└────────────────────────────┘   │
                                 ▼
STEP 2: HTTP Transmission        {
┌────────────────────────────┐   "deviceId": "DEV-001",
│  HTTPClient http;          │   "voltage": 220.5,
│  http.POST(payload)        │   "current": 16.2,
│  Header: X-Device-API-Key  │   "temperature": 42.5
└────────────────────────────┘  }
         │                       │
         │ WiFi (HTTP)           │
         ▼                       ▼
STEP 3: Backend Authentication
┌─────────────────────────────────────┐
│ authenticateDevice()                │
│ • Validate API key                  │
│ • Find device in database           │
│ • Check isActive = true             │
└─────────────────────────────────────┘
         │
         ▼
STEP 4: Process Telemetry
┌─────────────────────────────────────┐
│ processTelemetry()                  │
│ • Update device.lastSeen            │
│ • Set device.status = "online"      │
│ • Create DeviceTelemetry record     │
│ • Update connector status           │
└─────────────────────────────────────┘
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
STEP 5a: Save to MongoDB     STEP 5b: Emit Socket Event
┌─────────────────────────┐  ┌────────────────────────┐
│ DeviceTelemetry.save()  │  │ io.emit('device:      │
│                         │  │   updated', {         │
│ {                       │  │   deviceId,           │
│   voltage: 220.5,       │  │   telemetry: {...}    │
│   current: 16.2,        │  │ })                    │
│   timestamp: Date.now   │  │                        │
│ }                       │  └────────────────────────┘
└─────────────────────────┘            │
                                       │
                                       ▼
STEP 6: Frontend Update
┌─────────────────────────────────────┐
│ Socket.IO listener:                 │
│                                     │
│ socket.on('device:updated', (data) │
│   => dispatch(addTelemetry(data))   │
│ )                                   │
└─────────────────────────────────────┘
         │
         ▼
STEP 7: React Re-render
┌─────────────────────────────────────┐
│ DeviceMonitoringWidget              │
│ • useSelector(selectStationDevices) │
│ • Component updates                 │
│ • Display new telemetry values      │
│ • Status indicator pulses           │
└─────────────────────────────────────┘
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEVICE REGISTRATION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. Operator Login
   ┌──────────────────┐
   │ POST /auth/login │
   │ email + password │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ JWT Token        │
   │ (operator role)  │
   └────────┬─────────┘
            │
            ▼
2. Register Device
   ┌─────────────────────────────┐
   │ POST /device/register       │
   │ Header: Authorization: JWT  │
   │ Body: {                     │
   │   deviceId: "DEV-001",      │
   │   stationId: "...",         │
   │   name: "Port 1 Monitor"    │
   │ }                           │
   └────────┬────────────────────┘
            │
            ▼
3. Backend Processing
   ┌─────────────────────────────┐
   │ • Verify JWT (operator)     │
   │ • Check station ownership   │
   │ • Generate API key          │
   │   crypto.randomBytes(32)    │
   │ • Save to MongoDB           │
   └────────┬────────────────────┘
            │
            ▼
4. Response (ONE TIME ONLY!)
   ┌─────────────────────────────┐
   │ {                           │
   │   deviceId: "DEV-001",      │
   │   apiKey: "abc123...",      │  ← SAVE THIS!
   │   stationId: "..."          │
   │ }                           │
   └────────┬────────────────────┘
            │
            ▼
5. Configure ESP32
   ┌─────────────────────────────┐
   │ const char* API_KEY =       │
   │   "abc123...";              │
   │                             │
   │ Flash to ESP32              │
   └─────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELEMETRY AUTHENTICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

ESP32 Sends:
┌────────────────────────────────┐
│ POST /device/telemetry         │
│ Header: X-Device-API-Key: ...  │
│ Body: { deviceId, voltage, ... │
└────────┬───────────────────────┘
         │
         ▼
Middleware: deviceAuth.ts
┌────────────────────────────────┐
│ 1. Extract API key from header │
│ 2. Extract deviceId from body  │
│ 3. Call authenticateDevice()   │
└────────┬───────────────────────┘
         │
         ▼
Service: DeviceManagementService
┌────────────────────────────────┐
│ 1. Find device by deviceId     │
│ 2. Get stored apiKey (select+) │
│ 3. Compare using:              │
│    crypto.timingSafeEqual()    │
│    (prevents timing attacks)   │
└────────┬───────────────────────┘
         │
    ┌────┴────┐
    │ Valid?  │
    └────┬────┘
         │
    ┌────▼────┐    ┌────▼────┐
    │   YES   │    │   NO    │
    └────┬────┘    └────┬────┘
         │              │
         ▼              ▼
  Continue to     401 Unauthorized
  controller      "Invalid credentials"
```

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONGODB COLLECTIONS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

devices Collection
┌────────────────────────────────────────┐
│ {                                      │
│   _id: ObjectId,                       │
│   deviceId: "DEV-001",          [UNIQUE, INDEX]
│   stationId: ObjectId,          [INDEX]
│   portId: "port_1",             [INDEX]
│   name: "Port 1 Monitor",              │
│   type: "esp32",                       │
│   firmwareVersion: "1.0.0",            │
│   status: "online",             [INDEX]
│   lastSeen: ISODate,            [INDEX]
│   ipAddress: "192.168.1.100",         │
│   macAddress: "AA:BB:CC:DD:EE:FF",    │
│   rssi: -65,                           │
│   apiKey: "hashed_key",         [SELECT: false]
│   isActive: true,               [INDEX]
│   metadata: {                          │
│     installDate: ISODate,              │
│     notes: "..."                       │
│   },                                   │
│   createdAt: ISODate,                  │
│   updatedAt: ISODate                   │
│ }                                      │
└────────────────────────────────────────┘

Indexes:
• deviceId (unique)
• stationId + status
• lastSeen (for offline detection)
• isActive + status


devicetelemetries Collection
┌────────────────────────────────────────┐
│ {                                      │
│   _id: ObjectId,                       │
│   deviceId: ObjectId,           [INDEX]
│   stationId: ObjectId,          [INDEX]
│   portId: "port_1",                    │
│   type: "sensor_data",          [INDEX]
│   timestamp: ISODate,           [INDEX + TTL]
│   voltage: 220.5,                      │
│   current: 16.2,                       │
│   power: 3500,                         │
│   energyWh: 1250.5,                    │
│   temperature: 42.5,                   │
│   humidity: 65.0,                      │
│   connectorStatus: "charging",         │
│   rssi: -65,                           │
│   uptime: 86400,                       │
│   errorCode: null,                     │
│   errorMessage: null,                  │
│   createdAt: ISODate                   │
│ }                                      │
└────────────────────────────────────────┘

Indexes:
• deviceId + timestamp (descending)
• stationId + timestamp (descending)
• type + timestamp
• timestamp (TTL: 90 days auto-delete)
```

## WebSocket Events

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOCKET.IO EVENT FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

Namespace: /operator (for station owners)
┌────────────────────────────────────────┐
│ socket.on('connection')                │
│   → client joins room:                 │
│      `station:${stationId}`            │
└────────────────────────────────────────┘

Events Emitted:
┌────────────────────────────────────────┐
│ device:updated                         │
│ {                                      │
│   deviceId: "DEV-001",                 │
│   stationId: "...",                    │
│   status: "online",                    │
│   telemetry: {                         │
│     voltage: 220.5,                    │
│     current: 16.2,                     │
│     temperature: 42.5                  │
│   }                                    │
│ }                                      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ device:offline                         │
│ {                                      │
│   deviceId: "DEV-001",                 │
│   stationId: "...",                    │
│   lastSeen: "2026-01-26T10:28:00Z"    │
│ }                                      │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ device:alert                           │
│ {                                      │
│   deviceId: "DEV-001",                 │
│   alerts: [                            │
│     "High temperature: 85°C",          │
│     "Weak signal: -88 dBm"             │
│   ],                                   │
│   severity: "medium"                   │
│ }                                      │
└────────────────────────────────────────┘


Namespace: /public (for all users)
┌────────────────────────────────────────┐
│ connector:updated                      │
│ {                                      │
│   connectorId: "...",                  │
│   status: "occupied",                  │
│   timestamp: "..."                     │
│ }                                      │
└────────────────────────────────────────┘
```

## File Tree Summary

```
✅ = Implemented   📄 = Documentation

AmarEV/
│
├── Server/src/
│   ├── models/
│   │   ├── ✅ Device.ts                    (200 lines)
│   │   └── ✅ DeviceTelemetry.ts           (130 lines)
│   ├── services/
│   │   └── ✅ DeviceManagementService.ts   (450 lines)
│   ├── controllers/
│   │   └── ✅ DeviceController.ts          (350 lines)
│   ├── routes/
│   │   └── ✅ devices.ts                   (80 lines)
│   ├── middleware/
│   │   └── ✅ deviceAuth.ts                (80 lines)
│   └── ✅ index.ts                         (updated)
│
├── Client/src/
│   ├── services/
│   │   └── ✅ deviceService.ts             (90 lines)
│   ├── store/
│   │   ├── ✅ store.ts                     (updated)
│   │   └── slices/
│   │       └── ✅ deviceSlice.ts           (150 lines)
│   ├── components/Device/
│   │   ├── ✅ DeviceStatusIndicator.tsx    (120 lines)
│   │   ├── ✅ DeviceMonitoringWidget.tsx   (180 lines)
│   │   └── ✅ index.ts
│   └── pages/
│       └── ✅ OperatorDashboard.tsx        (updated)
│
├── packages/shared/src/
│   └── ✅ types.ts                         (updated)
│
├── firmware/esp32_charging_monitor/
│   ├── ✅ esp32_charging_monitor.ino       (500 lines)
│   └── 📄 README.md                        (200 lines)
│
└── Documentation/
    ├── 📄 ESP32-Integration-README.md      (450 lines)
    ├── 📄 ESP32-Device-API-Documentation.md (600 lines)
    ├── 📄 ESP32-Quick-Setup-Guide.md       (350 lines)
    └── 📄 ESP32-IMPLEMENTATION-SUMMARY.md  (400 lines)

Total: 17 files, ~4,250 lines of code & documentation
```

---

**Status:** ✅ COMPLETE  
**Date:** January 26, 2026  
**Purpose:** Academic/Theoretical Implementation  
**Visibility:** All changes integrated and visible in frontend
