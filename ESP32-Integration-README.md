# ESP32 Microcontroller Integration - Theoretical Implementation

## 📋 Overview

This is a **theoretical/academic implementation** demonstrating how ESP32 microcontrollers can be integrated with the AmarEV EV charging station management platform for real-time monitoring and telemetry.

**⚠️ IMPORTANT:** This code is for **educational and documentation purposes only**. It is NOT intended for production deployment without proper electrical engineering review, safety certifications, and extensive testing.

## 🎯 Project Goals

Demonstrate theoretical integration of IoT hardware (ESP32) with a full-stack web application to:
- Monitor charging station port status in real-time
- Collect sensor data (voltage, current, temperature)
- Enable remote diagnostics and fault detection
- Provide operators with live device health monitoring
- Showcase REST API and WebSocket communication patterns

## 🏗️ System Architecture

```
┌─────────────────┐
│  ESP32 Device   │
│  (Firmware)     │
│  - WiFi         │
│  - Sensors      │
│  - HTTP Client  │
└────────┬────────┘
         │ POST /telemetry
         │ (Every 30s)
         ▼
┌─────────────────┐      ┌──────────────┐
│  Backend API    │◄────►│   MongoDB    │
│  (Node.js)      │      │   Database   │
│  - REST API     │      └──────────────┘
│  - Device Auth  │
│  - Telemetry    │
│  - Socket.IO    │
└────────┬────────┘
         │ WebSocket Events
         ▼
┌─────────────────┐
│  Frontend UI    │
│  (React)        │
│  - Device List  │
│  - Real-time    │
│  - Dashboard    │
└─────────────────┘
```

## 📁 Implementation Structure

```
AmarEV/
├── Server/
│   ├── src/
│   │   ├── models/
│   │   │   ├── Device.ts              # Device schema
│   │   │   └── DeviceTelemetry.ts     # Telemetry schema
│   │   ├── services/
│   │   │   └── DeviceManagementService.ts  # Device logic
│   │   ├── controllers/
│   │   │   └── DeviceController.ts    # HTTP endpoints
│   │   ├── routes/
│   │   │   └── devices.ts             # API routes
│   │   └── middleware/
│   │       └── deviceAuth.ts          # Device authentication
│   └── index.ts                       # Added device routes & cron
│
├── Client/
│   ├── src/
│   │   ├── services/
│   │   │   └── deviceService.ts       # Frontend API client
│   │   ├── store/
│   │   │   └── slices/
│   │   │       └── deviceSlice.ts     # Redux state
│   │   ├── components/
│   │   │   └── Device/
│   │   │       ├── DeviceStatusIndicator.tsx
│   │   │       └── DeviceMonitoringWidget.tsx
│   │   └── pages/
│   │       └── OperatorDashboard.tsx  # Updated with widget
│   └── store.ts                       # Added device reducer
│
├── packages/
│   └── shared/
│       └── src/
│           └── types.ts               # Added Device types
│
├── firmware/
│   └── esp32_charging_monitor/
│       ├── esp32_charging_monitor.ino # ESP32 firmware
│       └── README.md                  # Hardware setup guide
│
└── ESP32-Device-API-Documentation.md  # Complete API docs
```

## 🔧 What Was Implemented

### 1. Backend (Node.js/Express)

#### Database Schemas
- **Device Model**: Stores ESP32 device information
  - Device ID, station mapping, API key
  - Status (online/offline/fault/maintenance)
  - Network info (IP, MAC, RSSI)
  - Last seen timestamp
  
- **DeviceTelemetry Model**: Historical sensor data
  - Voltage, current, power, energy
  - Temperature, humidity
  - Connector status
  - Auto-deletion after 90 days (TTL index)

#### API Endpoints
```
POST   /api/device/register          # Register new device
POST   /api/device/telemetry         # Receive telemetry
GET    /api/device/:id/status        # Get device health
GET    /api/device/:id/telemetry     # Get history
GET    /api/device/:id/health        # Health check ping
GET    /api/station/:id/devices      # List station devices
PUT    /api/device/:id               # Update device
DELETE /api/device/:id               # Deactivate device
```

#### Device Management Service
- `processTelemetry()`: Process incoming sensor data
- `detectOfflineDevices()`: Cron job (every 2 min) to mark offline devices
- `updateConnectorStatus()`: Update connector availability based on telemetry
- `checkForAlerts()`: Detect temperature/error anomalies
- `authenticateDevice()`: Validate device API keys

