# ESP32 Integration Quick Setup Guide

**⚠️ THEORETICAL IMPLEMENTATION - EDUCATIONAL PURPOSES ONLY**

This guide walks through setting up the ESP32 device integration for demonstration purposes.

## Prerequisites

### Backend Requirements
- ✅ Node.js 18+
- ✅ MongoDB running
- ✅ Backend server running on port 5000

### Frontend Requirements
- ✅ React development server running
- ✅ Operator account created

### Hardware (Optional - for actual testing)
- ESP32 Development Board
- DHT22 Temperature Sensor
- ACS712 Current Sensor
- Breadboard and jumper wires
- USB cable for programming

## Setup Steps

### 1. Backend Setup (Already Implemented ✅)

The following files have been created:

```
Server/src/
├── models/
│   ├── Device.ts
│   └── DeviceTelemetry.ts
├── services/
│   └── DeviceManagementService.ts
├── controllers/
│   └── DeviceController.ts
├── routes/
│   └── devices.ts
└── middleware/
    └── deviceAuth.ts
```

**What was added:**
- Device registration endpoint
- Telemetry processing
- Offline detection (cron job every 2 minutes)
- Socket.IO real-time events
- Device authentication middleware

### 2. Frontend Setup (Already Implemented ✅)

The following files have been created:

```
Client/src/
├── services/
│   └── deviceService.ts
├── store/slices/
│   └── deviceSlice.ts
└── components/Device/
    ├── DeviceStatusIndicator.tsx
    └── DeviceMonitoringWidget.tsx
```

**What was added:**
- Redux device state management
- Device monitoring widget
- Real-time status indicators
- Updated OperatorDashboard

### 3. Verify Backend is Running

```bash
# Start backend
cd Server
npm run dev
```

You should see:
```
✅ MongoDB connected successfully
✅ Socket.IO configured successfully
✅ Device offline detection cron job started
🚀 Server running on port 5000
```

### 4. Verify Frontend is Running

```bash
# Start frontend
cd Client
npm run dev
```

Visit: `http://localhost:5173`

### 5. Create Test Device (API Testing)

#### Option A: Using cURL

```bash
# First, login as operator and get JWT token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@example.com",
    "password": "yourpassword"
  }'

# Save the token from response, then register device
curl -X POST http://localhost:5000/api/device/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "deviceId": "DEV-TEST-001",
    "stationId": "YOUR_STATION_ID_HERE",
    "portId": "port_1",
    "name": "Test Device - Port 1",
    "type": "esp32",
    "firmwareVersion": "1.0.0"
  }'
```

**Save the API key from the response!** You'll need it for telemetry.

#### Option B: Using Postman

1. **Login:**
   - POST `http://localhost:5000/api/auth/login`
   - Body: `{"email":"operator@example.com","password":"password"}`
   - Copy JWT token

2. **Register Device:**
   - POST `http://localhost:5000/api/device/register`
   - Header: `Authorization: Bearer <JWT_TOKEN>`
   - Body:
     ```json
     {
       "deviceId": "DEV-TEST-001",
       "stationId": "your_station_id",
       "portId": "port_1",
       "name": "Test Device"
     }
     ```
   - Save the returned API key

### 6. Send Test Telemetry

```bash
# Replace API_KEY with the one from step 5
curl -X POST http://localhost:5000/api/device/telemetry \
  -H "Content-Type: application/json" \
  -H "X-Device-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "deviceId": "DEV-TEST-001",
    "voltage": 220.5,
    "current": 16.2,
    "power": 3500,
    "energyWh": 1250,
    "temperature": 42.5,
    "humidity": 65.0,
    "connectorStatus": "charging",
    "rssi": -65,
    "uptime": 3600
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "timestamp": "2026-01-26T10:30:00Z"
}
```

### 7. View in Frontend

1. Login as operator at `http://localhost:5173`
2. Navigate to Operator Dashboard
3. Find your station
4. Scroll to "Device Monitoring" section
5. You should see:
   - Device listed with green "online" status
   - Latest telemetry readings
   - Summary statistics

### 8. Test Offline Detection

