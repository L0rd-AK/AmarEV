/**
 * THEORETICAL ESP32 FIRMWARE - EV Charging Station Telemetry
 * 
 * ACADEMIC DEMONSTRATION CODE - NOT FOR PRODUCTION DEPLOYMENT
 * 
 * This Arduino/C++ code demonstrates how an ESP32 microcontroller would
 * theoretically monitor a charging station port and send telemetry to the backend.
 * 
 * Hardware Requirements:
 * - ESP32 Development Board (WiFi enabled)
 * - DHT22 Temperature & Humidity Sensor
 * - ACS712 Current Sensor (30A version)
 * - Voltage Divider Circuit (for voltage sensing)
 * - Relay Module (for connector status detection)
 * - Status LED
 * 
 * Wiring Diagram:
 * - DHT22 Data Pin -> GPIO 4
 * - Current Sensor -> GPIO 34 (ADC)
 * - Voltage Divider -> GPIO 35 (ADC)
 * - Connector Status -> GPIO 32 (Digital Input)
 * - Status LED -> GPIO 2
 * 
 * Libraries Required:
 * - WiFi.h (ESP32 built-in)
 * - HTTPClient.h (ESP32 built-in)
 * - ArduinoJson.h (install via Library Manager)
 * - DHT.h (Adafruit DHT sensor library)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ========== CONFIGURATION ==========

// WiFi Credentials (set these during device provisioning)
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend API Configuration
const char* API_ENDPOINT = "http://your-server.com/api/device/telemetry";
const char* DEVICE_ID = "DEV-001";  // Unique device identifier
const char* API_KEY = "your_device_api_key_here";  // From registration
const char* STATION_ID = "station_id_here";
const char* PORT_ID = "port_1";

// Sensor Pin Configuration
#define DHT_PIN 4
#define CURRENT_SENSOR_PIN 34
#define VOLTAGE_SENSOR_PIN 35
#define CONNECTOR_STATUS_PIN 32
#define STATUS_LED_PIN 2

// Sensor Configuration
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// Telemetry Configuration
#define TELEMETRY_INTERVAL 30000  // 30 seconds
#define HEARTBEAT_INTERVAL 60000  // 1 minute
#define WIFI_RETRY_DELAY 5000     // 5 seconds

// Calibration Constants
#define VOLTAGE_CALIBRATION 71.5  // Adjust based on voltage divider
#define CURRENT_CALIBRATION 0.066 // ACS712 30A sensitivity (66mV/A)
#define ADC_RESOLUTION 4095.0
#define ADC_VOLTAGE 3.3

// ========== GLOBAL VARIABLES ==========

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long bootTime = 0;
bool isConnectorActive = false;
float totalEnergyWh = 0.0;
unsigned long chargingStartTime = 0;

// Error tracking
int consecutiveErrors = 0;
const int MAX_CONSECUTIVE_ERRORS = 5;

// ========== SETUP ==========

void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================");
  Serial.println("ESP32 EV Charging Station Monitor");
  Serial.println("========================================");
  
  // Initialize pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(CONNECTOR_STATUS_PIN, INPUT_PULLUP);
  
  // Initialize sensors
  dht.begin();
  
  // Connect to WiFi
  connectWiFi();
  
  // Initialize boot time
  bootTime = millis();
  
  Serial.println("Setup complete. Starting main loop...\n");
}

// ========== MAIN LOOP ==========

void loop() {
  unsigned long currentTime = millis();
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    connectWiFi();
  }
  
  // Send telemetry data every 30 seconds
  if (currentTime - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    sendTelemetry();
    lastTelemetryTime = currentTime;
  }
  
  // Blink status LED to show device is alive
  blinkStatusLED();
  
  // Small delay to prevent watchdog timer issues
  delay(100);
}

// ========== WiFi FUNCTIONS ==========

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink while connecting
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    digitalWrite(STATUS_LED_PIN, HIGH); // Solid LED when connected
  } else {
    Serial.println("\nFailed to connect to WiFi!");
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(WIFI_RETRY_DELAY);
  }
}

// ========== SENSOR READING FUNCTIONS ==========

float readVoltage() {
  int rawValue = analogRead(VOLTAGE_SENSOR_PIN);
  float voltage = (rawValue / ADC_RESOLUTION) * ADC_VOLTAGE * VOLTAGE_CALIBRATION;
  return voltage;
}

float readCurrent() {
  // Read multiple samples for stability
  float sum = 0;
  int samples = 10;
  
  for (int i = 0; i < samples; i++) {
    int rawValue = analogRead(CURRENT_SENSOR_PIN);
    float voltage = (rawValue / ADC_RESOLUTION) * ADC_VOLTAGE;
    // ACS712 outputs 2.5V at 0A, varies by sensitivity
    float current = (voltage - 2.5) / CURRENT_CALIBRATION;
    sum += abs(current); // Take absolute value
    delay(10);
  }
  
  return sum / samples;
}

float readTemperature() {
  float temp = dht.readTemperature();
  if (isnan(temp)) {
    Serial.println("Failed to read temperature!");
    return 0.0;
  }
  return temp;
}

float readHumidity() {
  float humidity = dht.readHumidity();
  if (isnan(humidity)) {
    Serial.println("Failed to read humidity!");
    return 0.0;
  }
  return humidity;
}

bool isConnectorConnected() {
  // LOW = connected (assuming active-low relay/switch)
  return digitalRead(CONNECTOR_STATUS_PIN) == LOW;
}

String getConnectorStatus() {
  bool connected = isConnectorConnected();
  float current = readCurrent();
  
  if (!connected) {
    return "disconnected";
  } else if (current > 1.0) {  // Current threshold for charging
    return "charging";
  } else if (connected) {
    return "connected";
  } else {
    return "idle";
  }
}

// ========== TELEMETRY FUNCTIONS ==========

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot send telemetry - WiFi not connected");
    return;
  }
  
  Serial.println("\n--- Reading Sensors ---");
  
  // Read all sensors
  float voltage = readVoltage();
  float current = readCurrent();
  float power = voltage * current;  // Watts
  float temperature = readTemperature();
  float humidity = readHumidity();
  String connectorStatus = getConnectorStatus();
  int rssi = WiFi.RSSI();
  unsigned long uptime = (millis() - bootTime) / 1000; // seconds
  
  // Calculate energy (simple integration)
  if (connectorStatus == "charging") {
    if (chargingStartTime == 0) {
      chargingStartTime = millis();
    }
    unsigned long chargingDuration = (millis() - chargingStartTime) / 1000; // seconds
    totalEnergyWh += (power * chargingDuration) / 3600.0; // Wh
  } else {
    chargingStartTime = 0;
  }
  
  // Print sensor readings
  Serial.printf("Voltage: %.2f V\n", voltage);
  Serial.printf("Current: %.2f A\n", current);
  Serial.printf("Power: %.2f W\n", power);
  Serial.printf("Energy: %.2f Wh\n", totalEnergyWh);
  Serial.printf("Temperature: %.2f C\n", temperature);
  Serial.printf("Humidity: %.2f %%\n", humidity);
  Serial.printf("Connector: %s\n", connectorStatus.c_str());
  Serial.printf("RSSI: %d dBm\n", rssi);
  Serial.printf("Uptime: %lu seconds\n", uptime);
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["stationId"] = STATION_ID;
  doc["portId"] = PORT_ID;
  doc["voltage"] = round(voltage * 10) / 10.0;
  doc["current"] = round(current * 100) / 100.0;
  doc["power"] = round(power * 10) / 10.0;
  doc["energyWh"] = round(totalEnergyWh * 10) / 10.0;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["connectorStatus"] = connectorStatus;
  doc["rssi"] = rssi;
  doc["uptime"] = uptime;
  doc["timestamp"] = ""; // Server will use current time if empty
  
  // Serialize JSON
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  Serial.println("\n--- Sending Telemetry ---");
  Serial.println(jsonPayload);
  
  // Send HTTP POST request
  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-API-Key", API_KEY);
  
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP Response: %d\n", httpResponseCode);
    Serial.println(response);
    consecutiveErrors = 0; // Reset error counter
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
    Serial.println(http.errorToString(httpResponseCode));
    consecutiveErrors++;
    
    // If too many errors, restart device
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      Serial.println("Too many consecutive errors. Restarting...");
      delay(1000);
      ESP.restart();
    }
  }
  
  http.end();
  Serial.println("--- Telemetry Sent ---\n");
}

// ========== UTILITY FUNCTIONS ==========

void blinkStatusLED() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (millis() - lastBlink > 1000) {  // Blink every second
    ledState = !ledState;
    digitalWrite(STATUS_LED_PIN, ledState);
    lastBlink = millis();
  }
}

// ========== ERROR HANDLING ==========

void reportError(String errorCode, String errorMessage) {
  Serial.println("\n!!! ERROR DETECTED !!!");
  Serial.printf("Code: %s\n", errorCode.c_str());
  Serial.printf("Message: %s\n", errorMessage.c_str());
  
  // Create error telemetry
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["stationId"] = STATION_ID;
  doc["portId"] = PORT_ID;
  doc["errorCode"] = errorCode;
  doc["errorMessage"] = errorMessage;
  doc["timestamp"] = "";
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  // Send error report
  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-API-Key", API_KEY);
  http.POST(jsonPayload);
  http.end();
  
  // Fast blink LED to indicate error
  for (int i = 0; i < 6; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(100);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(100);
  }
}

/**
 * THEORETICAL DEPLOYMENT NOTES:
 * 
 * 1. Device Provisioning:
 *    - Flash this firmware to ESP32
 *    - Configure WiFi credentials via Serial or captive portal
 *    - Register device via backend API to get API_KEY
 *    - Store configuration in EEPROM/SPIFFS
 * 
 * 2. Security Considerations:
 *    - Use HTTPS for production (requires SSL certificates)
 *    - Implement certificate pinning
 *    - Encrypt API keys in flash memory
 *    - Use secure boot on ESP32
 * 
 * 3. Power Management:
 *    - Implement deep sleep between transmissions
 *    - Wake on connector state change
 *    - Use watchdog timer for crash recovery
 * 
 * 4. OTA Updates:
 *    - Implement firmware update via backend
 *    - Version checking on boot
 *    - Rollback on failed update
 * 
 * 5. Calibration:
 *    - Voltage divider ratio calibration
 *    - Current sensor offset calibration
 *    - Temperature sensor compensation
 */