#### Authentication
- Device API key authentication (crypto-safe comparison)
- Operator role requirement for device management
- Separate auth flow from user JWT

#### Real-time Updates (Socket.IO)
- `device:updated` - Telemetry received
- `device:offline` - Device went offline
- `device:alert` - Fault or anomaly detected
- `connector:updated` - Connector status changed

### 2. Frontend (React/TypeScript)

#### Redux State Management
- `deviceSlice`: Device and telemetry state
- Actions: setDevice, updateDeviceStatus, addTelemetry
- Selectors: selectStationDevices, selectOnlineDevices

#### Components
- **DeviceStatusIndicator**: Color-coded status badge
  - Green (online, pulsing)
  - Gray (offline)
  - Red (fault)
  - Yellow (maintenance)
  
- **DeviceMonitoringWidget**: Operator dashboard widget
  - Device list with status
  - Live sensor readings
  - Summary statistics (online/offline/fault counts)

#### Integration Points
- Added to OperatorDashboard.tsx
- Real-time updates via Socket.IO
- Device service API client

### 3. ESP32 Firmware (Arduino/C++)

#### Features
- WiFi connectivity with auto-reconnect
- HTTP POST telemetry (JSON payload)
- Sensor reading:
  - DHT22 (temperature/humidity)
  - ACS712 (current sensor)
  - Voltage divider (AC voltage)
  - Digital input (connector status)
- 30-second telemetry interval
- Status LED indicators
- Error reporting
- Watchdog restart on consecutive failures

#### Hardware Requirements
- ESP32 Development Board
- DHT22 sensor
- ACS712 current sensor
- Voltage divider circuit
- Relay/switch for connector detection
- LED for status

### 4. Documentation

#### API Documentation
- Complete REST API reference
- Request/response examples
- Authentication guide
- WebSocket event specifications
- Error codes and handling
- Rate limiting specifications

#### Firmware Documentation
- Hardware wiring diagrams
- Library dependencies
- Configuration guide
- Calibration procedures
- Troubleshooting guide

## 🚀 How to Use (Theoretical)

### Step 1: Register Device (Operator)

```bash
curl -X POST http://localhost:5000/api/device/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <OPERATOR_JWT>" \
  -d '{
    "deviceId": "DEV-STATION001-PORT1",
    "stationId": "507f1f77bcf86cd799439011",
    "portId": "port_1",
    "name": "Station A - Port 1 Monitor"
  }'
```

Response includes API key (store securely!):
```json
{
  "success": true,
  "data": {
    "deviceId": "DEV-STATION001-PORT1",
    "apiKey": "abc123...",
    "stationId": "507f1f77bcf86cd799439011"
  }
}
```

### Step 2: Flash ESP32 Firmware

1. Open `firmware/esp32_charging_monitor/esp32_charging_monitor.ino`
2. Update configuration:
   ```cpp
   const char* WIFI_SSID = "your_wifi";
   const char* WIFI_PASSWORD = "your_password";
   const char* DEVICE_ID = "DEV-STATION001-PORT1";
   const char* API_KEY = "abc123...";
   ```
3. Upload to ESP32 via Arduino IDE

### Step 3: Monitor Devices

1. Login as operator
2. Navigate to Operator Dashboard
3. See Device Monitoring Widget on each station card
4. View live telemetry and device status

## 📊 Data Flow

### Telemetry Transmission

```
ESP32 → HTTP POST → Backend API → MongoDB
  ↓                      ↓            ↓
WiFi                Socket.IO    DeviceTelemetry
  ↓                      ↓
JSON                   React
                    Dashboard
```

### Sample Telemetry Payload

```json
{
  "deviceId": "DEV-001",
  "stationId": "507f1f77bcf86cd799439011",
  "voltage": 220.5,
  "current": 16.2,
  "power": 3500,
  "energyWh": 1250,
  "temperature": 42.5,
  "humidity": 65.0,
  "connectorStatus": "charging",
  "rssi": -65,
  "uptime": 86400
}
```

## 🔐 Security Considerations

### Current Implementation (Demonstration)
- ✅ Device API key authentication
- ✅ Crypto-safe key comparison
- ✅ Operator role requirement
- ✅ API keys not exposed in responses

### Production Requirements
- ⚠️ Use HTTPS/TLS encryption
- ⚠️ Implement certificate pinning
- ⚠️ Encrypt API keys in ESP32 flash
- ⚠️ Enable ESP32 secure boot
- ⚠️ Implement OTA firmware updates
- ⚠️ Add request signing
- ⚠️ Rate limiting per device

