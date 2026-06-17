const express = require('express');
const router  = express.Router();
const { Alerts } = require('../db');

router.get('/', async (req, res) => {
  try { res.json(await Alerts.getAll(parseInt(req.query.limit) || 50)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/acknowledge', async (req, res) => {
  try { await Alerts.acknowledge(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/', async (req, res) => {
  try { await Alerts.clear(); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
