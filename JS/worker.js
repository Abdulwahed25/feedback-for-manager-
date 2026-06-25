/* =============================================
   worker.js
   Worker dashboard and feedback form — security hardened
   ============================================= */

// ---- WORKER DASHBOARD ----

function initWorkerDashboard() {
    const user = requireWorker();
    if (!user) return;
    setNavbar(user);
  
    // textContent — never innerHTML for user data
    document.getElementById('welcome-msg').textContent = greet(user);
  
    const tasks      = getTasks().filter(t => t.status === 'active');
    const feedback   = getFeedback();
    const myFeedback = feedback.filter(f => f.workerEmail === user.email);
    const submittedIds = myFeedback.map(f => f.taskId);
  
    const pending   = tasks.filter(t => !submittedIds.includes(t.id));
    const completed = tasks.filter(t =>  submittedIds.includes(t.id));
  
    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-done').textContent    = completed.length;
  
    // Store in module-scoped variables, not window globals
    _pendingTasks   = pending;
    _completedTasks = completed;
    _myFeedback     = myFeedback;
  
    renderWorkerList('pending');
  }
  
  // Module-scoped instead of window globals
  let _pendingTasks   = [];
  let _completedTasks = [];
  let _myFeedback     = [];
  let _currentTab     = 'pending';
  
  function showTab(tab, btn) {
    // Whitelist tab values
    if (tab !== 'pending' && tab !== 'done') return;
    _currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderWorkerList(tab);
  }
  
  function renderWorkerList(tab) {
    const list  = document.getElementById('task-list');
    const items = tab === 'pending' ? _pendingTasks : _completedTasks;
  
    list.innerHTML = '';
  
    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state card">
          <h4>${tab === 'pending' ? 'All caught up' : 'No completed tasks yet'}</h4>
          <p>${tab === 'pending' ? 'No pending feedback tasks right now.' : 'Complete a task to see it here.'}</p>
        </div>`;
      return;
    }
  
    items.forEach(task => {
      const isDone  = tab === 'done';
      const sub     = _myFeedback.find(f => f.taskId === task.id);
      const date    = formatDate(task.createdAt);
      const subDate = sub ? formatDateTime(sub.submittedAt) : null;
  
      const a = document.createElement('a');
      a.className = `task-card-worker ${isDone ? 'done' : ''}`;
  
      if (isDone) {
        a.href = '#';
        a.addEventListener('click', e => e.preventDefault());
      } else {
        // Security: encode task ID in URL
        a.href = 'worker-feedback.html?task=' + encodeURIComponent(task.id);
      }
  
      const bar = document.createElement('div');
      bar.className = `task-status-bar ${isDone ? 'done' : 'pending'}`;
  
      const info = document.createElement('div');
      info.className = 'task-info';
  
      const title = document.createElement('div');
      title.className = 'task-title';
      title.textContent = task.title; // textContent — XSS safe
  
      const meta = document.createElement('div');
      meta.className = 'task-meta';
      meta.textContent = isDone
        ? `Submitted ${subDate}`
        : `Assigned ${date}`;
  
      info.appendChild(title);
      info.appendChild(meta);
  
      const badge = document.createElement('span');
      badge.className = `badge ${isDone ? 'badge-success' : 'badge-warning'}`;
      badge.textContent = isDone ? 'Done' : 'Pending';
  
      a.appendChild(bar);
      a.appendChild(info);
      a.appendChild(badge);
      list.appendChild(a);
    });
  }
  
  
  // ---- WORKER FEEDBACK FORM ----
  
  let _currentUser = null;
  let _currentTask = null;
  const _fieldAnswers = {};
  
  function initFeedbackPage() {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
  
    // Security: validate taskId before using it
    if (!taskId || typeof taskId !== 'string' || taskId.length > 100) {
      showSection('not-found');
      return;
    }
  
    const tasks = getTasks();
    _currentTask = tasks.find(t => t.id === taskId);
    if (!_currentTask) { showSection('not-found'); return; }
  
    // Security: only show active tasks
    if (_currentTask.status !== 'active') { showSection('not-found'); return; }
  
    _currentUser = getCurrentUser();
    if (!_currentUser) { showSection('login-gate'); return; }
  
    // Security: workers only — admins should not submit feedback
    if (_currentUser.role !== 'worker') {
      showSection('not-found');
      return;
    }
  
    const feedback = getFeedback();
    const already  = feedback.find(f => f.taskId === taskId && f.workerEmail === _currentUser.email);
    if (already) { showSection('already-submitted'); return; }
  
    renderFeedbackForm();
    showSection('form-section');
  }
  
  function showSection(id) {
    const sections = ['login-gate', 'not-found', 'already-submitted', 'form-section', 'success-screen'];
    // Whitelist section IDs
    if (!sections.includes(id)) return;
    sections.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }
  
  function gateLogin() {
    if (isLoginLocked()) {
      showAlert('gate-alert', 'Too many failed attempts. Please wait 15 minutes.');
      return;
    }
  
    const email    = sanitizeText(document.getElementById('gate-email').value, VALIDATION.MAX_EMAIL_LENGTH);
    const password = document.getElementById('gate-password').value;
  
    if (!isValidEmail(email) || !password) {
      showAlert('gate-alert', 'Please enter a valid email and password.');
      return;
    }
  
    const users = getUsers();
    const user  = users.find(u => u.email === email && u.password === password);
  
    if (!user) {
      recordFailedLogin();
      showAlert('gate-alert', 'Incorrect email or password.');
      return;
    }
  
    clearLoginAttempts();
    localStorage.setItem('sd_current_user', JSON.stringify(stripPassword(user)));
    _currentUser = stripPassword(user);
    initFeedbackPage();
  }
  
  function renderFeedbackForm() {
    // Use textContent for task data — XSS safe
    document.getElementById('task-title').textContent = _currentTask.title;
    document.getElementById('task-desc').textContent  = _currentTask.description || '';
  
    const container = document.getElementById('fields-container');
    container.innerHTML = '';
  
    _currentTask.fields.forEach(f => {
      // Security: validate field type is in whitelist
      const ALLOWED = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
      if (!ALLOWED.includes(f.type)) return;
  
      const group = document.createElement('div');
      group.className = 'form-group';
      group.style.marginBottom = '22px';
  
      const label = document.createElement('label');
      label.className = 'form-label';
      label.textContent = f.label; // textContent — XSS safe
      if (f.required) {
        const req = document.createElement('span');
        req.style.color = 'var(--danger)';
        req.textContent = ' *';
        label.appendChild(req);
      }
  
      group.appendChild(label);
  
      const safeFieldId = 'field_' + encodeURIComponent(f.id);
  
      if (f.type === 'text') {
        const input = document.createElement('input');
        input.className = 'form-input';
        input.id = safeFieldId;
        input.placeholder = 'Your answer...';
        input.maxLength = VALIDATION.MAX_ANSWER_LENGTH;
        group.appendChild(input);
  
      } else if (f.type === 'textarea') {
        const ta = document.createElement('textarea');
        ta.className = 'form-textarea';
        ta.id = safeFieldId;
        ta.placeholder = 'Your answer...';
        ta.maxLength = VALIDATION.MAX_ANSWER_LENGTH;
        group.appendChild(ta);
  
      } else if (f.type === 'rating') {
        const ratingGroup = document.createElement('div');
        ratingGroup.className = 'rating-group';
        [1,2,3,4,5].forEach(n => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rating-btn';
          btn.dataset.field = f.id;
          btn.dataset.val   = n;
          btn.textContent   = n;
          btn.addEventListener('click', (function(fieldId, val) {
            return function() { selectRating(fieldId, val); };
          })(f.id, n));
          ratingGroup.appendChild(btn);
        });
        group.appendChild(ratingGroup);
  
      } else if (f.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'form-select';
        sel.id = safeFieldId;
        ['', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'].forEach((opt, i) => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = i === 0 ? 'Select an option...' : opt;
          sel.appendChild(o);
        });
        group.appendChild(sel);
  
      } else if (f.type === 'checkbox') {
        const lbl = document.createElement('label');
        lbl.className = 'checkbox-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id   = safeFieldId;
        lbl.appendChild(cb);
        lbl.append(' I confirm I have read and understood this');
        group.appendChild(lbl);
  
      } else if (f.type === 'yesno') {
        const yesnoGroup = document.createElement('div');
        yesnoGroup.className = 'yesno-group';
        ['Yes', 'No'].forEach(val => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `yesno-btn ${val.toLowerCase()}`;
          btn.dataset.field = f.id;
          btn.textContent = val;
          btn.addEventListener('click', (function(fieldId, v, b) {
            return function() { selectYesNo(fieldId, v, b); };
          })(f.id, val, btn));
          yesnoGroup.appendChild(btn);
        });
        group.appendChild(yesnoGroup);
      }
  
      container.appendChild(group);
    });
  }
  
  function selectRating(fieldId, val) {
    if (typeof fieldId !== 'string' || typeof val !== 'number') return;
    _fieldAnswers['field_' + fieldId] = val;
    document.querySelectorAll(`[data-field="${CSS.escape(fieldId)}"]`).forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.val) === val);
    });
  }
  
  function selectYesNo(fieldId, val, btn) {
    // Whitelist allowed values
    if (val !== 'Yes' && val !== 'No') return;
    if (typeof fieldId !== 'string') return;
    _fieldAnswers['field_' + fieldId] = val;
    document.querySelectorAll(`[data-field="${CSS.escape(fieldId)}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
  
  function submitFeedback() {
    const result = {};
    let valid = true;
  
    for (const f of _currentTask.fields) {
      const ALLOWED = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
      if (!ALLOWED.includes(f.type)) continue;
  
      let val = '';
  
      if (f.type === 'text' || f.type === 'textarea' || f.type === 'select') {
        const el = document.getElementById('field_' + encodeURIComponent(f.id));
        val = el ? sanitizeText(el.value, VALIDATION.MAX_ANSWER_LENGTH) : '';
      } else if (f.type === 'checkbox') {
        const el = document.getElementById('field_' + encodeURIComponent(f.id));
        val = el && el.checked ? 'Confirmed' : '';
      } else if (f.type === 'rating') {
        const raw = _fieldAnswers['field_' + f.id];
        // Whitelist rating values
        val = [1,2,3,4,5].includes(raw) ? String(raw) : '';
      } else if (f.type === 'yesno') {
        const raw = _fieldAnswers['field_' + f.id];
        // Whitelist yes/no values
        val = (raw === 'Yes' || raw === 'No') ? raw : '';
      }
  
      if (f.required && !val) {
        showAlert('form-alert', 'Please answer all required fields.');
        valid = false;
        break;
      }
  
      // Use sanitized label as key — escapeHTML handled at render time
      result[sanitizeText(f.label, VALIDATION.MAX_LABEL_LENGTH)] = val || '--';
    }
  
    if (!valid) return;
  
    // Double-check: has this worker already submitted?
    const feedback = getFeedback();
    const already  = feedback.find(f => f.taskId === _currentTask.id && f.workerEmail === _currentUser.email);
    if (already) {
      showSection('already-submitted');
      return;
    }
  
    const entry = {
      id:          generateId('fb'),
      taskId:      _currentTask.id,
      taskTitle:   _currentTask.title,
      workerName:  _currentUser.name,
      workerEmail: _currentUser.email,
      answers:     result,
      submittedAt: new Date().toISOString()
    };
  
    feedback.push(entry);
    saveFeedback(feedback);
    showSection('success-screen');
  }