const express = require('express');
const router  = express.Router();
const { Devices } = require('../db');

router.get('/', async (req, res) => {
  try { res.json(await Devices.getAll()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { state } = req.body;
    if (typeof state !== 'boolean')
      return res.status(400).json({ error: '"state" must be boolean' });
    const devices = await Devices.set(name, state);
    req.app.locals.broadcast({ type: 'device', name, state });
    res.json({ ok: true, name, state, devices });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
