require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const { initDB } = require('./db');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ── WebSocket broadcast ───────────────────────────────────────────────────────
app.locals.broadcast = (payload) => {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
};

wss.on('connection', (ws) => {
  console.log(`[WS] Client connected  (total: ${wss.clients.size})`);
  ws.on('close', () => console.log(`[WS] Client disconnected (total: ${wss.clients.size})`));
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/sensor',  require('./routes/sensor'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/alerts',  require('./routes/alerts'));
app.get('/api/health',  (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}).catch(err => {
  console.error('[Server] DB init failed:', err.message);
  process.exit(1);
});
