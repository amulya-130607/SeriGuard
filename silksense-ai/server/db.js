// PostgreSQL via 'pg' — works with Neon, Supabase, or any Postgres
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Neon/Supabase
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id          SERIAL PRIMARY KEY,
      temperature REAL    NOT NULL,
      humidity    REAL    NOT NULL,
      air_quality INTEGER NOT NULL,
      timestamp   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS devices (
      name       TEXT PRIMARY KEY,
      state      BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id           SERIAL PRIMARY KEY,
      type         TEXT NOT NULL,
      msg          TEXT NOT NULL,
      param        TEXT,
      acknowledged BOOLEAN DEFAULT FALSE,
      timestamp    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Seed default devices
  await pool.query(`
    INSERT INTO devices (name, state) VALUES
      ('fan', false), ('humidifier', false), ('exhaustFan', false), ('buzzer', false)
    ON CONFLICT (name) DO NOTHING;
  `);
  console.log('[DB] Ready');
}

// ── Sensors ───────────────────────────────────────────────────────────────────
const Sensors = {
  async insert({ temperature, humidity, airQuality }) {
    const { rows } = await pool.query(
      `INSERT INTO sensor_readings (temperature, humidity, air_quality)
       VALUES ($1, $2, $3) RETURNING *`,
      [temperature, humidity, airQuality]
    );
    return toSensor(rows[0]);
  },
  async latest() {
    const { rows } = await pool.query(
      `SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 1`
    );
    return rows.length ? toSensor(rows[0]) : null;
  },
  async history(hours = 24) {
    const { rows } = await pool.query(
      `SELECT * FROM sensor_readings
       WHERE timestamp >= NOW() - ($1 || ' hours')::INTERVAL
       ORDER BY timestamp ASC`,
      [hours]
    );
    return rows.map(toSensor);
  }
};

function toSensor(r) {
  return { _id: r.id, temperature: r.temperature, humidity: r.humidity, airQuality: r.air_quality, timestamp: r.timestamp };
}

// ── Devices ───────────────────────────────────────────────────────────────────
const Devices = {
  async getAll() {
    const { rows } = await pool.query(`SELECT name, state FROM devices`);
    const map = {};
    rows.forEach(r => { map[r.name] = r.state; });
    return map;
  },
  async set(name, state) {
    await pool.query(
      `INSERT INTO devices (name, state, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (name) DO UPDATE SET state = $2, updated_at = NOW()`,
      [name, state]
    );
    return this.getAll();
  }
};

// ── Alerts ────────────────────────────────────────────────────────────────────
const Alerts = {
  async getAll(limit = 50) {
    const { rows } = await pool.query(
      `SELECT * FROM alerts ORDER BY timestamp DESC LIMIT $1`, [limit]
    );
    return rows.map(r => ({ ...r, _id: r.id }));
  },
  async insert(alerts) {
    for (const a of alerts) {
      await pool.query(
        `INSERT INTO alerts (type, msg, param) VALUES ($1, $2, $3)`,
        [a.type, a.msg, a.param || null]
      );
    }
  },
  async acknowledge(id) {
    await pool.query(`UPDATE alerts SET acknowledged = true WHERE id = $1`, [id]);
  },
  async clear() {
    await pool.query(`DELETE FROM alerts`);
  }
};

module.exports = { initDB, Sensors, Devices, Alerts };
