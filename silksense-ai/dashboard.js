// Dashboard logic: live updates, device control, chart, AI insights

document.addEventListener('DOMContentLoaded', async () => {
  const session = Auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  document.getElementById('sidebar-user').textContent = session.name;
  document.getElementById('sidebar-role').textContent = session.role.charAt(0).toUpperCase() + session.role.slice(1);

  initLiveChart();

  if (!USE_MOCK) {
    // Real backend: load device states + alert history from server
    const states = await RealIoT.fetchDevices();
    Object.entries(states).forEach(([name, state]) => updateDeviceUI(name, state));
    const serverAlerts = await RealIoT.fetchAlerts();
    renderAlertList(serverAlerts);
  } else {
    renderAlertList(AlertStore.getAll());
    // Initial mock read
    onNewData(MockIoT.generateReading());
  }

  IoT.subscribe(onNewData);
  IoT.start();
});

// ── LIVE CHART ────────────────────────────────────────────────────────────────
let liveChart, chartMode = 'temp';
const MAX_POINTS = 20;
const chartHistory = { temp: [], hum: [], aq: [], labels: [] };

function initLiveChart() {
  const ctx = document.getElementById('liveChart').getContext('2d');
  liveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Temperature (°C)',
        data: [],
        borderColor: '#e63946',
        backgroundColor: 'rgba(230,57,70,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 11 } } }
      },
      animation: { duration: 400 }
    }
  });
}

function setChartMode(mode) {
  chartMode = mode;
  const colors = { temp: '#e63946', hum: '#457b9d', aq: '#2d6a4f' };
  const labelMap = { temp: 'Temperature (°C)', hum: 'Humidity (%)', aq: 'Air Quality (ppm)' };
  ['temp', 'hum', 'aq'].forEach(m => {
    const btn = document.getElementById('btn-' + m);
    btn.style.background = m === mode ? 'var(--primary)' : 'var(--border)';
    btn.style.color      = m === mode ? '#fff' : 'var(--text)';
    btn.style.border     = 'none';
  });
  liveChart.data.datasets[0].borderColor = colors[mode];
  liveChart.data.datasets[0].backgroundColor = colors[mode] + '14';
  liveChart.data.datasets[0].label = labelMap[mode];
  refreshChartData();
}

function refreshChartData() {
  liveChart.data.labels = [...chartHistory.labels];
  liveChart.data.datasets[0].data = [...chartHistory[chartMode]];
  liveChart.update('none');
}

function pushChartPoint(data) {
  const t = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  chartHistory.labels.push(t);
  chartHistory.temp.push(data.temperature);
  chartHistory.hum.push(data.humidity);
  chartHistory.aq.push(data.airQuality);
  if (chartHistory.labels.length > MAX_POINTS) {
    chartHistory.labels.shift();
    chartHistory.temp.shift(); chartHistory.hum.shift(); chartHistory.aq.shift();
  }
  refreshChartData();
}

// ── SENSOR CARD UPDATER ───────────────────────────────────────────────────────
function onNewData(data) {
  const now = new Date().toLocaleTimeString();
  document.getElementById('last-update').textContent = now;

  // Temperature
  const tStat = MockIoT.getTempStatus(data.temperature);
  document.getElementById('temp-val').textContent = data.temperature;
  updateBadge('temp-badge', tStat.label, tStat.cls);
  document.getElementById('temp-time').textContent = 'Updated ' + now;
  const tPct = Math.min(100, Math.max(0, ((data.temperature - 20) / 15) * 100));
  updateBar('temp-bar', tPct, data.temperature < 24 || data.temperature > 28 ? 'bar-red' : 'bar-green');

  // Humidity
  const hStat = MockIoT.getHumidityStatus(data.humidity);
  document.getElementById('hum-val').textContent = data.humidity;
  updateBadge('hum-badge', hStat.label, hStat.cls);
  document.getElementById('hum-time').textContent = 'Updated ' + now;
  const hPct = Math.min(100, data.humidity);
  updateBar('hum-bar', hPct, data.humidity < 70 || data.humidity > 85 ? 'bar-yellow' : 'bar-green');

  // Air Quality
  const aqStat = MockIoT.getAirQualityLabel(data.airQuality);
  document.getElementById('aq-val').textContent = data.airQuality;
  updateBadge('aq-badge', aqStat.label, aqStat.cls);
  document.getElementById('aq-time').textContent = 'Updated ' + now;
  const aqPct = Math.min(100, (data.airQuality / 400) * 100);
  updateBar('aq-bar', aqPct, data.airQuality > 250 ? 'bar-red' : data.airQuality > 150 ? 'bar-yellow' : 'bar-green');

  // Device summary
  const activeDevices = Object.entries(data.devices || {}).filter(([, v]) => v).map(([k]) => deviceLabel(k));
  document.getElementById('dev-val').textContent = activeDevices.length;
  document.getElementById('dev-names').textContent = activeDevices.length ? activeDevices.join(', ') : 'All devices off';
  updateBar('dev-bar', (activeDevices.length / 4) * 100, 'bar-green');

  pushChartPoint(data);

  // Alerts (mock path only — real alerts come from server via WS)
  if (USE_MOCK) {
    const triggered = checkThresholds(data);
    if (triggered.length) {
      const list = document.getElementById('alert-list');
      const alertCount = document.getElementById('alert-count');
      list.innerHTML = '';
      triggered.slice(0, 5).forEach(a => {
        const div = document.createElement('div');
        div.className = `alert-item ${a.type}`;
        div.innerHTML = `<span class="a-icon">${a.type === 'danger' ? '🚨' : '⚠️'}</span>
          <div><div class="a-msg">${a.msg}</div><div class="a-time">${new Date().toLocaleString()}</div></div>`;
        list.appendChild(div);
      });
      alertCount.textContent = triggered.length + ' alert(s)';
    }
    renderAlertList(AlertStore.getAll());
  }

  updateAIInsights(data);
}