## ⚡ Performance & Scalability

### Offline Detection
- Cron job runs every 2 minutes
- Devices marked offline if no telemetry for 2+ minutes
- Auto-updates connector status to offline

### Telemetry Storage
- TTL index: Auto-delete after 90 days
- Efficient compound indexes for queries
- Limit history queries to 1000 records

### Real-time Updates
- Socket.IO namespaces (`/operator`, `/public`)
- Room-based broadcasting (per station)
- Minimal payload size

## 🧪 Testing

### Manual Testing

#### Test Device Registration
```bash
# Register device
POST /api/device/register

# Verify in MongoDB
db.devices.find({ deviceId: "DEV-001" })
```

#### Test Telemetry
```bash
# Send telemetry
curl -X POST http://localhost:5000/api/device/telemetry \
  -H "Content-Type: application/json" \
  -H "X-Device-API-Key: your_api_key" \
  -d '{"deviceId":"DEV-001","voltage":220.5,"temperature":42.5}'

# Check history
GET /api/device/DEV-001/telemetry?limit=10
```

#### Test Offline Detection
1. Send telemetry
2. Wait 3 minutes (don't send more)
3. Check device status → should be "offline"

### Sample Test Data

Create test device and telemetry:
```javascript
// In MongoDB shell or script
db.devices.insertOne({
  deviceId: "DEV-TEST-001",
  stationId: ObjectId("..."),
  name: "Test Device",
  type: "esp32",
  firmwareVersion: "1.0.0",
  status: "online",
  lastSeen: new Date(),
  apiKey: "test_api_key_hash",
  isActive: true
});
```

## 📚 Educational Value

This implementation demonstrates:

### Backend Concepts
- RESTful API design for IoT devices
- Device authentication patterns
- Time-series data storage (telemetry)
- Cron job scheduling (offline detection)
- Real-time communication (WebSocket)
- Error handling and validation

### Frontend Concepts
- Redux state management for IoT data
- Real-time UI updates
- Component composition
- TypeScript interfaces for type safety

### IoT Concepts
- HTTP-based telemetry transmission
- JSON data serialization
- WiFi connectivity management
- Sensor interfacing
- Error reporting and fault detection

### Full-Stack Integration
- End-to-end data flow (device → backend → frontend)
- Authentication across layers
- Real-time synchronization
- Scalable architecture patterns

## 🎓 Academic Applications

Suitable for:
- **Capstone Projects**: Full-stack IoT system
- **Thesis Work**: EV infrastructure monitoring
- **Course Projects**: Web development, embedded systems
- **Portfolio Demonstrations**: Modern tech stack integration

## ⚠️ Limitations & Disclaimers

### This is NOT Production-Ready Code

**Missing for Production:**
- ❌ Electrical safety certifications
- ❌ High-voltage circuit isolation
- ❌ Professional electrical engineering review
- ❌ Comprehensive error handling
- ❌ Failsafe mechanisms
- ❌ Security hardening (HTTPS, encryption)
- ❌ Load testing and optimization
- ❌ Monitoring and alerting systems
- ❌ Backup power for devices
- ❌ Physical security (tamper detection)

**Use Cases:**
- ✅ Academic research and documentation
- ✅ Proof of concept demonstrations
- ✅ Learning IoT integration patterns
- ✅ Architecture design reference

**NOT for:**
- ❌ Commercial deployment
- ❌ Safety-critical systems
- ❌ High-voltage installations without professional review

## 📖 Additional Resources

- [ESP32-Device-API-Documentation.md](./ESP32-Device-API-Documentation.md) - Complete API reference
- [firmware/esp32_charging_monitor/README.md](./firmware/esp32_charging_monitor/README.md) - Hardware setup
- [MongoDB TTL Indexes](https://docs.mongodb.com/manual/core/index-ttl/)
- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [Socket.IO Documentation](https://socket.io/docs/v4/)

## 🤝 Contributing

This is an academic project. For improvements or educational extensions:
1. Fork the repository
2. Create a feature branch
3. Document your changes thoroughly
4. Ensure code comments explain theoretical concepts

## 📄 License

Educational/Academic Use Only - Not for commercial deployment

## 👨‍💻 Author

Created for academic documentation and demonstration purposes as part of the AmarEV project proposal.

---

**Last Updated:** January 26, 2026  
**Version:** 1.0.0 (Theoretical Implementation)
