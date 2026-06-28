/* =============================================
   worker.js
   Worker pages — connected to PHP backend
   ============================================= */

// ---- WORKER DASHBOARD ----

let _pendingTasks   = [];
let _completedTasks = [];

async function initWorkerDashboard() {
  const user = await requireWorker();
  if (!user) return;

  setNavbar(user);
  document.getElementById('welcome-msg').textContent = greet(user);

  try {
    const res = await apiGet('/tasks/get_tasks_worker.php');

    if (!res.success) {
      showAlert('dashboard-alert', res.message || 'Could not load tasks.');
      return;
    }

    _pendingTasks   = res.data.pending;
    _completedTasks = res.data.completed;

    document.getElementById('stat-pending').textContent = _pendingTasks.length;
    document.getElementById('stat-done').textContent    = _completedTasks.length;

    renderWorkerList('pending');

  } catch (e) {
    showAlert('dashboard-alert', 'Could not connect to the server.');
  }
}

function showTab(tab, btn) {
  if (tab !== 'pending' && tab !== 'done') return;
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
    const isDone = tab === 'done';

    const a = document.createElement('a');
    a.className = `task-card-worker ${isDone ? 'done' : ''}`;
    a.href = isDone ? '#' : `worker-feedback.html?task=${encodeURIComponent(task.id)}`;
    if (isDone) a.addEventListener('click', e => e.preventDefault());

    const bar = document.createElement('div');
    bar.className = `task-status-bar ${isDone ? 'done' : 'pending'}`;

    const info = document.createElement('div');
    info.className = 'task-info';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = isDone
      ? `Submitted ${formatDateTime(task.submitted_at)}`
      : `Assigned ${formatDate(task.created_at)}`;

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

let _currentTask = null;
const _fieldAnswers = {};

async function initFeedbackPage() {
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get('task');

  if (!taskId || typeof taskId !== 'string' || taskId.length > 20) {
    showSection('not-found');
    return;
  }

  // Check if logged in
  await loadSession();
  _currentUser = getCurrentUser();

  if (!_currentUser) {
    showSection('login-gate');
    return;
  }

  if (_currentUser.role !== 'worker') {
    showSection('not-found');
    return;
  }

  // Load task from server
  try {
    const res = await apiGet(`/tasks/get_task_worker.php?id=${encodeURIComponent(taskId)}`);

    if (!res.success) {
      showSection(res.data?.already_submitted ? 'already-submitted' : 'not-found');
      return;
    }

    _currentTask = res.data.task;
    renderFeedbackForm();
    showSection('form-section');

  } catch (e) {
    showSection('not-found');
  }
}

function showSection(id) {
  const sections = ['login-gate', 'not-found', 'already-submitted', 'form-section', 'success-screen'];
  if (!sections.includes(id)) return;
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? 'block' : 'none';
  });
}

async function gateLogin() {
  const email    = sanitizeText(document.getElementById('gate-email').value, VALIDATION.MAX_EMAIL_LENGTH);
  const password = document.getElementById('gate-password').value;

  if (!isValidEmail(email) || !password) {
    showAlert('gate-alert', 'Please enter a valid email and password.');
    return;
  }

  try {
    const res = await apiPost('/auth/login.php', { email, password });

    if (!res.success) {
      showAlert('gate-alert', res.message || 'Incorrect email or password.');
      return;
    }

    // Reload session and retry
    await loadSession();
    _currentUser = getCurrentUser();
    await initFeedbackPage();

  } catch (e) {
    showAlert('gate-alert', 'Could not connect to the server.');
  }
}

