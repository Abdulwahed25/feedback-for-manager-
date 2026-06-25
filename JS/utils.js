/* =============================================
   utils.js
   Shared logic across all pages
   ============================================= */

// ---- Auth ----

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('sd_current_user') || 'null');
  }
  
  function requireAdmin() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      window.location.href = 'login.html';
    }
    return user;
  }
  
  function requireWorker() {
    const user = getCurrentUser();
    if (!user || user.role !== 'worker') {
      window.location.href = 'login.html';
    }
    return user;
  }
  
  function requireAuth() {
    const user = getCurrentUser();
    if (!user) window.location.href = 'login.html';
    return user;
  }
  
  function logout() {
    localStorage.removeItem('sd_current_user');
    window.location.href = 'login.html';
  }
  
  // ---- Data helpers ----
  
  function getUsers()    { return JSON.parse(localStorage.getItem('sd_users')    || '[]'); }
  function getTasks()    { return JSON.parse(localStorage.getItem('sd_tasks')    || '[]'); }
  function getFeedback() { return JSON.parse(localStorage.getItem('sd_feedback') || '[]'); }
  function getWorkers()  { return getUsers().filter(u => u.role === 'worker'); }
  
  function saveUsers(data)    { localStorage.setItem('sd_users',    JSON.stringify(data)); }
  function saveTasks(data)    { localStorage.setItem('sd_tasks',    JSON.stringify(data)); }
  function saveFeedback(data) { localStorage.setItem('sd_feedback', JSON.stringify(data)); }
  
  // ---- UI helpers ----
  
  function showAlert(containerId, message, type = 'danger') {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  }
  
  function clearAlert(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }
  
  function setNavbar(user) {
    const avatar = document.getElementById('nav-avatar');
    if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
  }
  
  function greet(user) {
    const hour = new Date().getHours();
    const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return `${time}, ${user.name.split(' ')[0]}`;
  }
  
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }
  
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  
  function formatDateTime(iso) {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  
  function generateId(prefix) {
    return prefix + '_' + Date.now();
  }
  
  function copyToClipboard(text, btnEl, label = 'Copy') {
    navigator.clipboard.writeText(text).then(() => {
      if (btnEl) {
        btnEl.textContent = 'Copied';
        setTimeout(() => { btnEl.textContent = label; }, 2000);
      }
    });
  }
  
  // ---- Seed demo data ----
  
  function seedDemoData() {
    if (!localStorage.getItem('sd_users')) {
      const demo = [
        { name: 'Ahmed Al-Rashid', email: 'manager@company.com', password: 'admin123',  role: 'admin'  },
        { name: 'Sara Mohammed',   email: 'sara@company.com',    password: 'worker123', role: 'worker' },
        { name: 'Khalid Nasser',   email: 'khalid@company.com',  password: 'worker123', role: 'worker' }
      ];
      saveUsers(demo);
    }
  }
  
  seedDemoData();