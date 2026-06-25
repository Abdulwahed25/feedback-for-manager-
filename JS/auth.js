/* =============================================
   auth.js
   Login and signup logic — security hardened
   ============================================= */

// ---- LOGIN ----

function handleLogin() {
    // Rate limiting check — block after 5 failed attempts
    if (isLoginLocked()) {
      showAlert('alert-box', 'Too many failed attempts. Please wait 15 minutes before trying again.');
      return;
    }
  
    const emailRaw    = document.getElementById('email').value.trim();
    const passwordRaw = document.getElementById('password').value;
  
    // Server-side will do real validation — this is just UX feedback
    if (!emailRaw || !passwordRaw) {
      showAlert('alert-box', 'Please fill in all fields.');
      return;
    }
  
    if (!isValidEmail(emailRaw)) {
      showAlert('alert-box', 'Please enter a valid email address.');
      return;
    }
  
    if (passwordRaw.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password must be at least 8 characters.');
      return;
    }
  
    if (passwordRaw.length > VALIDATION.MAX_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Invalid credentials.');
      return;
    }
  
    const users = getUsers();
    const user  = users.find(u => u.email === emailRaw && u.password === passwordRaw);
  
    if (!user) {
      // Record failed attempt for rate limiting
      const state = recordFailedLogin();
      const remaining = RATE_LIMIT.MAX_ATTEMPTS - state.attempts.length;
  
      if (state.locked) {
        showAlert('alert-box', 'Too many failed attempts. Please wait 15 minutes.');
      } else {
        // Generic message — do not reveal whether email or password was wrong
        showAlert('alert-box', `Incorrect credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
      return;
    }
  
    // Success — clear rate limit, store session WITHOUT password
    clearLoginAttempts();
    localStorage.setItem('sd_current_user', JSON.stringify(stripPassword(user)));
  
    if (user.role === 'admin') {
      window.location.replace('admin-dashboard.html');
    } else {
      window.location.replace('worker-dashboard.html');
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
  
  // Allow Enter key — only on login page where email field exists
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('email') && document.getElementById('toggle-pw-btn')) {
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
    // Whitelist — only accept known roles
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
  
  function handleSignup() {
    const fname    = sanitizeText(document.getElementById('fname').value, VALIDATION.MAX_NAME_LENGTH);
    const lname    = sanitizeText(document.getElementById('lname').value, VALIDATION.MAX_NAME_LENGTH);
    const email    = sanitizeText(document.getElementById('email').value, VALIDATION.MAX_EMAIL_LENGTH);
    const password = document.getElementById('password').value;
    const confirm  = document.getElementById('confirm').value;
  
    // ---- Validate all fields ----
    if (!fname || !lname || !email || !password || !confirm) {
      showAlert('alert-box', 'Please fill in all fields.');
      return;
    }
  
    if (!isValidName(fname) || !isValidName(lname)) {
      showAlert('alert-box', 'Name contains invalid characters.');
      return;
    }
  
    if (!isValidEmail(email)) {
      showAlert('alert-box', 'Please enter a valid email address.');
      return;
    }
  
    if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password must be at least 8 characters.');
      return;
    }
  
    if (password.length > VALIDATION.MAX_PASSWORD_LENGTH) {
      showAlert('alert-box', 'Password is too long.');
      return;
    }
  
    if (password !== confirm) {
      showAlert('alert-box', 'Passwords do not match.');
      return;
    }
  
    // Whitelist role — never trust what the UI says alone
    if (selectedRole !== 'admin' && selectedRole !== 'worker') {
      showAlert('alert-box', 'Invalid role selected.');
      return;
    }
  
    const users = getUsers();
    if (users.find(u => u.email === email.toLowerCase())) {
      showAlert('alert-box', 'An account with this email already exists.');
      return;
    }
  
    // Security note: In the PHP backend, password is bcrypt hashed before storage.
    // In this localStorage prototype, we store it as-is only for demo purposes.
    // This entire function will be replaced by a fetch() call to signup.php.
    const newUser = {
      name:      `${fname} ${lname}`,
      email:     email.toLowerCase(), // normalize email to lowercase
      password,
      role:      selectedRole,
      createdAt: new Date().toISOString()
    };
  
    users.push(newUser);
    saveUsers(users);
  
    // Store session WITHOUT password
    localStorage.setItem('sd_current_user', JSON.stringify(stripPassword(newUser)));
  
    showAlert('alert-box', 'Account created. Redirecting...', 'success');
  
    setTimeout(() => {
      window.location.replace(selectedRole === 'admin'
        ? 'admin-dashboard.html'
        : 'worker-dashboard.html');
    }, 1000);
  }
  
  document.addEventListener('DOMContentLoaded', initSignup);