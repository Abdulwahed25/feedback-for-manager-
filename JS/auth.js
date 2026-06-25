/* =============================================
   auth.js
   Login and signup — connected to PHP backend
   ============================================= */

// ---- LOGIN ----

async function handleLogin() {
    const btn = document.getElementById('login-btn');
    if (btn) btn.disabled = true;
  
    const emailRaw    = document.getElementById('email').value.trim();
    const passwordRaw = document.getElementById('password').value;
  
    if (!emailRaw || !passwordRaw) {
      showAlert('alert-box', 'Please fill in all fields.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (!isValidEmail(emailRaw)) {
      showAlert('alert-box', 'Please enter a valid email address.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (passwordRaw.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password must be at least 8 characters.');
      if (btn) btn.disabled = false;
      return;
    }
  
    try {
      const res = await apiPost('/auth/login.php', {
        email:    emailRaw,
        password: passwordRaw,
      });
  
      if (!res.success) {
        showAlert('alert-box', res.message || 'Incorrect email or password.');
        if (btn) btn.disabled = false;
        return;
      }
  
      // Redirect based on role returned from server
      if (res.data.role === 'admin') {
        window.location.replace('admin-dashboard.html');
      } else {
        window.location.replace('worker-dashboard.html');
      }
  
    } catch (e) {
      showAlert('alert-box', 'Could not connect to the server. Please try again.');
      if (btn) btn.disabled = false;
    }
  }
  
  function togglePassword() {
    const pw  = document.getElementById('password');
    const btn = document.getElementById('toggle-pw-btn');
    if (!pw || !btn) return;
    if (pw.type === 'password') {
      pw.type = 'text';
      btn.textContent = 'Hide';
    } else {
      pw.type = 'password';
      btn.textContent = 'Show';
    }
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('login-btn')) {
      handleLogin();
    }
  });
  
  
  // ---- SIGNUP ----
  
  let selectedRole = 'admin';
  
  function initSignup() {
    if (!document.getElementById('role-admin')) return;
    selectRole('admin');
  }
  
  function selectRole(role) {
    if (role !== 'admin' && role !== 'worker') return;
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
      { pct: '75%',  color: '#0EA5E9',         text: 'Good' },
      { pct: '100%', color: 'var(--success)',  text: 'Strong' },
    ];
  
    fill.style.width      = levels[score].pct;
    fill.style.background = levels[score].color;
    label.textContent     = levels[score].text;
  }
  
  async function handleSignup() {
    const btn = document.getElementById('signup-btn');
    if (btn) btn.disabled = true;
  
    const fname    = sanitizeText(document.getElementById('fname').value, VALIDATION.MAX_NAME_LENGTH);
    const lname    = sanitizeText(document.getElementById('lname').value, VALIDATION.MAX_NAME_LENGTH);
    const email    = sanitizeText(document.getElementById('email').value, VALIDATION.MAX_EMAIL_LENGTH);
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm').value;
  
    if (!fname || !lname || !email || !password || !confirm) {
      showAlert('alert-box', 'Please fill in all fields.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (!isValidName(fname) || !isValidName(lname)) {
      showAlert('alert-box', 'Name contains invalid characters.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (!isValidEmail(email)) {
      showAlert('alert-box', 'Please enter a valid email address.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password must be at least 8 characters.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (password.length > VALIDATION.MAX_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password is too long.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (password !== confirm) {
      showAlert('alert-box', 'Passwords do not match.');
      if (btn) btn.disabled = false;
      return;
    }
  
    if (selectedRole !== 'admin' && selectedRole !== 'worker') {
      showAlert('alert-box', 'Invalid role selected.');
      if (btn) btn.disabled = false;
      return;
    }
  
    try {
      const res = await apiPost('/auth/signup.php', {
        fname,
        lname,
        email:    email.toLowerCase(),
        password,
        confirm,
        role:     selectedRole,
      });
  
      if (!res.success) {
        showAlert('alert-box', res.message || 'Could not create account.');
        if (btn) btn.disabled = false;
        return;
      }
  
      showAlert('alert-box', 'Account created. Redirecting...', 'success');
  
      setTimeout(() => {
        window.location.replace(res.data.role === 'admin'
          ? 'admin-dashboard.html'
          : 'worker-dashboard.html');
      }, 1000);
  
    } catch (e) {
      showAlert('alert-box', 'Could not connect to the server. Please try again.');
      if (btn) btn.disabled = false;
    }
  }
  
  document.addEventListener('DOMContentLoaded', initSignup);