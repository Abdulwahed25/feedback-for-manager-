/* =============================================
   auth.js
   Login and signup logic
   ============================================= */

// ---- LOGIN ----

function handleLogin() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
  
    if (!email || !password) {
      showAlert('alert-box', 'Please fill in all fields.');
      return;
    }
  
    const users = getUsers();
    const user  = users.find(u => u.email === email && u.password === password);
  
    if (!user) {
      showAlert('alert-box', 'Email or password is incorrect.');
      return;
    }
  
    localStorage.setItem('sd_current_user', JSON.stringify(user));
  
    if (user.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'worker-dashboard.html';
    }
  }
  
  function togglePassword() {
    const pw = document.getElementById('password');
    const btn = document.getElementById('toggle-pw-btn');
    if (pw.type === 'password') {
      pw.type = 'text';
      btn.textContent = 'Hide';
    } else {
      pw.type = 'password';
      btn.textContent = 'Show';
    }
  }
  
  // Allow Enter key on login page
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('email')) handleLogin();
  });
  
  
  // ---- SIGNUP ----
  // Only initialize signup logic when the role selector exists on the page
  
  let selectedRole = 'admin';
  
  function initSignup() {
    if (!document.getElementById('role-admin')) return;
    selectRole('admin');
  }
  
  function selectRole(role) {
    selectedRole = role;
    const adminCard  = document.getElementById('role-admin');
    const workerCard = document.getElementById('role-worker');
    if (!adminCard || !workerCard) return;
    adminCard.classList.toggle('selected',  role === 'admin');
    workerCard.classList.toggle('selected', role === 'worker');
  }
  
  function checkPasswordStrength(val) {
    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!fill || !label) return;
  
    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
  
    const levels = [
      { pct: '0%',   color: '',               text: 'Enter a password' },
      { pct: '25%',  color: 'var(--danger)',   text: 'Weak' },
      { pct: '50%',  color: 'var(--warning)',  text: 'Fair' },
      { pct: '75%',  color: '#0EA5E9',        text: 'Good' },
      { pct: '100%', color: 'var(--success)', text: 'Strong' },
    ];
  
    fill.style.width      = levels[score].pct;
    fill.style.background = levels[score].color;
    label.textContent     = levels[score].text;
  }
  
  function handleSignup() {
    const fname    = document.getElementById('fname').value.trim();
    const lname    = document.getElementById('lname').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm').value;
  
    if (!fname || !lname || !email || !password || !confirm) {
      showAlert('alert-box', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      showAlert('alert-box', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      showAlert('alert-box', 'Passwords do not match.');
      return;
    }
  
    const users = getUsers();
    if (users.find(u => u.email === email)) {
      showAlert('alert-box', 'An account with this email already exists.');
      return;
    }
  
    const newUser = {
      name:      `${fname} ${lname}`,
      email,
      password,
      role:      selectedRole,
      createdAt: new Date().toISOString()
    };
  
    users.push(newUser);
    saveUsers(users);
    localStorage.setItem('sd_current_user', JSON.stringify(newUser));
  
    showAlert('alert-box', 'Account created. Redirecting...', 'success');
  
    setTimeout(() => {
      window.location.href = selectedRole === 'admin'
        ? 'admin-dashboard.html'
        : 'worker-dashboard.html';
    }, 1000);
  }
  
  // Run signup init when DOM is ready
  document.addEventListener('DOMContentLoaded', initSignup);