1. Send telemetry once
2. Wait 3 minutes (don't send more telemetry)
3. The cron job will mark device as offline
4. Refresh dashboard → device status should be gray/offline
5. Send telemetry again → device comes back online

### 9. Test Real-time Updates (Optional)

**Terminal 1: Send continuous telemetry**
```bash
# Simple loop to send telemetry every 30 seconds
while true; do
  curl -X POST http://localhost:5000/api/device/telemetry \
    -H "Content-Type: application/json" \
    -H "X-Device-API-Key: YOUR_API_KEY" \
    -d '{
      "deviceId": "DEV-TEST-001",
      "voltage": 220.5,
      "current": 16.2,
      "temperature": 42.5,
      "connectorStatus": "charging"
    }'
  sleep 30
done
```

**Browser: Open Operator Dashboard**
- Device status should pulse green
- Telemetry values update in real-time via Socket.IO

### 10. Optional: Flash ESP32 Hardware

If you have physical ESP32 hardware:

1. **Install Arduino IDE**
   - Download from [arduino.cc](https://www.arduino.cc/en/software)
   - Add ESP32 board support

2. **Install Libraries**
   - ArduinoJson (v6.x)
   - DHT sensor library
   - Adafruit Unified Sensor

3. **Configure Firmware**
   - Open `firmware/esp32_charging_monitor/esp32_charging_monitor.ino`
   - Update WiFi credentials
   - Update device ID and API key (from step 5)
   - Update API endpoint to your server

4. **Wire Hardware**
   - Follow wiring diagram in firmware README
   - DHT22 → GPIO 4
   - Current sensor → GPIO 34
   - Status LED → GPIO 2

5. **Upload**
   - Connect ESP32 via USB
   - Select board: ESP32 Dev Module
   - Upload sketch
   - Open Serial Monitor (115200 baud)

6. **Monitor**
   - Serial output shows telemetry being sent
   - Frontend shows real-time updates

## Quick Test Checklist

- [ ] Backend server running
- [ ] Frontend running
- [ ] Operator account created
- [ ] Station created
- [ ] Device registered (API key saved)
- [ ] Test telemetry sent successfully
- [ ] Device appears in dashboard
- [ ] Device shows "online" status
- [ ] Telemetry values displayed
- [ ] Waited 3 minutes → device goes offline
- [ ] Sent telemetry → device back online

## Troubleshooting

### Device Registration Fails

**Error:** "Authentication required"
- **Fix:** Make sure JWT token is valid and in Authorization header

**Error:** "Station not found or unauthorized"
- **Fix:** Use a station ID that belongs to the logged-in operator

**Error:** "Device ID already registered"
- **Fix:** Use a different deviceId or delete the existing device

### Telemetry Not Accepted

**Error:** "Invalid device credentials"
- **Fix:** Check API key is correct in `X-Device-API-Key` header

**Error:** "Missing deviceId"
- **Fix:** Ensure `deviceId` field is in request body

### Device Not Showing in Dashboard

1. **Check device is registered:**
   ```bash
   # In MongoDB shell
   use amarev
   db.devices.find({ deviceId: "DEV-TEST-001" })
   ```

2. **Check stationId matches:**
   - Device `stationId` must match the station you're viewing

3. **Verify frontend API:**
   - Open browser DevTools → Network tab
   - Check `/api/station/:id/devices` request

### Device Stuck Offline

1. **Send telemetry** - device should immediately go online
2. **Check server logs** - look for telemetry processing
3. **Verify cron job is running** - should log every 2 minutes

### Real-time Updates Not Working

1. **Check Socket.IO connection:**
   - Browser DevTools → Console
   - Look for WebSocket connection logs

2. **Verify Socket.IO namespaces:**
   - Backend emits to `/operator` namespace
   - Frontend should subscribe to correct namespace

## MongoDB Queries (Useful for Debugging)

```javascript
// Check all devices
db.devices.find().pretty()

// Check telemetry for a device
db.devicetelemetries.find({ 
  deviceId: ObjectId("...") 
}).sort({ timestamp: -1 }).limit(10)

// Count telemetry records
db.devicetelemetries.countDocuments()

// Delete test device
db.devices.deleteOne({ deviceId: "DEV-TEST-001" })

// Delete all telemetry for a device
db.devicetelemetries.deleteMany({ deviceId: ObjectId("...") })
```

## Environment Variables

Make sure these are set in `Server/.env`:

```env
# Required
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
MONGODB_URI=mongodb://localhost:27017/amarev

# Optional
PORT=5000
BASE_URL=http://localhost:3000
NODE_ENV=development
```

## Next Steps

After successful setup:

1. **Explore the code:**
   - Read through DeviceManagementService.ts
   - Understand telemetry processing flow
   - Review Socket.IO event emissions

2. **Customize:**
   - Add new sensor types
   - Implement alerts/notifications
   - Create analytics dashboards

3. **Document:**
   - This is for academic purposes
   - Document your understanding
   - Explain the architecture in your report

4. **Extend (Ideas):**
   - Device firmware OTA updates
   - Energy consumption analytics
   - Predictive maintenance alerts
   - Device health scoring
   - Historical trend charts

## Support

This is a theoretical implementation for educational purposes. Refer to:
- [ESP32-Integration-README.md](./ESP32-Integration-README.md) - Full overview
- [ESP32-Device-API-Documentation.md](./ESP32-Device-API-Documentation.md) - API reference
- [firmware/esp32_charging_monitor/README.md](./firmware/esp32_charging_monitor/README.md) - Hardware guide

---

**Last Updated:** January 26, 2026  
**Status:** Theoretical Implementation Complete ✅
