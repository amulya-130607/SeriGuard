#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ── Config ────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "https://YOUR_RAILWAY_URL.railway.app";

// ── Pin Definitions ───────────────────────────────────────────────────────────
#define DHT_PIN        4    // DHT22 data pin
#define DHT_TYPE       DHT22
#define MQ135_PIN      34   // Analog input (ADC)
#define FAN_PIN        26   // Relay 1
#define HUMIDIFIER_PIN 27   // Relay 2
#define EXHAUST_PIN    25   // Relay 3
#define BUZZER_PIN     33   // Relay 4

#define SEND_INTERVAL  3000  // ms between sensor pushes
#define POLL_INTERVAL  2000  // ms between device state polls

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastSend = 0;
unsigned long lastPoll = 0;

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  dht.begin();

  pinMode(FAN_PIN,        OUTPUT);
  pinMode(HUMIDIFIER_PIN, OUTPUT);
  pinMode(EXHAUST_PIN,    OUTPUT);
  pinMode(BUZZER_PIN,     OUTPUT);
  // Start all relays OFF
  digitalWrite(FAN_PIN, LOW);
  digitalWrite(HUMIDIFIER_PIN, LOW);
  digitalWrite(EXHAUST_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
}

// ── Main Loop ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Push sensor data every SEND_INTERVAL
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    sendSensorData();
  }

  // Poll device states every POLL_INTERVAL
  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollDevices();
  }
}

// ── Send sensor readings to server ───────────────────────────────────────────
void sendSensorData() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int   aq   = analogRead(MQ135_PIN); // raw 0–4095 on ESP32

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[Sensor] DHT read failed, skipping.");
    return;
  }

  Serial.printf("[Sensor] T=%.1f°C  H=%.1f%%  AQ=%d\n", temp, hum, aq);

  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/sensor");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["temperature"] = temp;
  doc["humidity"]    = hum;
  doc["airQuality"]  = aq;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    Serial.println("[POST] Sensor data sent OK");
  } else {
    Serial.printf("[POST] Failed, HTTP %d\n", code);
  }
  http.end();
}

// ── Poll device states and apply to relays ───────────────────────────────────
void pollDevices() {
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/devices");

  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err) {
      applyRelay(FAN_PIN,        doc["fan"]        | false);
      applyRelay(HUMIDIFIER_PIN, doc["humidifier"] | false);
      applyRelay(EXHAUST_PIN,    doc["exhaustFan"] | false);
      applyRelay(BUZZER_PIN,     doc["buzzer"]     | false);
    }
  } else {
    Serial.printf("[POLL] Device poll failed, HTTP %d\n", code);
  }
  http.end();
}

void applyRelay(int pin, bool state) {
  digitalWrite(pin, state ? HIGH : LOW);
}
