/* =============================================
   admin.js
   All admin page logic
   ============================================= */

// ---- DASHBOARD ----

function initDashboard() {
    const user = requireAdmin();
    setNavbar(user);
  
    document.getElementById('welcome-msg').textContent = greet(user);
  
    const tasks    = getTasks();
    const feedback = getFeedback();
    const workers  = getWorkers();
  
    const activeTasks    = tasks.filter(t => t.status === 'active');
    const totalResponses = feedback.length;
    const expectedTotal  = activeTasks.length * workers.length;
    const rate = expectedTotal > 0
      ? Math.round((totalResponses / expectedTotal) * 100) + '%'
      : '--';
  
    document.getElementById('stat-active').textContent    = activeTasks.length;
    document.getElementById('stat-responses').textContent = totalResponses;
    document.getElementById('stat-rate').textContent      = rate;
    document.getElementById('stat-workers').textContent   = workers.length;
  
    renderTaskList(tasks, feedback, workers);
    renderLatestLink(tasks);
    renderActivityFeed(feedback, tasks);
  }
  
  function renderTaskList(tasks, feedback, workers) {
    const listEl = document.getElementById('task-list');
    if (tasks.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h4>No tasks yet</h4>
          <p>Create your first task to start collecting feedback.</p>
          <a href="admin-create-task.html" class="btn btn-primary btn-sm" style="margin-top:8px;">Create Task</a>
        </div>`;
      return;
    }
  
    const recent = [...tasks].reverse().slice(0, 6);
    listEl.innerHTML = recent.map(task => {
      const taskFeedback = feedback.filter(f => f.taskId === task.id);
      const pct  = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
      const date = formatDate(task.createdAt);
      const fillClass = pct >= 80 ? 'success' : pct >= 40 ? '' : 'warning';
  
      return `
        <a class="task-item" href="admin-task-detail.html?id=${task.id}">
          <div class="task-icon"></div>
          <div class="task-info">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
              <span>${date}</span>
              <span>${taskFeedback.length} / ${workers.length} responded</span>
              <span class="badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}">${task.status}</span>
            </div>
          </div>
          <div class="task-progress">
            <div class="task-progress-label">${pct}%</div>
            <div class="progress-bar" style="width:80px;">
              <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
          </div>
        </a>`;
    }).join('');
  }
  
  function renderLatestLink(tasks) {
    if (tasks.length === 0) return;
    const latest = tasks[tasks.length - 1];
    const link   = buildFeedbackLink(latest.id);
    document.getElementById('copy-url').textContent = link;
    document.getElementById('copy-btn').style.display = 'inline-flex';
  }
  
  function renderActivityFeed(feedback, tasks) {
    const actEl = document.getElementById('activity-feed');
    if (feedback.length === 0) {
      actEl.innerHTML = `<p style="color:var(--grey-400); font-size:0.85rem; text-align:center; padding:20px 0;">No activity yet</p>`;
      return;
    }
    const recent = [...feedback].reverse().slice(0, 5);
    actEl.innerHTML = recent.map(f => {
      const task = tasks.find(t => t.id === f.taskId);
      return `
        <div class="activity-item">
          <div class="activity-dot"></div>
          <div>
            <div class="activity-text"><strong>${f.workerName}</strong> submitted feedback on <strong>${task ? task.title : 'a task'}</strong></div>
            <div class="activity-time">${formatDateTime(f.submittedAt)}</div>
          </div>
        </div>`;
    }).join('');
  }
  
  function copyDashboardLink() {
    const url = document.getElementById('copy-url').textContent;
    const btn = document.getElementById('copy-btn');
    copyToClipboard(url, btn, 'Copy');
  }
  
  
  // ---- CREATE TASK ----
  
  let fields = [];
  
  function initCreateTask() {
    const user = requireAdmin();
    setNavbar(user);
  
    fields = [
      { id: generateId('f'), type: 'textarea', label: 'What is your understanding of this task?', required: true  },
      { id: generateId('f'), type: 'rating',   label: 'How clear was the information provided?',  required: true  },
      { id: generateId('f'), type: 'text',     label: 'Any questions or concerns?',               required: false }
    ];
  
    renderFields();
  }
  
  const fieldTypeLabels = {
    text:     'Short Text',
    textarea: 'Long Text',
    rating:   'Rating 1 to 5',
    select:   'Dropdown',
    checkbox: 'Checkbox',
    yesno:    'Yes / No'
  };
  
  function addField(type) {
    fields.push({ id: generateId('f'), type, label: fieldTypeLabels[type] + ' Question', required: false });
    renderFields();
  }
  
  function deleteField(id) {
    fields = fields.filter(f => f.id !== id);
    renderFields();
  }
  
  function toggleRequired(id) {
    const f = fields.find(f => f.id === id);
    if (f) { f.required = !f.required; renderFields(); }
  }
  
  function updateFieldLabel(id, val) {
    const f = fields.find(f => f.id === id);
    if (f) { f.label = val; updatePreview(); }
  }
  
  function renderFields() {
    const list  = document.getElementById('fields-list');
    const empty = document.getElementById('fields-empty');
  
    if (empty) empty.style.display = fields.length ? 'none' : 'block';
  
    const items = fields.map(f => `
      <div class="field-item">
        <span class="field-drag">|||</span>
        <div class="field-info">
          <input class="field-label-edit" value="${f.label}" onchange="updateFieldLabel('${f.id}', this.value)" />
          <div class="field-type-tag">${fieldTypeLabels[f.type]}</div>
        </div>
        <button class="field-required-toggle ${f.required ? 'on' : ''}" onclick="toggleRequired('${f.id}')">
          ${f.required ? 'Required' : 'Optional'}
        </button>
        <button class="field-delete" onclick="deleteField('${f.id}')">Remove</button>
      </div>`).join('');
  
    list.innerHTML = `
      <div id="fields-empty" class="empty-fields" style="display:${fields.length ? 'none' : 'block'}">
        Click a field type above to add it to your form
      </div>` + items;
  
    updatePreview();
  }
  
  function updatePreview() {
    const titleEl = document.getElementById('preview-title');
    const descEl  = document.getElementById('preview-desc');
    const fieldsEl = document.getElementById('preview-fields');
  
    if (titleEl) titleEl.textContent = document.getElementById('task-title').value || 'Task title will appear here';
    if (descEl)  descEl.textContent  = document.getElementById('task-desc').value  || 'Description will appear here';
  
    if (!fieldsEl) return;
  
    if (fields.length === 0) {
      fieldsEl.innerHTML = `<p style="color:var(--grey-300); font-size:0.82rem; text-align:center; padding:20px 0;">Add fields to see preview</p>`;
      return;
    }
  
    fieldsEl.innerHTML = fields.map(f => {
      let input = '';
      if (f.type === 'text')     input = `<input class="preview-input" placeholder="Worker answer..." readonly/>`;
      if (f.type === 'textarea') input = `<textarea class="preview-input preview-textarea" placeholder="Worker answer..." readonly></textarea>`;
      if (f.type === 'rating')   input = `<div class="preview-rating">1 &nbsp; 2 &nbsp; 3 &nbsp; 4 &nbsp; 5</div>`;
      if (f.type === 'select')   input = `<select class="preview-input" disabled><option>Select an option...</option></select>`;
      if (f.type === 'checkbox') input = `<label class="preview-check"><input type="checkbox" disabled/> I confirm</label>`;
      if (f.type === 'yesno')    input = `<div class="preview-yesno"><button disabled>Yes</button><button disabled>No</button></div>`;
  
      return `
        <div class="preview-field">
          <div class="preview-label">${f.label}${f.required ? ' <span class="req">*</span>' : ''}</div>
          ${input}
        </div>`;
    }).join('');
  }
  
  function createTask() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) { alert('Please enter a task title.'); return; }
    if (fields.length === 0) { alert('Please add at least one field.'); return; }
  
    const task = {
      id:          generateId('task'),
      title,
      description: document.getElementById('task-desc').value.trim(),
      fields:      fields.map(f => ({ ...f })),
      createdAt:   new Date().toISOString(),
      status:      'active'
    };
  
    const tasks = getTasks();
    tasks.push(task);
    saveTasks(tasks);
  
    const link = buildFeedbackLink(task.id);
    document.getElementById('generated-link').textContent = link;
    document.getElementById('link-result').style.display = 'block';
    document.getElementById('link-result').scrollIntoView({ behavior: 'smooth' });
  }
  
  function copyGeneratedLink() {
    const link = document.getElementById('generated-link').textContent;
    const btn  = document.getElementById('copy-generated-btn');
    copyToClipboard(link, btn, 'Copy Link');
  }
  
  function buildFeedbackLink(taskId) {
    return window.location.origin + '/pages/worker-feedback.html?task=' + taskId;
  }
  
  
  // ---- TASK DETAIL ----
  
  function initTaskDetail() {
    const user   = requireAdmin();
    setNavbar(user);
  
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('id');
  
    if (!taskId) { renderHistory(); return; }
    renderDetail(taskId);
  }
  
  function renderHistory() {
    document.title = 'History - Sales Department';
    const tasks    = getTasks();
    const feedback = getFeedback();
    const workers  = getWorkers();
    const content  = document.getElementById('page-content');
  
    if (tasks.length === 0) {
      content.innerHTML = `
        <div class="page-header"><h2>History</h2><p>All feedback tasks ever created.</p></div>
        <div class="empty-state">
          <h4>No tasks yet</h4>
          <p>Create your first task to see history here.</p>
          <a href="admin-create-task.html" class="btn btn-primary btn-sm" style="margin-top:8px;">Create Task</a>
        </div>`;
      return;
    }
  
    const rows = [...tasks].reverse().map(task => {
      const taskFeedback = feedback.filter(f => f.taskId === task.id);
      const pct  = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
      const date = formatDate(task.createdAt);
      const fillClass = pct >= 80 ? 'success' : '';
  
      return `
        <tr>
          <td><a href="admin-task-detail.html?id=${task.id}" style="font-weight:600; color:var(--purple-600);">${task.title}</a></td>
          <td>${date}</td>
          <td>${taskFeedback.length} / ${workers.length}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="progress-bar" style="width:80px;">
                <div class="progress-fill ${fillClass}" style="width:${pct}%"></div>
              </div>
              <span style="font-size:0.82rem; color:var(--grey-400);">${pct}%</span>
            </div>
          </td>
          <td><span class="badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}">${task.status}</span></td>
          <td><a href="admin-task-detail.html?id=${task.id}" class="btn btn-outline btn-sm">View</a></td>
        </tr>`;
    }).join('');
  
    content.innerHTML = `
      <div class="page-header">
        <h2>History</h2>
        <p>All feedback tasks and their responses.</p>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Created</th>
              <th>Responses</th>
              <th>Rate</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  
  function renderDetail(taskId) {
    const tasks    = getTasks();
    const feedback = getFeedback();
    const workers  = getWorkers();
    const task     = tasks.find(t => t.id === taskId);
    const content  = document.getElementById('page-content');
  
    if (!task) {
      content.innerHTML = `<div class="empty-state"><h3>Task not found</h3></div>`;
      return;
    }
  
    const taskFeedback    = feedback.filter(f => f.taskId === taskId);
    const respondedEmails = taskFeedback.map(f => f.workerEmail);
    const pending = workers.filter(w => !respondedEmails.includes(w.email));
    const pct  = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
    const link = buildFeedbackLink(task.id);
  
    content.innerHTML = `
      <div style="margin-bottom:16px;">
        <a href="admin-history.html" class="back-link">Back to All Tasks</a>
      </div>
  
      <div class="detail-header">
        <span class="badge badge-purple">Feedback Task</span>
        <h2>${task.title}</h2>
        <p>${task.description || 'No description provided.'}</p>
        <div class="detail-meta">
          <span>Created ${formatDate(task.createdAt)}</span>
          <span>${taskFeedback.length} / ${workers.length} responded</span>
          <span>${pct}% response rate</span>
        </div>
      </div>
  
      <div class="stats-row" style="margin-bottom:24px;">
        <div class="stat-card purple">
          <span class="stat-label">Response Rate</span>
          <span class="stat-value">${pct}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Responded</span>
          <span class="stat-value">${taskFeedback.length}</span>
          <span class="stat-sub">out of ${workers.length} workers</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Pending</span>
          <span class="stat-value">${pending.length}</span>
          <span class="stat-sub">have not responded</span>
        </div>
      </div>
  
      <div class="card" style="margin-bottom:24px;">
        <h4 style="margin-bottom:10px;">Task Link</h4>
        <p style="font-size:0.85rem; margin-bottom:12px;">Share this link in your Outlook email so workers can submit feedback.</p>
        <div class="copy-box">
          <span style="flex:1;">${link}</span>
          <button class="btn btn-primary btn-sm" onclick="copyToClipboard('${link}', this, 'Copy Link')">Copy Link</button>
        </div>
      </div>
  
      <div class="detail-two-col">
        <div>
          <h3 style="margin-bottom:16px;">Responses (${taskFeedback.length})</h3>
          ${taskFeedback.length === 0
            ? `<div class="empty-state card"><h4>No responses yet</h4><p>Share the task link with your team.</p></div>`
            : taskFeedback.map(fb => `
                <div class="response-card">
                  <div class="response-header">
                    <div class="response-avatar">${fb.workerName.charAt(0)}</div>
                    <div>
                      <div class="response-name">${fb.workerName}</div>
                      <div class="response-time">${fb.workerEmail} &middot; ${formatDateTime(fb.submittedAt)}</div>
                    </div>
                    <span class="badge badge-success" style="margin-left:auto;">Submitted</span>
                  </div>
                  ${Object.entries(fb.answers).map(([q, a]) => `
                    <div class="answer-row">
                      <div class="answer-q">${q}</div>
                      <div class="answer-a">${a}</div>
                    </div>`).join('')}
                </div>`).join('')}
        </div>
  
        <div>
          <div class="card">
            <h4 style="margin-bottom:12px;">Pending (${pending.length})</h4>
            ${pending.length === 0
              ? `<p style="font-size:0.85rem; color:var(--success);">All workers have responded.</p>`
              : pending.map(w => `
                  <div class="pending-item">
                    <div class="pending-dot"></div>
                    <div>
                      <div class="pending-name">${w.name}</div>
                      <div class="pending-email">${w.email}</div>
                    </div>
                  </div>`).join('')}
          </div>
        </div>
      </div>`;
  }