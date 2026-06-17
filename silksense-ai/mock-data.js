// Simulated IoT data — replace with real API/WebSocket/Firebase calls

const MockIoT = (() => {
  let listeners = [];
  let deviceStates = { fan: false, humidifier: false, exhaustFan: false, buzzer: false };
  let interval = null;

  function generateReading() {
    // Simulate realistic fluctuations
    const temp = +(23 + Math.random() * 8).toFixed(1);       // 23–31°C
    const humidity = +(65 + Math.random() * 25).toFixed(1);  // 65–90%
    const airQuality = Math.floor(80 + Math.random() * 320); // MQ-135 ppm
    return {
      timestamp: new Date().toISOString(),
      temperature: temp,
      humidity: humidity,
      airQuality: airQuality,
      devices: { ...deviceStates }
    };
  }

  function getAirQualityLabel(ppm) {
    if (ppm < 150) return { label: 'Good', cls: 'badge-safe' };
    if (ppm < 250) return { label: 'Moderate', cls: 'badge-warning' };
    return { label: 'Poor', cls: 'badge-danger' };
  }

  function getTempStatus(t) {
    if (t >= 24 && t <= 28) return { label: 'Safe', cls: 'badge-safe' };
    if (t > 28) return { label: 'High', cls: 'badge-danger' };
    return { label: 'Low', cls: 'badge-warning' };
  }

  function getHumidityStatus(h) {
    if (h >= 70 && h <= 85) return { label: 'Safe', cls: 'badge-safe' };
    if (h > 85) return { label: 'High', cls: 'badge-warning' };
    return { label: 'Low', cls: 'badge-danger' };
  }

  function subscribe(fn) { listeners.push(fn); }

  function start() {
    if (interval) return;
    interval = setInterval(() => {
      const data = generateReading();
      listeners.forEach(fn => fn(data));
    }, 3000);
  }

  function stop() { clearInterval(interval); interval = null; }

  function toggleDevice(name) {
    deviceStates[name] = !deviceStates[name];
    // In real app: POST to /api/device or MQTT publish
    console.log(`[IoT] Device ${name} → ${deviceStates[name] ? 'ON' : 'OFF'}`);
    return deviceStates[name];
  }

  function getDeviceStates() { return { ...deviceStates }; }

  // Generate historical data for charts
  function getHistoricalData(hours = 24) {
    const data = [];
    const now = Date.now();
    for (let i = hours; i >= 0; i--) {
      const t = new Date(now - i * 3600 * 1000);
      data.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: t.toLocaleDateString(),
        temperature: +(23 + Math.random() * 8).toFixed(1),
        humidity: +(65 + Math.random() * 25).toFixed(1),
        airQuality: Math.floor(80 + Math.random() * 320)
      });
    }
    return data;
  }

  return { generateReading, getAirQualityLabel, getTempStatus, getHumidityStatus, subscribe, start, stop, toggleDevice, getDeviceStates, getHistoricalData };
})();
