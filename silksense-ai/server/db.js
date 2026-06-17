// File-based storage using JSON — persisted on Render's disk
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const FILES = {
  sensors: path.join(DATA_DIR, 'sensors.json'),
  devices: path.join(DATA_DIR, 'devices.json'),
  alerts:  path.join(DATA_DIR, 'alerts.json'),
};

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

// ── Sensors ───────────────────────────────────────────────────────────────────
const Sensors = {
  insert(row) {
    const rows = read(FILES.sensors);
    const entry = { _id: Date.now().toString(), ...row, timestamp: new Date().toISOString() };
    rows.push(entry);
    if (rows.length > 10000) rows.splice(0, rows.length - 10000);
    write(FILES.sensors, rows);
    return entry;
  },
  latest() {
    const rows = read(FILES.sensors);
    return rows.length ? rows[rows.length - 1] : null;
  },
  history(hours = 24) {
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    return read(FILES.sensors).filter(r => r.timestamp >= since);
  }
};

// ── Devices ───────────────────────────────────────────────────────────────────
const DEFAULT_DEVICES = { fan: false, humidifier: false, exhaustFan: false, buzzer: false };

const Devices = {
  getAll() {
    try { return { ...DEFAULT_DEVICES, ...JSON.parse(fs.readFileSync(FILES.devices, 'utf8')) }; }
    catch { return { ...DEFAULT_DEVICES }; }
  },
  set(name, state) {
    const devices = this.getAll();
    devices[name] = state;
    fs.writeFileSync(FILES.devices, JSON.stringify(devices));
    return devices;
  }
};

// ── Alerts ────────────────────────────────────────────────────────────────────
const Alerts = {
  getAll(limit = 50) {
    return read(FILES.alerts).slice(-limit).reverse();
  },
  insert(rows) {
    const all = read(FILES.alerts);
    rows.forEach(r => all.push({
      _id: Date.now().toString() + Math.random().toString(36).slice(2),
      ...r,
      timestamp: new Date().toISOString(),
      acknowledged: false
    }));
    if (all.length > 500) all.splice(0, all.length - 500);
    write(FILES.alerts, all);
  },
  acknowledge(id) {
    const all = read(FILES.alerts);
    const a = all.find(x => x._id === id);
    if (a) { a.acknowledged = true; write(FILES.alerts, all); }
  },
  clear() { write(FILES.alerts, []); }
};

module.exports = { Sensors, Devices, Alerts };
