/* =============================================
   worker.js
   Worker dashboard and feedback form logic
   ============================================= */

// ---- WORKER DASHBOARD ----

function initWorkerDashboard() {
    const user = requireWorker();
    setNavbar(user);
  
    document.getElementById('welcome-msg').textContent = greet(user);
  
    const tasks      = getTasks().filter(t => t.status === 'active');
    const feedback   = getFeedback();
    const myFeedback = feedback.filter(f => f.workerEmail === user.email);
    const submittedIds = myFeedback.map(f => f.taskId);
  
    const pending   = tasks.filter(t => !submittedIds.includes(t.id));
    const completed = tasks.filter(t =>  submittedIds.includes(t.id));
  
    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-done').textContent    = completed.length;
  
    window._pendingTasks   = pending;
    window._completedTasks = completed;
    window._myFeedback     = myFeedback;
  
    renderWorkerList('pending');
  }
  
  let currentTab = 'pending';
  
  function showTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderWorkerList(tab);
  }
  
  function renderWorkerList(tab) {
    const list  = document.getElementById('task-list');
    const items = tab === 'pending' ? window._pendingTasks : window._completedTasks;
  
    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state card">
          <h4>${tab === 'pending' ? 'All caught up' : 'No completed tasks yet'}</h4>
          <p>${tab === 'pending' ? 'No pending feedback tasks right now.' : 'Complete a task to see it here.'}</p>
        </div>`;
      return;
    }
  
    list.innerHTML = items.map(task => {
      const isDone = tab === 'completed';
      const sub    = window._myFeedback.find(f => f.taskId === task.id);
      const date   = formatDate(task.createdAt);
      const subDate = sub ? formatDateTime(sub.submittedAt) : null;
  
      return `
        <a class="task-card-worker ${isDone ? 'done' : ''}" href="${isDone ? '#' : 'worker-feedback.html?task=' + task.id}">
          <div class="task-status-bar ${isDone ? 'done' : 'pending'}"></div>
          <div class="task-info">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">${isDone ? 'Submitted ' + subDate : 'Assigned ' + date}</div>
          </div>
          <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}">${isDone ? 'Done' : 'Pending'}</span>
        </a>`;
    }).join('');
  }
  
  
  // ---- WORKER FEEDBACK FORM ----
  
  let currentUser = null;
  let currentTask = null;
  const fieldAnswers = {};
  
  function initFeedbackPage() {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task');
  
    if (!taskId) { showSection('not-found'); return; }
  
    const tasks = getTasks();
    currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) { showSection('not-found'); return; }
  
    currentUser = getCurrentUser();
    if (!currentUser) { showSection('login-gate'); return; }
  
    const feedback = getFeedback();
    const already  = feedback.find(f => f.taskId === taskId && f.workerEmail === currentUser.email);
    if (already) { showSection('already-submitted'); return; }
  
    renderFeedbackForm();
    showSection('form-section');
  }
  
  function showSection(id) {
    const sections = ['login-gate', 'not-found', 'already-submitted', 'form-section', 'success-screen'];
    sections.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }
  
  function gateLogin() {
    const email    = document.getElementById('gate-email').value.trim();
    const password = document.getElementById('gate-password').value;
    const users    = getUsers();
    const user     = users.find(u => u.email === email && u.password === password);
  
    if (!user) {
      showAlert('gate-alert', 'Incorrect email or password.');
      return;
    }
  
    localStorage.setItem('sd_current_user', JSON.stringify(user));
    currentUser = user;
    initFeedbackPage();
  }
  
  function renderFeedbackForm() {
    document.getElementById('task-title').textContent = currentTask.title;
    document.getElementById('task-desc').textContent  = currentTask.description || '';
  
    const container = document.getElementById('fields-container');
    container.innerHTML = currentTask.fields.map(f => {
      let input = '';
  
      if (f.type === 'text') {
        input = `<input class="form-input" id="field_${f.id}" placeholder="Your answer..."/>`;
      } else if (f.type === 'textarea') {
        input = `<textarea class="form-textarea" id="field_${f.id}" placeholder="Your answer..."></textarea>`;
      } else if (f.type === 'rating') {
        input = `<div class="rating-group">
          ${[1,2,3,4,5].map(n =>
            `<button type="button" class="rating-btn" data-field="${f.id}" data-val="${n}" onclick="selectRating('${f.id}', ${n})">${n}</button>`
          ).join('')}
        </div>`;
      } else if (f.type === 'select') {
        input = `<select class="form-select" id="field_${f.id}">
          <option value="">Select an option...</option>
          <option>Strongly Agree</option>
          <option>Agree</option>
          <option>Neutral</option>
          <option>Disagree</option>
          <option>Strongly Disagree</option>
        </select>`;
      } else if (f.type === 'checkbox') {
        input = `<label class="checkbox-label">
          <input type="checkbox" id="field_${f.id}"/>
          I confirm I have read and understood this
        </label>`;
      } else if (f.type === 'yesno') {
        input = `<div class="yesno-group">
          <button type="button" class="yesno-btn yes" data-field="${f.id}" onclick="selectYesNo('${f.id}', 'Yes', this)">Yes</button>
          <button type="button" class="yesno-btn no"  data-field="${f.id}" onclick="selectYesNo('${f.id}', 'No', this)">No</button>
        </div>`;
      }
  
      return `
        <div class="form-group" style="margin-bottom:22px;">
          <label class="form-label">
            ${f.label}${f.required ? ' <span style="color:var(--danger)">*</span>' : ''}
          </label>
          ${input}
        </div>`;
    }).join('');
  }
  
  function selectRating(fieldId, val) {
    fieldAnswers['field_' + fieldId] = val;
    document.querySelectorAll(`[data-field="${fieldId}"]`).forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.val) === val);
    });
  }
  
  function selectYesNo(fieldId, val, btn) {
    fieldAnswers['field_' + fieldId] = val;
    document.querySelectorAll(`[data-field="${fieldId}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
  
  function submitFeedback() {
    const result = {};
    let valid = true;
  
    for (const f of currentTask.fields) {
      let val = '';
  
      if (f.type === 'text' || f.type === 'textarea' || f.type === 'select') {
        val = document.getElementById('field_' + f.id)?.value?.trim() || '';
      } else if (f.type === 'checkbox') {
        val = document.getElementById('field_' + f.id)?.checked ? 'Confirmed' : '';
      } else if (f.type === 'rating' || f.type === 'yesno') {
        val = fieldAnswers['field_' + f.id] || '';
      }
  
      if (f.required && !val) {
        showAlert('form-alert', 'Please answer all required fields.');
        valid = false;
        break;
      }
  
      result[f.label] = val || '--';
    }
  
    if (!valid) return;
  
    const entry = {
      id:          generateId('fb'),
      taskId:      currentTask.id,
      taskTitle:   currentTask.title,
      workerName:  currentUser.name,
      workerEmail: currentUser.email,
      answers:     result,
      submittedAt: new Date().toISOString()
    };
  
    const feedback = getFeedback();
    feedback.push(entry);
    saveFeedback(feedback);
  
    showSection('success-screen');
  }