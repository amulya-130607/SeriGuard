// Analytics: historical charts, summary stats, export

let historicalData = [];

document.addEventListener('DOMContentLoaded', async () => {
  const session = Auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return; }
  document.getElementById('sidebar-user').textContent = session.name;
  document.getElementById('sidebar-role').textContent = session.role.charAt(0).toUpperCase() + session.role.slice(1);

  const now = new Date();
  const yesterday = new Date(now - 24 * 3600 * 1000);
  document.getElementById('date-to').value = now.toISOString().split('T')[0];
  document.getElementById('date-from').value = yesterday.toISOString().split('T')[0];

  if (!USE_MOCK) {
    historicalData = await RealIoT.fetchHistory(24);
    if (!historicalData.length) {
      historicalData = MockIoT.getHistoricalData(24); // fallback if DB empty
    }
  } else {
    historicalData = MockIoT.getHistoricalData(24);
  }
  renderAll();

  // Add responsive chart grid stacking
  const s = document.createElement('style');
  s.textContent = `@media(max-width:900px){#charts-grid{grid-template-columns:1fr!important;}}`;
  document.head.appendChild(s);
});

function renderAll() {
  renderSummary();
  renderCharts();
  renderTable();
}

function renderSummary() {
  const temps = historicalData.map(d => d.temperature);
  const hums = historicalData.map(d => d.humidity);
  const aqs = historicalData.map(d => d.airQuality);
  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);

  document.getElementById('avg-temp').textContent = avg(temps);
  document.getElementById('minmax-temp').textContent = `Min ${Math.min(...temps).toFixed(1)}°C · Max ${Math.max(...temps).toFixed(1)}°C`;
  document.getElementById('avg-hum').textContent = avg(hums);
  document.getElementById('minmax-hum').textContent = `Min ${Math.min(...hums).toFixed(1)}% · Max ${Math.max(...hums).toFixed(1)}%`;
  document.getElementById('avg-aq').textContent = Math.round(avg(aqs));
  document.getElementById('minmax-aq').textContent = `Min ${Math.min(...aqs)} · Max ${Math.max(...aqs)} ppm`;

  const totalAlerts = AlertStore.getAll().length;
  document.getElementById('total-alerts').textContent = totalAlerts;
  const tempAlerts = AlertStore.getAll().filter(a => a.param === 'temperature').length;
  const humAlerts = AlertStore.getAll().filter(a => a.param === 'humidity').length;
  const aqAlerts = AlertStore.getAll().filter(a => a.param === 'airQuality').length;
  document.getElementById('alert-breakdown').textContent = `Temp: ${tempAlerts} · Humidity: ${humAlerts} · AQ: ${aqAlerts}`;
}

let charts = {};
function renderCharts() {
  // Destroy existing charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const labels = historicalData.map(d => d.time);

  charts.temp = makeLineChart('tempChart', labels, historicalData.map(d => d.temperature), 'Temperature (°C)', '#e63946',
    [{ value: 24, borderColor: 'rgba(82,183,136,0.5)', borderDash: [5,5], label: 'Min Safe' },
     { value: 28, borderColor: 'rgba(230,57,70,0.5)', borderDash: [5,5], label: 'Max Safe' }]);

  charts.hum = makeLineChart('humChart', labels, historicalData.map(d => d.humidity), 'Humidity (%)', '#457b9d',
    [{ value: 70, borderColor: 'rgba(69,123,157,0.5)', borderDash: [5,5], label: 'Min Safe' },
     { value: 85, borderColor: 'rgba(230,57,70,0.5)', borderDash: [5,5], label: 'Max Safe' }]);

  charts.aq = makeLineChart('aqChart', labels, historicalData.map(d => d.airQuality), 'Air Quality (ppm)', '#2d6a4f');

  // Device usage bar chart (simulated)
  charts.device = makeBarChart('deviceChart',
    ['Fan', 'Humidifier', 'Exhaust Fan', 'Buzzer'],
    [Math.floor(Math.random() * 8 + 2), Math.floor(Math.random() * 6 + 1),
     Math.floor(Math.random() * 5 + 1), Math.floor(Math.random() * 3)],
    'Hours Active (24h)',
    ['rgba(45,106,79,0.8)', 'rgba(69,123,157,0.8)', 'rgba(82,183,136,0.8)', 'rgba(244,162,97,0.8)']
  );
}

function makeLineChart(id, labels, data, label, color, annotations = []) {
  const ctx = document.getElementById(id).getContext('2d');
  const datasets = [{
    label, data, borderColor: color,
    backgroundColor: color + '14',
    fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2
  }];
  // Add threshold lines as extra datasets
  annotations.forEach(ann => {
    datasets.push({
      label: ann.label,
      data: Array(labels.length).fill(ann.value),
      borderColor: ann.borderColor, borderDash: ann.borderDash,
      borderWidth: 1.5, pointRadius: 0, fill: false
    });
  });
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: annotations.length > 0, labels: { font: { size: 11 }, boxWidth: 20 } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

function makeBarChart(id, labels, data, label, colors) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } }, beginAtZero: true }
      }
    }
  });
}

function renderTable() {
  const tbody = document.getElementById('data-table');
  document.getElementById('row-count').textContent = `Showing ${historicalData.length} rows`;
  tbody.innerHTML = historicalData.slice().reverse().map(d => {
    const tStat = MockIoT.getTempStatus(d.temperature);
    const safe = tStat.label === 'Safe' && MockIoT.getHumidityStatus(d.humidity).label === 'Safe';
    return `<tr style="border-top:1px solid var(--border);">
      <td style="padding:10px 16px;color:var(--text-muted);">${d.date} ${d.time}</td>
      <td style="padding:10px 16px;font-weight:600;color:${d.temperature > 28 || d.temperature < 24 ? 'var(--danger)' : 'var(--success)'};">${d.temperature}</td>
      <td style="padding:10px 16px;font-weight:600;color:${d.humidity > 85 || d.humidity < 70 ? 'var(--warning)' : 'var(--success)'};">${d.humidity}</td>
      <td style="padding:10px 16px;font-weight:600;color:${d.airQuality > 250 ? 'var(--danger)' : d.airQuality > 150 ? 'var(--warning)' : 'var(--success)'};">${d.airQuality}</td>
      <td style="padding:10px 16px;"><span class="sensor-badge ${safe ? 'badge-safe' : 'badge-warning'}">${safe ? 'Normal' : 'Alert'}</span></td>
    </tr>`;
  }).join('');
}

async function applyDateFilter() {
  if (!USE_MOCK) {
    historicalData = await RealIoT.fetchHistory(24);
    if (!historicalData.length) historicalData = MockIoT.getHistoricalData(24);
  } else {
    historicalData = MockIoT.getHistoricalData(24);
  }
  renderAll();
  showToast('Date filter applied', 'success', 2000);
}

function exportCSV() {
  const header = 'Time,Date,Temperature(C),Humidity(%),AirQuality(ppm)\n';
  const rows = historicalData.map(d => `${d.time},${d.date},${d.temperature},${d.humidity},${d.airQuality}`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `silksense-data-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded', 'success', 2000);
}

function exportPDF() {
  window.print();
}
