// Auth & shared utilities

const Auth = (() => {
  const USERS_KEY = 'silksense_users';
  const SESSION_KEY = 'silksense_session';

  function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
  function getSession() { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }

  function register({ name, email, password, role = 'farmer' }) {
    const users = getUsers();
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    users.push({ id: Date.now(), name, email, password, role });
    saveUsers(users);
    return { ok: true };
  }

  function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }));
    return { ok: true, user };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'auth.html';
  }

  function requireAuth() {
    if (!getSession()) { window.location.href = 'auth.html'; return null; }
    return getSession();
  }

  return { register, login, logout, getSession, requireAuth };
})();

// Shared: alert history stored in localStorage
const AlertStore = (() => {
  const KEY = 'silksense_alerts';
  function getAll() { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  function add(alert) {
    const alerts = getAll();
    alerts.unshift({ id: Date.now(), ...alert, time: new Date().toISOString(), acknowledged: false });
    if (alerts.length > 100) alerts.pop();
    localStorage.setItem(KEY, JSON.stringify(alerts));
  }
  function acknowledge(id) {
    const alerts = getAll();
    const a = alerts.find(x => x.id === id);
    if (a) { a.acknowledged = true; localStorage.setItem(KEY, JSON.stringify(alerts)); }
  }
  return { getAll, add, acknowledge };
})();

// Toast notifications
function showToast(msg, type = 'warning', duration = 5000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { danger: '🚨', warning: '⚠️', success: '✅', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || '🔔'}</span><span class="t-msg">${msg}</span><span class="t-close" onclick="this.parentElement.remove()">✕</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Check thresholds and generate alerts
function checkThresholds(data) {
  const alerts = [];
  if (data.temperature > 28)
    alerts.push({ type: 'danger', msg: `🌡️ Temperature too high: ${data.temperature}°C (Safe: 24–28°C)`, param: 'temperature' });
  else if (data.temperature < 24)
    alerts.push({ type: 'warning', msg: `🌡️ Temperature too low: ${data.temperature}°C (Safe: 24–28°C)`, param: 'temperature' });
  if (data.humidity > 85)
    alerts.push({ type: 'warning', msg: `💧 Humidity too high: ${data.humidity}% (Safe: 70–85%)`, param: 'humidity' });
  else if (data.humidity < 70)
    alerts.push({ type: 'danger', msg: `💧 Humidity too low: ${data.humidity}% (Safe: 70–85%)`, param: 'humidity' });
  if (data.airQuality > 250)
    alerts.push({ type: 'danger', msg: `🌫️ Poor air quality detected: ${data.airQuality} ppm`, param: 'airQuality' });
  alerts.forEach(a => { AlertStore.add(a); showToast(a.msg, a.type); });
  return alerts;
}

// Navbar user info
function initNavbarUser() {
  const session = Auth.getSession();
  const el = document.getElementById('nav-user');
  if (!el) return;
  if (session) {
    el.innerHTML = `<span style="font-size:0.875rem;color:var(--text-muted)">Hi, ${session.name}</span>
      <button class="nav-btn outline btn-sm" onclick="Auth.logout()">Logout</button>`;
  } else {
    el.innerHTML = `<a href="auth.html"><button class="nav-btn">Login</button></a>`;
  }
}
