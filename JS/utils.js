/* =============================================
   utils.js
   Shared utilities — security hardened
   ============================================= */

// ---- XSS Prevention ----
// RULE: Never inject user data into innerHTML directly.
// Always escape through this function first.

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  // ---- Input Validation ----
  
  const VALIDATION = {
    MAX_NAME_LENGTH:   100,
    MAX_EMAIL_LENGTH:  150,
    MAX_TITLE_LENGTH:  200,
    MAX_DESC_LENGTH:   1000,
    MAX_LABEL_LENGTH:  300,
    MAX_ANSWER_LENGTH: 2000,
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
  };
  
  function isValidEmail(email) {
    // RFC-compliant basic check — real validation happens server-side
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= VALIDATION.MAX_EMAIL_LENGTH;
  }
  
  function isValidName(name) {
    return typeof name === 'string' &&
      name.trim().length > 0 &&
      name.length <= VALIDATION.MAX_NAME_LENGTH &&
      /^[\p{L}\p{M}\s'\-]+$/u.test(name.trim());
  }
  
  function sanitizeText(val, maxLength) {
    if (typeof val !== 'string') return '';
    return val.trim().slice(0, maxLength);
  }
  
  // ---- Auth ----
  // Security: never store password in session object.
  // Strip it before saving to localStorage.
  
  function stripPassword(user) {
    const safe = { ...user };
    delete safe.password;
    return safe;
  }
  
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('sd_current_user');
      if (!raw) return null;
      const user = JSON.parse(raw);
      // Paranoia check: ensure no password field leaked into session
      if (user && user.password) delete user.password;
      return user;
    } catch {
      return null;
    }
  }
  
  function requireAdmin() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      window.location.replace('login.html');
      return null;
    }
    return user;
  }
  
  function requireWorker() {
    const user = getCurrentUser();
    if (!user || user.role !== 'worker') {
      window.location.replace('login.html');
      return null;
    }
    return user;
  }
  
  function requireAuth() {
    const user = getCurrentUser();
    if (!user) {
      window.location.replace('login.html');
      return null;
    }
    return user;
  }
  
  function logout() {
    localStorage.removeItem('sd_current_user');
    // Clear all app state on logout
    sessionStorage.clear();
    window.location.replace('login.html');
  }
  
  // ---- Rate Limiting (login brute-force protection) ----
  // Tracks failed attempts in sessionStorage (cleared on tab close)
  
  const RATE_LIMIT = { MAX_ATTEMPTS: 5, WINDOW_MS: 15 * 60 * 1000 };
  
  function recordFailedLogin() {
    const key  = 'sd_login_attempts';
    const now  = Date.now();
    let data   = JSON.parse(sessionStorage.getItem(key) || '{"attempts":[],"locked":false}');
  
    // Remove attempts outside the window
    data.attempts = data.attempts.filter(t => now - t < RATE_LIMIT.WINDOW_MS);
    data.attempts.push(now);
  
    if (data.attempts.length >= RATE_LIMIT.MAX_ATTEMPTS) {
      data.locked    = true;
      data.lockedAt  = now;
    }
  
    sessionStorage.setItem(key, JSON.stringify(data));
    return data;
  }
  
  function isLoginLocked() {
    const key  = 'sd_login_attempts';
    const now  = Date.now();
    const data = JSON.parse(sessionStorage.getItem(key) || '{"attempts":[],"locked":false}');
  
    if (!data.locked) return false;
  
    // Auto-unlock after window expires
    if (now - data.lockedAt >= RATE_LIMIT.WINDOW_MS) {
      sessionStorage.removeItem(key);
      return false;
    }
  
    return true;
  }
  
  function clearLoginAttempts() {
    sessionStorage.removeItem('sd_login_attempts');
  }
  
  // ---- Data helpers ----
  // NOTE: Once we connect to PHP/MySQL backend,
  // these will be replaced by fetch() API calls.
  // localStorage is only used for the frontend prototype.
  
  function getUsers() {
    try { return JSON.parse(localStorage.getItem('sd_users') || '[]'); }
    catch { return []; }
  }
  
  function getTasks() {
    try { return JSON.parse(localStorage.getItem('sd_tasks') || '[]'); }
    catch { return []; }
  }
  
  function getFeedback() {
    try { return JSON.parse(localStorage.getItem('sd_feedback') || '[]'); }
    catch { return []; }
  }
  
  function getWorkers() {
    return getUsers().filter(u => u.role === 'worker');
  }
  
  function saveUsers(data)    { localStorage.setItem('sd_users',    JSON.stringify(data)); }
  function saveTasks(data)    { localStorage.setItem('sd_tasks',    JSON.stringify(data)); }
  function saveFeedback(data) { localStorage.setItem('sd_feedback', JSON.stringify(data)); }
  
  // ---- UI helpers ----
  
  // Security: showAlert uses textContent, never innerHTML, for the message.
  // The type parameter is whitelisted to prevent CSS injection.
  function showAlert(containerId, message, type = 'danger') {
    const allowed = ['danger', 'success', 'warning', 'info'];
    const safeType = allowed.includes(type) ? type : 'danger';
    const el = document.getElementById(containerId);
    if (!el) return;
  
    const div = document.createElement('div');
    div.className = `alert alert-${safeType}`;
    div.textContent = message; // textContent — never innerHTML
    el.innerHTML = '';
    el.appendChild(div);
  }
  
  function clearAlert(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }
  
  function setNavbar(user) {
    const avatar = document.getElementById('nav-avatar');
    if (avatar && user && user.name) {
      avatar.textContent = user.name.charAt(0).toUpperCase();
    }
  }
  
  function greet(user) {
    const hour = new Date().getHours();
    const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    // escapeHTML protects against XSS if name somehow contains HTML
    return `${time}, ${escapeHTML(user.name.split(' ')[0])}`;
  }
  
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }
  
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  }
  
  function formatDateTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }
  
  // Security: use crypto.randomUUID() instead of timestamp-based IDs.
  // Timestamps are predictable and can allow IDOR attacks.
  function generateId(prefix) {
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + '_' + uuid;
  }
  
  function copyToClipboard(text, btnEl, label = 'Copy') {
    // Validate text is a string before copying
    if (typeof text !== 'string') return;
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        btnEl.textContent = 'Copied';
        setTimeout(() => { btnEl.textContent = label; }, 2000);
      }
    }).catch(() => {
      // Fail silently — clipboard API requires HTTPS in production
    });
  }
  
  // ---- Seed demo data ----
  // Security: passwords are NOT stored in plain text.
  // We store a flag here; real hashing is done server-side in PHP.
  // These demo credentials are only for localStorage prototype mode.
  
  function seedDemoData() {
    if (!localStorage.getItem('sd_users')) {
      // In the real PHP version, passwords are bcrypt hashed server-side.
      // For the localStorage prototype, we store a marker — never plain text
      // in production. This entire block is replaced by PHP auth.
      const demo = [
        { name: 'Ahmed Al-Rashid', email: 'manager@company.com', password: '__demo_admin__',  role: 'admin'  },
        { name: 'Sara Mohammed',   email: 'sara@company.com',    password: '__demo_worker__', role: 'worker' },
        { name: 'Khalid Nasser',   email: 'khalid@company.com',  password: '__demo_worker__', role: 'worker' }
      ];
      saveUsers(demo);
    }
  }
  
  seedDemoData();