function renderFeedbackForm() {
  document.getElementById('task-title').textContent = _currentTask.title;
  document.getElementById('task-desc').textContent  = _currentTask.description || '';

  const container = document.getElementById('fields-container');
  container.innerHTML = '';

  const ALLOWED = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];

  _currentTask.fields.forEach(f => {
    if (!ALLOWED.includes(f.field_type)) return;

    const group = document.createElement('div');
    group.className = 'form-group';
    group.style.marginBottom = '22px';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = f.label;
    if (f.is_required) {
      const req = document.createElement('span');
      req.style.color = 'var(--danger)';
      req.textContent = ' *';
      label.appendChild(req);
    }
    group.appendChild(label);

    const safeId = 'field_' + f.id;

    if (f.field_type === 'text') {
      const input = document.createElement('input');
      input.className = 'form-input';
      input.id = safeId;
      input.placeholder = 'Your answer...';
      input.maxLength = VALIDATION.MAX_ANSWER_LENGTH;
      group.appendChild(input);

    } else if (f.field_type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.className = 'form-textarea';
      ta.id = safeId;
      ta.placeholder = 'Your answer...';
      ta.maxLength = VALIDATION.MAX_ANSWER_LENGTH;
      group.appendChild(ta);

    } else if (f.field_type === 'rating') {
      const rg = document.createElement('div');
      rg.className = 'rating-group';
      [1,2,3,4,5].forEach(n => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rating-btn';
        btn.dataset.field = f.id;
        btn.dataset.val   = n;
        btn.textContent   = n;
        btn.addEventListener('click', (function(fid, val) {
          return function() { selectRating(fid, val, f.id); };
        })(f.id, n));
        rg.appendChild(btn);
      });
      group.appendChild(rg);

    } else if (f.field_type === 'select') {
      const sel = document.createElement('select');
      sel.className = 'form-select';
      sel.id = safeId;
      ['', 'Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'].forEach((opt, i) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = i === 0 ? 'Select an option...' : opt;
        sel.appendChild(o);
      });
      group.appendChild(sel);

    } else if (f.field_type === 'checkbox') {
      const lbl = document.createElement('label');
      lbl.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = safeId;
      lbl.appendChild(cb);
      lbl.append(' I confirm I have read and understood this');
      group.appendChild(lbl);

    } else if (f.field_type === 'yesno') {
      const yg = document.createElement('div');
      yg.className = 'yesno-group';
      ['Yes', 'No'].forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `yesno-btn ${val.toLowerCase()}`;
        btn.dataset.field = f.id;
        btn.textContent = val;
        btn.addEventListener('click', (function(fid, v, b) {
          return function() { selectYesNo(fid, v, b); };
        })(f.id, val, btn));
        yg.appendChild(btn);
      });
      group.appendChild(yg);
    }

    container.appendChild(group);
  });
}

function selectRating(fieldId, val) {
  if (typeof fieldId !== 'string') return;
  _fieldAnswers[fieldId] = val;
  document.querySelectorAll(`[data-field="${CSS.escape(String(fieldId))}"]`).forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.val) === val);
  });
}

function selectYesNo(fieldId, val, btn) {
  if (val !== 'Yes' && val !== 'No') return;
  _fieldAnswers[fieldId] = val;
  document.querySelectorAll(`[data-field="${CSS.escape(String(fieldId))}"]`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function submitFeedback() {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  const answers  = {};
  const ALLOWED  = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
  let   valid    = true;

  for (const f of _currentTask.fields) {
    if (!ALLOWED.includes(f.field_type)) continue;

    let val = '';

    if (f.field_type === 'text' || f.field_type === 'textarea' || f.field_type === 'select') {
      val = sanitizeText(document.getElementById('field_' + f.id)?.value || '', VALIDATION.MAX_ANSWER_LENGTH);
    } else if (f.field_type === 'checkbox') {
      val = document.getElementById('field_' + f.id)?.checked ? 'Confirmed' : '';
    } else if (f.field_type === 'rating') {
      const raw = _fieldAnswers[f.id];
      val = [1,2,3,4,5].includes(raw) ? String(raw) : '';
    } else if (f.field_type === 'yesno') {
      const raw = _fieldAnswers[f.id];
      val = (raw === 'Yes' || raw === 'No') ? raw : '';
    }

    if (f.is_required && !val) {
      showAlert('form-alert', 'Please answer all required fields.');
      valid = false;
      break;
    }

    answers[f.id] = val || '';
  }

  if (!valid) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  try {
    const res = await apiPost('/feedback/submit.php', {
      task_id: _currentTask.id,
      answers,
    });

    if (!res.success) {
      showAlert('form-alert', res.message || 'Could not submit feedback.');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    showSection('success-screen');

  } catch (e) {
    showAlert('form-alert', 'Could not connect to the server.');
    if (submitBtn) submitBtn.disabled = false;
  }
}