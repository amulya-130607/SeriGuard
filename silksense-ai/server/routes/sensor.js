const express = require('express');
const router  = express.Router();
const { Sensors, Alerts } = require('../db');

const THRESHOLDS = { tempMax: 28, tempMin: 24, humMax: 85, humMin: 70, aqPoor: 250 };

function checkThresholds({ temperature, humidity, airQuality }) {
  const alerts = [];
  if (temperature > THRESHOLDS.tempMax)
    alerts.push({ type: 'danger',  msg: `Temperature too high: ${temperature}°C`, param: 'temperature' });
  else if (temperature < THRESHOLDS.tempMin)
    alerts.push({ type: 'warning', msg: `Temperature too low: ${temperature}°C`,  param: 'temperature' });
  if (humidity > THRESHOLDS.humMax)
    alerts.push({ type: 'warning', msg: `Humidity too high: ${humidity}%`,         param: 'humidity' });
  else if (humidity < THRESHOLDS.humMin)
    alerts.push({ type: 'danger',  msg: `Humidity too low: ${humidity}%`,          param: 'humidity' });
  if (airQuality > THRESHOLDS.aqPoor)
    alerts.push({ type: 'danger',  msg: `Poor air quality: ${airQuality} ppm`,     param: 'airQuality' });
  return alerts;
}

router.post('/', async (req, res) => {
  try {
    const { temperature, humidity, airQuality } = req.body;
    if (temperature == null || humidity == null || airQuality == null)
      return res.status(400).json({ error: 'Missing sensor fields' });
    const reading   = await Sensors.insert({ temperature, humidity, airQuality });
    const triggered = checkThresholds({ temperature, humidity, airQuality });
    if (triggered.length) await Alerts.insert(triggered);
    req.app.locals.broadcast({ type: 'sensor', data: reading, alerts: triggered });
    res.json({ ok: true, id: reading._id, alerts: triggered.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/latest', async (req, res) => {
  try { res.json(await Sensors.latest() || {}); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', async (req, res) => {
  try { res.json(await Sensors.history(parseInt(req.query.hours) || 24)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