function updateBadge(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'sensor-badge ' + cls;
}

function updateBar(id, pct, colorCls) {
  const el = document.getElementById(id);
  el.style.width = pct + '%';
  el.className = 'bar-fill ' + colorCls;
}

// ── DEVICE CONTROL ────────────────────────────────────────────────────────────
const deviceLabels = { fan: 'Fan', humidifier: 'Humidifier', exhaustFan: 'Exhaust Fan', buzzer: 'Buzzer' };
function deviceLabel(key) { return deviceLabels[key] || key; }

async function toggleDevice(name, state) {
  if (!USE_MOCK) {
    await RealIoT.toggleDevice(name, state);
  } else {
    MockIoT.toggleDevice(name);
  }
  updateDeviceUI(name, state);
  showToast(`${deviceLabel(name)} turned ${state ? 'ON' : 'OFF'}`, 'success', 2500);
}

// ── ALERTS ────────────────────────────────────────────────────────────────────
function renderAlertList(alerts) {
  const container = document.getElementById('alert-history-list');
  if (!alerts || !alerts.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.875rem;padding:2rem 0;">No alert history yet.</div>';
    return;
  }
  container.innerHTML = alerts.slice(0, 20).map(a => {
    const id  = a._id || a.id;
    const ts  = a.timestamp || a.time;
    return `<div class="alert-item ${a.type}" style="margin-bottom:0.5rem;">
      <span class="a-icon">${a.type === 'danger' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <div style="flex:1">
        <div class="a-msg">${a.msg}</div>
        <div class="a-time">${new Date(ts).toLocaleString()} · ${a.acknowledged ? '✅ Acknowledged' : 'Pending'}</div>
      </div>
      ${!a.acknowledged ? `<button class="btn btn-sm btn-outline" style="font-size:0.75rem;padding:4px 10px;" onclick="acknowledgeAlert('${id}')">Ack</button>` : ''}
    </div>`;
  }).join('');
}

async function acknowledgeAlert(id) {
  if (!USE_MOCK) {
    await RealIoT.acknowledgeAlert(id);
    renderAlertList(await RealIoT.fetchAlerts());
  } else {
    AlertStore.acknowledge(id);
    renderAlertList(AlertStore.getAll());
  }
}

async function clearAlerts() {
  if (!USE_MOCK) {
    await RealIoT.clearAlerts();
    renderAlertList([]);
  } else {
    localStorage.removeItem('silksense_alerts');
    renderAlertList([]);
  }
  document.getElementById('alert-list').innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.875rem;padding:2rem 0;">✅ All conditions normal</div>';
  document.getElementById('alert-count').textContent = '0 alerts';
}

// ── AI INSIGHTS ───────────────────────────────────────────────────────────────
let aiHistory = [];
function updateAIInsights(data) {
  aiHistory.push(data);
  if (aiHistory.length > 10) aiHistory.shift();
  const avgTemp = (aiHistory.reduce((s, d) => s + d.temperature, 0) / aiHistory.length).toFixed(1);
  const avgHum  = (aiHistory.reduce((s, d) => s + d.humidity, 0) / aiHistory.length).toFixed(1);
  const trend = aiHistory.length > 1
    ? aiHistory[aiHistory.length - 1].temperature > aiHistory[0].temperature ? '↑ rising' : '↓ falling'
    : 'stable';

  document.getElementById('ai-temp').textContent =
    `Avg ${avgTemp}°C — trend ${trend}. ${data.temperature > 27 ? 'Temperature likely to exceed threshold soon. Consider activating the fan.' : 'Conditions stable.'}`;
  document.getElementById('ai-hum').textContent =
    `Avg ${avgHum}% — ${data.humidity < 72 ? 'Low humidity may stress silkworms. Activate humidifier.' : data.humidity > 83 ? 'High humidity may increase disease risk. Check exhaust fan.' : 'Humidity within safe range.'}`;
  document.getElementById('ai-health').textContent =
    data.temperature >= 24 && data.temperature <= 28 && data.humidity >= 70 && data.humidity <= 85
      ? '✅ Environment optimal for silkworm development.'
      : '⚠️ Suboptimal conditions detected. Check sensor readings and adjust devices.';
  document.getElementById('ai-yield').textContent =
    data.temperature >= 24 && data.temperature <= 28
      ? '📦 Predicted yield: Normal. Maintain current conditions.'
      : '📦 Predicted yield: At risk. Restore temperature to 24–28°C range.';
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

const style = document.createElement('style');
style.textContent = `@media(max-width:900px){.chart-alerts-grid{grid-template-columns:1fr!important;}}`;
document.head.appendChild(style);
