# ESP32 Charging Station Monitor Firmware

## Overview
This is **theoretical demonstration firmware** for an ESP32 microcontroller that monitors an EV charging station port and sends real-time telemetry to the backend server.

**⚠️ ACADEMIC USE ONLY - NOT FOR PRODUCTION DEPLOYMENT**

## Hardware Requirements

### Components
- **ESP32 Development Board** (WiFi enabled)
- **DHT22** Temperature & Humidity Sensor
- **ACS712** Current Sensor (30A version)
- **Voltage Divider** Circuit for voltage sensing
- **Relay Module** for connector status detection
- **LED** for status indication
- **Breadboard & Jumper Wires**

### Pin Connections

| Component | ESP32 Pin | Notes |
|-----------|-----------|-------|
| DHT22 Data | GPIO 4 | Temperature & humidity |
| Current Sensor | GPIO 34 (ADC1_6) | Analog input |
| Voltage Divider | GPIO 35 (ADC1_7) | Analog input |
| Connector Status | GPIO 32 | Digital input (pull-up) |
| Status LED | GPIO 2 | Built-in LED on most boards |

### Voltage Divider Circuit
For measuring AC voltage (220V):
```
220V AC ──┬── 470kΩ ──┬── GPIO 35
          │           │
          └── Fuse    └── 6.8kΩ ──┬── GND
                                   │
                              100nF Cap
```
**Ratio:** ~71.5:1 (adjust VOLTAGE_CALIBRATION constant)

## Software Requirements

### Arduino IDE Setup
1. Install Arduino IDE 2.0+
2. Add ESP32 board support:
   - File → Preferences → Additional Board Manager URLs
   - Add: `https://dl.espressif.com/dl/package_esp32_index.json`
3. Tools → Board → Board Manager → Install "ESP32"

### Required Libraries
Install via Library Manager (Sketch → Include Library → Manage Libraries):

- **ArduinoJson** (v6.x) - JSON serialization
- **DHT sensor library** by Adafruit - Temperature/humidity
- **Adafruit Unified Sensor** - Dependency for DHT

WiFi and HTTPClient are built-in for ESP32.

## Configuration

### 1. WiFi Credentials
Edit in the code:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### 2. Backend API
```cpp
const char* API_ENDPOINT = "http://your-server.com/api/device/telemetry";
```

### 3. Device Registration
First, register the device via backend API:
```bash
POST /api/device/register
{
  "deviceId": "DEV-001",
  "stationId": "station_id_here",
  "portId": "port_1",
  "name": "Station A - Port 1 Monitor"
}
```

Response will include **API_KEY** - copy this to the firmware:
```cpp
const char* API_KEY = "your_device_api_key_here";
```

### 4. Device Identification
```cpp
const char* DEVICE_ID = "DEV-001";
const char* STATION_ID = "station_id_here";
const char* PORT_ID = "port_1";
```

## Flashing Firmware

1. **Connect ESP32** to computer via USB
2. **Select Board**: Tools → Board → ESP32 Dev Module
3. **Select Port**: Tools → Port → (your ESP32 port)
4. **Upload**: Sketch → Upload
5. **Monitor**: Tools → Serial Monitor (115200 baud)

## Operation

### Telemetry Data Sent Every 30 Seconds
```json
{
  "deviceId": "DEV-001",
  "stationId": "station_id",
  "portId": "port_1",
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

### Connector Status States
- **disconnected**: No vehicle connected
- **connected**: Vehicle connected, not charging
- **charging**: Active charging session
- **idle**: Connected but idle

### LED Indicators
- **Blinking slowly (1 Hz)**: Normal operation
- **Blinking fast**: WiFi connecting
- **Fast blinks (6x)**: Error occurred
- **Off**: No power or WiFi failed

## Calibration

### Voltage Sensor
1. Measure actual voltage with multimeter
2. Compare with ESP32 reading
3. Adjust `VOLTAGE_CALIBRATION` constant

### Current Sensor (ACS712)
1. Zero calibration: No current → should read ~2.5V
2. Load calibration: Apply known current
3. Adjust `CURRENT_CALIBRATION` if needed

## Troubleshooting

### WiFi Won't Connect
- Check SSID and password
- Ensure 2.4 GHz WiFi (ESP32 doesn't support 5 GHz)
- Move closer to router
- Check Serial Monitor for error messages

### Sensor Readings Wrong
- Check wiring connections
- Verify sensor power (3.3V for DHT22)
- Run calibration procedure
- Check for loose connections

### HTTP Errors
- Verify API_ENDPOINT URL
- Check API_KEY is correct
- Ensure device is registered
- Check backend server is running

## Security Notes (Production)

This is demonstration code. For production deployment:

1. **Use HTTPS** instead of HTTP
2. **Implement SSL certificate verification**
3. **Encrypt API keys** in flash storage
4. **Use secure boot** on ESP32
5. **Implement OTA** (Over-The-Air) firmware updates
6. **Add watchdog timer** for crash recovery
7. **Rate limiting** on telemetry sends

## Power Optimization

For battery-powered deployments:
```cpp
// Add deep sleep between transmissions
esp_sleep_enable_timer_wakeup(30 * 1000000); // 30 seconds
esp_deep_sleep_start();
```

## File Structure
```
firmware/
└── esp32_charging_monitor/
    ├── esp32_charging_monitor.ino  # Main firmware file
    └── README.md                    # This file
```

## License
Educational/Academic Use Only - Not for commercial deployment

## Support
This is theoretical demonstration code. For production implementation, consult qualified electrical and embedded systems engineers.
