// Real backend integration — replaces mock-data.js when server is running
// Set USE_MOCK = true to fall back to simulated data (no server needed)

const USE_MOCK = false;
const API_BASE = 'http://localhost:3000/api';
const WS_URL   = 'ws://localhost:3000';

const RealIoT = (() => {
  let ws = null;
  let listeners = [];
  let reconnectTimer = null;

  function subscribe(fn) { listeners.push(fn); }

  function notify(data) { listeners.forEach(fn => fn(data)); }

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected to server');
      updateConnStatus(true);
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      // Fetch latest reading immediately on connect
      fetchLatest();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'sensor') {
          notify({
            timestamp:   msg.data.timestamp,
            temperature: msg.data.temperature,
            humidity:    msg.data.humidity,
            airQuality:  msg.data.airQuality,
            devices:     {}  // fetched separately
          });
          // Handle server-side alerts
          if (msg.alerts && msg.alerts.length) {
            msg.alerts.forEach(a => showToast(a.msg, a.type));
          }
        }
        if (msg.type === 'device') {
          updateDeviceUI(msg.name, msg.state);
        }
      } catch (e) { console.error('[WS] Parse error', e); }
    };

    ws.onclose = () => {
      console.warn('[WS] Disconnected — retrying in 5s');
      updateConnStatus(false);
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = (err) => { console.error('[WS] Error', err); ws.close(); };
  }

  async function fetchLatest() {
    try {
      const res = await fetch(`${API_BASE}/sensor/latest`);
      const data = await res.json();
      if (data.temperature != null) {
        notify({ timestamp: data.timestamp, temperature: data.temperature, humidity: data.humidity, airQuality: data.airQuality, devices: {} });
      }
    } catch (e) { console.error('[API] fetchLatest failed', e); }
  }

  async function fetchDevices() {
    try {
      const res = await fetch(`${API_BASE}/devices`);
      return await res.json();
    } catch (e) { console.error('[API] fetchDevices failed', e); return {}; }
  }

  async function toggleDevice(name, state) {
    try {
      const res = await fetch(`${API_BASE}/devices/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state })
      });
      return await res.json();
    } catch (e) { console.error('[API] toggleDevice failed', e); }
  }

  async function fetchHistory(hours = 24) {
    try {
      const res = await fetch(`${API_BASE}/sensor/history?hours=${hours}`);
      const rows = await res.json();
      return rows.map(d => ({
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(d.timestamp).toLocaleDateString(),
        temperature: d.temperature,
        humidity:    d.humidity,
        airQuality:  d.airQuality
      }));
    } catch (e) { console.error('[API] fetchHistory failed', e); return []; }
  }

  async function fetchAlerts(limit = 50) {
    try {
      const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
      return await res.json();
    } catch (e) { console.error('[API] fetchAlerts failed', e); return []; }
  }

  async function acknowledgeAlert(id) {
    try {
      await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: 'PATCH' });
    } catch (e) { console.error('[API] acknowledgeAlert failed', e); }
  }

  async function clearAlerts() {
    try {
      await fetch(`${API_BASE}/alerts`, { method: 'DELETE' });
    } catch (e) { console.error('[API] clearAlerts failed', e); }
  }

  function start() { connect(); }

  return { subscribe, start, fetchLatest, fetchDevices, toggleDevice, fetchHistory, fetchAlerts, acknowledgeAlert, clearAlerts };
})();

// ── Shared helpers (same API shape as MockIoT) ────────────────────────────────
function updateConnStatus(online) {
  const el = document.getElementById('conn-status');
  if (!el) return;
  el.className = 'conn-status' + (online ? '' : ' offline');
  el.innerHTML = online
    ? '<span class="status-dot"></span> Connected'
    : '<span style="width:8px;height:8px;border-radius:50%;background:var(--danger);display:inline-block;"></span> Disconnected';
}

// Device UI helper called by WebSocket device broadcast
function updateDeviceUI(name, state) {
  const toggle = document.getElementById('toggle-' + name);
  const status = document.getElementById('status-' + name);
  const card   = document.getElementById('card-' + name);
  if (toggle) toggle.checked = state;
  if (status) { status.textContent = state ? 'ON' : 'OFF'; status.style.color = state ? 'var(--success)' : 'var(--text-muted)'; }
  if (card)   card.classList.toggle('active', state);
}

// Use RealIoT when USE_MOCK is false, otherwise fall back to MockIoT
const IoT = USE_MOCK ? MockIoT : RealIoT;
