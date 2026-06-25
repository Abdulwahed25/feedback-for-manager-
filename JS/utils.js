/* =============================================
   utils.js
   Shared utilities — connected to PHP backend
   ============================================= */

// ---- XSS Prevention ----

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
    MAX_NAME_LENGTH:    100,
    MAX_EMAIL_LENGTH:   150,
    MAX_TITLE_LENGTH:   200,
    MAX_DESC_LENGTH:    1000,
    MAX_LABEL_LENGTH:   300,
    MAX_ANSWER_LENGTH:  2000,
    MIN_PASSWORD_LENGTH: 8,
    MAX_PASSWORD_LENGTH: 128,
  };
  
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      email.length <= VALIDATION.MAX_EMAIL_LENGTH;
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
  
  // ---- API Base Path ----
  // All fetch() calls go through this base path.
  // Adjust if your XAMPP folder name is different.
  
  const API_BASE = '/sales-department/backend';
  
  // ---- CSRF Token ----
  // Fetched once on page load and reused for all POST requests.
  
  let _csrfToken = '';
  
  async function fetchCsrfToken() {
    try {
      const res  = await fetch(`${API_BASE}/auth/csrf.php`);
      const data = await res.json();
      if (data.success) _csrfToken = data.data.token;
    } catch (e) {
      console.error('Could not fetch CSRF token:', e);
    }
  }
  
  function getCsrfToken() {
    return _csrfToken;
  }
  
  // ---- Fetch Helpers ----
  
  async function apiGet(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method:      'GET',
      credentials: 'same-origin', // send session cookie
    });
    return res.json();
  }
  
  async function apiPost(endpoint, data = {}) {
    const body = new FormData();
  
    // Attach CSRF token to every POST
    body.append('csrf_token', getCsrfToken());
  
    Object.entries(data).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        body.append(key, JSON.stringify(val));
      } else {
        body.append(key, val);
      }
    });
  
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method:      'POST',
      credentials: 'same-origin',
      body,
    });
  
    return res.json();
  }
  
  // ---- Session (from PHP session, not localStorage) ----
  // Current user is stored in a JS variable populated
  // from the server on page load via /auth/session.php
  
  let _currentUser = null;
  
  async function loadSession() {
    try {
      const res = await apiGet('/auth/session.php');
      if (res.success) {
        _currentUser = res.data.user;
      } else {
        _currentUser = null;
      }
    } catch (e) {
      _currentUser = null;
    }
  }
  
  function getCurrentUser() {
    return _currentUser;
  }
  
  async function requireAdmin() {
    await loadSession();
    if (!_currentUser || _currentUser.role !== 'admin') {
      window.location.replace('login.html');
      return null;
    }
    return _currentUser;
  }
  
  async function requireWorker() {
    await loadSession();
    if (!_currentUser || _currentUser.role !== 'worker') {
      window.location.replace('login.html');
      return null;
    }
    return _currentUser;
  }
  
  async function logout() {
    await apiPost('/auth/logout.php');
    window.location.replace('login.html');
  }
  
  // ---- UI helpers ----
  
  function showAlert(containerId, message, type = 'danger') {
    const allowed = ['danger', 'success', 'warning', 'info'];
    const safeType = allowed.includes(type) ? type : 'danger';
    const el = document.getElementById(containerId);
    if (!el) return;
    const div = document.createElement('div');
    div.className = `alert alert-${safeType}`;
    div.textContent = message;
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
  
  function generateId(prefix) {
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + '_' + uuid;
  }
  
  function copyToClipboard(text, btnEl, label = 'Copy') {
    if (typeof text !== 'string') return;
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        btnEl.textContent = 'Copied';
        setTimeout(() => { btnEl.textContent = label; }, 2000);
      }
    }).catch(() => {});
  }
  
  function buildFeedbackLink(taskId) {
    return window.location.origin + '/sales-department/pages/worker-feedback.html?task=' + encodeURIComponent(taskId);
  }
  
  // ---- Init: fetch CSRF token on every page load ----
  document.addEventListener('DOMContentLoaded', fetchCsrfToken);