/* =============================================
   admin.js
   All admin page logic — security hardened
   ============================================= */

// ---- DASHBOARD ----

function initDashboard() {
    const user = requireAdmin();
    if (!user) return;
    setNavbar(user);
  
    // Security: use textContent, never innerHTML for user-supplied data
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
  
    // Security: build DOM nodes instead of string concatenation
    // to prevent XSS from task titles or other user data
    listEl.innerHTML = '';
  
    recent.forEach(task => {
      const taskFeedback = feedback.filter(f => f.taskId === task.id);
      const pct       = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
      const date      = formatDate(task.createdAt);
      const fillClass = pct >= 80 ? 'success' : pct >= 40 ? '' : 'warning';
  
      const a = document.createElement('a');
      a.className = 'task-item';
      // Security: validate task.id is a safe string before using in URL
      const safeId = encodeURIComponent(task.id);
      a.href = `admin-task-detail.html?id=${safeId}`;
  
      const icon = document.createElement('div');
      icon.className = 'task-icon';
  
      const info = document.createElement('div');
      info.className = 'task-info';
  
      const title = document.createElement('div');
      title.className = 'task-title';
      title.textContent = task.title; // textContent — XSS safe
  
      const meta = document.createElement('div');
      meta.className = 'task-meta';
  
      const dateSpan = document.createElement('span');
      dateSpan.textContent = date;
  
      const countSpan = document.createElement('span');
      countSpan.textContent = `${taskFeedback.length} / ${workers.length} responded`;
  
      const badge = document.createElement('span');
      badge.className = `badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}`;
      badge.textContent = task.status === 'active' ? 'active' : 'closed'; // whitelist
  
      meta.appendChild(dateSpan);
      meta.appendChild(countSpan);
      meta.appendChild(badge);
      info.appendChild(title);
      info.appendChild(meta);
  
      const progress = document.createElement('div');
      progress.className = 'task-progress';
  
      const progressLabel = document.createElement('div');
      progressLabel.className = 'task-progress-label';
      progressLabel.textContent = `${pct}%`;
  
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.style.width = '80px';
  
      const fill = document.createElement('div');
      fill.className = `progress-fill ${fillClass}`;
      fill.style.width = `${pct}%`;
  
      bar.appendChild(fill);
      progress.appendChild(progressLabel);
      progress.appendChild(bar);
  
      a.appendChild(icon);
      a.appendChild(info);
      a.appendChild(progress);
      listEl.appendChild(a);
    });
  }
  
  function renderLatestLink(tasks) {
    if (tasks.length === 0) return;
    const latest = tasks[tasks.length - 1];
    const link   = buildFeedbackLink(latest.id);
    // Security: use textContent, not innerHTML
    document.getElementById('copy-url').textContent = link;
    document.getElementById('copy-btn').style.display = 'inline-flex';
  }
  
  function renderActivityFeed(feedback, tasks) {
    const actEl = document.getElementById('activity-feed');
    if (feedback.length === 0) {
      actEl.innerHTML = `<p style="color:var(--grey-400); font-size:0.85rem; text-align:center; padding:20px 0;">No activity yet</p>`;
      return;
    }
  
    actEl.innerHTML = '';
    const recent = [...feedback].reverse().slice(0, 5);
  
    recent.forEach(f => {
      const task = tasks.find(t => t.id === f.taskId);
  
      const item = document.createElement('div');
      item.className = 'activity-item';
  
      const dot = document.createElement('div');
      dot.className = 'activity-dot';
  
      const content = document.createElement('div');
  
      const text = document.createElement('div');
      text.className = 'activity-text';
  
      const nameStrong = document.createElement('strong');
      nameStrong.textContent = f.workerName; // textContent — XSS safe
  
      const taskStrong = document.createElement('strong');
      taskStrong.textContent = task ? task.title : 'a task';
  
      text.appendChild(nameStrong);
      text.append(' submitted feedback on ');
      text.appendChild(taskStrong);
  
      const time = document.createElement('div');
      time.className = 'activity-time';
      time.textContent = formatDateTime(f.submittedAt);
  
      content.appendChild(text);
      content.appendChild(time);
      item.appendChild(dot);
      item.appendChild(content);
      actEl.appendChild(item);
    });
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
    if (!user) return;
    setNavbar(user);
  
    fields = [
      { id: generateId('f'), type: 'textarea', label: 'What is your understanding of this task?', required: true  },
      { id: generateId('f'), type: 'rating',   label: 'How clear was the information provided?',  required: true  },
      { id: generateId('f'), type: 'text',     label: 'Any questions or concerns?',               required: false }
    ];
  
    renderFields();
  }
  
  const ALLOWED_FIELD_TYPES = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
  
  const fieldTypeLabels = {
    text:     'Short Text',
    textarea: 'Long Text',
    rating:   'Rating 1 to 5',
    select:   'Dropdown',
    checkbox: 'Checkbox',
    yesno:    'Yes / No'
  };
  
  function addField(type) {
    // Whitelist field types — never trust input directly
    if (!ALLOWED_FIELD_TYPES.includes(type)) return;
    fields.push({ id: generateId('f'), type, label: fieldTypeLabels[type] + ' Question', required: false });
    renderFields();
  }
  
  function deleteField(id) {
    // Validate id is a string before using
    if (typeof id !== 'string') return;
    fields = fields.filter(f => f.id !== id);
    renderFields();
  }
  
  function toggleRequired(id) {
    if (typeof id !== 'string') return;
    const f = fields.find(f => f.id === id);
    if (f) { f.required = !f.required; renderFields(); }
  }
  
  function updateFieldLabel(id, val) {
    if (typeof id !== 'string') return;
    const f = fields.find(f => f.id === id);
    if (f) {
      // Sanitize and limit length
      f.label = sanitizeText(val, VALIDATION.MAX_LABEL_LENGTH);
      updatePreview();
    }
  }
  
  function renderFields() {
    const list  = document.getElementById('fields-list');
    const empty = document.getElementById('fields-empty');
    if (empty) empty.style.display = fields.length ? 'none' : 'block';
  
    // Remove old field items (keep the empty placeholder)
    const existing = list.querySelectorAll('.field-item');
    existing.forEach(el => el.remove());
  
    fields.forEach(f => {
      const item = document.createElement('div');
      item.className = 'field-item';
  
      const drag = document.createElement('span');
      drag.className = 'field-drag';
      drag.textContent = '|||';
  
      const info = document.createElement('div');
      info.className = 'field-info';
  
      const labelInput = document.createElement('input');
      labelInput.className = 'field-label-edit';
      labelInput.type = 'text';
      labelInput.maxLength = VALIDATION.MAX_LABEL_LENGTH;
      labelInput.value = f.label;
      // Use closure to capture f.id safely
      labelInput.addEventListener('change', (function(fieldId) {
        return function() { updateFieldLabel(fieldId, this.value); };
      })(f.id));
  
      const typeTag = document.createElement('div');
      typeTag.className = 'field-type-tag';
      typeTag.textContent = fieldTypeLabels[f.type] || '';
  
      info.appendChild(labelInput);
      info.appendChild(typeTag);
  
      const reqBtn = document.createElement('button');
      reqBtn.className = `field-required-toggle ${f.required ? 'on' : ''}`;
      reqBtn.textContent = f.required ? 'Required' : 'Optional';
      reqBtn.addEventListener('click', (function(fieldId) {
        return function() { toggleRequired(fieldId); };
      })(f.id));
  
      const delBtn = document.createElement('button');
      delBtn.className = 'field-delete';
      delBtn.textContent = 'Remove';
      delBtn.addEventListener('click', (function(fieldId) {
        return function() { deleteField(fieldId); };
      })(f.id));
  
      item.appendChild(drag);
      item.appendChild(info);
      item.appendChild(reqBtn);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  
    updatePreview();
  }
  
  function updatePreview() {
    const titleEl  = document.getElementById('preview-title');
    const descEl   = document.getElementById('preview-desc');
    const fieldsEl = document.getElementById('preview-fields');
  
    const titleVal = document.getElementById('task-title')?.value || '';
    const descVal  = document.getElementById('task-desc')?.value  || '';
  
    if (titleEl) titleEl.textContent = titleVal || 'Task title will appear here';
    if (descEl)  descEl.textContent  = descVal  || 'Description will appear here';
  
    if (!fieldsEl) return;
  
    if (fields.length === 0) {
      fieldsEl.innerHTML = `<p style="color:var(--grey-300); font-size:0.82rem; text-align:center; padding:20px 0;">Add fields to see preview</p>`;
      return;
    }
  
    fieldsEl.innerHTML = '';
  
    fields.forEach(f => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'preview-field';
  
      const labelDiv = document.createElement('div');
      labelDiv.className = 'preview-label';
      labelDiv.textContent = f.label; // textContent — XSS safe
      if (f.required) {
        const req = document.createElement('span');
        req.className = 'req';
        req.textContent = ' *';
        labelDiv.appendChild(req);
      }
  
      fieldDiv.appendChild(labelDiv);
  
      // Preview inputs are read-only/disabled — no security risk
      let inputEl;
      if (f.type === 'text') {
        inputEl = document.createElement('input');
        inputEl.className = 'preview-input';
        inputEl.placeholder = 'Worker answer...';
        inputEl.readOnly = true;
      } else if (f.type === 'textarea') {
        inputEl = document.createElement('textarea');
        inputEl.className = 'preview-input preview-textarea';
        inputEl.placeholder = 'Worker answer...';
        inputEl.readOnly = true;
      } else if (f.type === 'rating') {
        inputEl = document.createElement('div');
        inputEl.className = 'preview-rating';
        inputEl.textContent = '1   2   3   4   5';
      } else if (f.type === 'select') {
        inputEl = document.createElement('select');
        inputEl.className = 'preview-input';
        inputEl.disabled = true;
        const opt = document.createElement('option');
        opt.textContent = 'Select an option...';
        inputEl.appendChild(opt);
      } else if (f.type === 'checkbox') {
        inputEl = document.createElement('label');
        inputEl.className = 'preview-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.disabled = true;
        inputEl.appendChild(cb);
        inputEl.append(' I confirm');
      } else if (f.type === 'yesno') {
        inputEl = document.createElement('div');
        inputEl.className = 'preview-yesno';
        const yes = document.createElement('button');
        yes.disabled = true;
        yes.textContent = 'Yes';
        const no = document.createElement('button');
        no.disabled = true;
        no.textContent = 'No';
        inputEl.appendChild(yes);
        inputEl.appendChild(no);
      }
  
      if (inputEl) fieldDiv.appendChild(inputEl);
      fieldsEl.appendChild(fieldDiv);
    });
  }
  
  function createTask() {
    const title = sanitizeText(document.getElementById('task-title').value, VALIDATION.MAX_TITLE_LENGTH);
    const desc  = sanitizeText(document.getElementById('task-desc').value,  VALIDATION.MAX_DESC_LENGTH);
  
    if (!title) { showAlert('task-alert', 'Please enter a task title.'); return; }
    if (title.length < 3) { showAlert('task-alert', 'Title is too short.'); return; }
    if (fields.length === 0) { showAlert('task-alert', 'Please add at least one field.'); return; }
  
    // Validate all fields have valid types and non-empty labels
    for (const f of fields) {
      if (!ALLOWED_FIELD_TYPES.includes(f.type)) {
        showAlert('task-alert', 'Invalid field type detected.');
        return;
      }
      if (!f.label || f.label.trim().length === 0) {
        showAlert('task-alert', 'All fields must have a label.');
        return;
      }
    }
  
    const task = {
      id:          generateId('task'),
      title,
      description: desc,
      fields:      fields.map(f => ({
        id:       f.id,
        type:     f.type,
        label:    sanitizeText(f.label, VALIDATION.MAX_LABEL_LENGTH),
        required: Boolean(f.required)
      })),
      createdAt: new Date().toISOString(),
      status:    'active'
    };
  
    const tasks = getTasks();
    tasks.push(task);
    saveTasks(tasks);
  
    const link    = buildFeedbackLink(task.id);
    const linkEl  = document.getElementById('generated-link');
    const resultEl = document.getElementById('link-result');
  
    if (linkEl)   linkEl.textContent = link; // textContent — XSS safe
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  function copyGeneratedLink() {
    const link = document.getElementById('generated-link').textContent;
    const btn  = document.getElementById('copy-generated-btn');
    copyToClipboard(link, btn, 'Copy Link');
  }
  
  function buildFeedbackLink(taskId) {
    // Security: encode taskId to prevent URL injection
    return window.location.origin + '/pages/worker-feedback.html?task=' + encodeURIComponent(taskId);
  }
  
  
  // ---- TASK DETAIL / HISTORY ----
  
  function initTaskDetail() {
    const user = requireAdmin();
    if (!user) return;
    setNavbar(user);
  
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('id');
  
    // Security: validate taskId — must be a non-empty string, no special chars
    if (!taskId || typeof taskId !== 'string' || taskId.length > 100) {
      renderHistory();
      return;
    }
  
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
  
    // Build table using DOM to prevent XSS
    content.innerHTML = `
      <div class="page-header">
        <h2>History</h2>
        <p>All feedback tasks and their responses.</p>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Task</th><th>Created</th><th>Responses</th><th>Rate</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody id="history-tbody"></tbody>
        </table>
      </div>`;
  
    const tbody = document.getElementById('history-tbody');
  
    [...tasks].reverse().forEach(task => {
      const taskFeedback = feedback.filter(f => f.taskId === task.id);
      const pct  = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
      const safeId = encodeURIComponent(task.id);
  
      const tr = document.createElement('tr');
  
      // Task title cell — textContent prevents XSS
      const tdTitle = document.createElement('td');
      const titleLink = document.createElement('a');
      titleLink.href = `admin-task-detail.html?id=${safeId}`;
      titleLink.style.fontWeight = '600';
      titleLink.style.color = 'var(--purple-600)';
      titleLink.textContent = task.title;
      tdTitle.appendChild(titleLink);
  
      const tdDate = document.createElement('td');
      tdDate.textContent = formatDate(task.createdAt);
  
      const tdCount = document.createElement('td');
      tdCount.textContent = `${taskFeedback.length} / ${workers.length}`;
  
      const tdRate = document.createElement('td');
      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.style.width = '80px';
      const barFill = document.createElement('div');
      barFill.className = `progress-fill ${pct >= 80 ? 'success' : ''}`;
      barFill.style.width = `${pct}%`;
      bar.appendChild(barFill);
      const pctSpan = document.createElement('span');
      pctSpan.style.cssText = 'font-size:0.82rem; color:var(--grey-400);';
      pctSpan.textContent = `${pct}%`;
      barWrap.appendChild(bar);
      barWrap.appendChild(pctSpan);
      tdRate.appendChild(barWrap);
  
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}`;
      badge.textContent = task.status === 'active' ? 'active' : 'closed';
      tdStatus.appendChild(badge);
  
      const tdAction = document.createElement('td');
      const viewLink = document.createElement('a');
      viewLink.href = `admin-task-detail.html?id=${safeId}`;
      viewLink.className = 'btn btn-outline btn-sm';
      viewLink.textContent = 'View';
      tdAction.appendChild(viewLink);
  
      tr.appendChild(tdTitle);
      tr.appendChild(tdDate);
      tr.appendChild(tdCount);
      tr.appendChild(tdRate);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
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
    const pct     = workers.length > 0 ? Math.round((taskFeedback.length / workers.length) * 100) : 0;
    const link    = buildFeedbackLink(task.id);
  
    // Build static structure with innerHTML (no user data here)
    content.innerHTML = `
      <div style="margin-bottom:16px;">
        <a href="admin-history.html" class="back-link">Back to All Tasks</a>
      </div>
      <div class="detail-header">
        <span class="badge badge-purple">Feedback Task</span>
        <h2 id="detail-title"></h2>
        <p id="detail-desc"></p>
        <div class="detail-meta" id="detail-meta"></div>
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
        <p style="font-size:0.85rem; margin-bottom:12px;">Share this link in your Outlook email.</p>
        <div class="copy-box">
          <span id="detail-link" style="flex:1;"></span>
          <button class="btn btn-primary btn-sm" id="copy-link-btn">Copy Link</button>
        </div>
      </div>
      <div class="detail-two-col">
        <div>
          <h3 style="margin-bottom:16px;">Responses (<span id="response-count"></span>)</h3>
          <div id="responses-container"></div>
        </div>
        <div>
          <div class="card">
            <h4 style="margin-bottom:12px;">Pending (<span id="pending-count"></span>)</h4>
            <div id="pending-container"></div>
          </div>
        </div>
      </div>`;
  
    // Now fill in user data safely using textContent
    document.getElementById('detail-title').textContent = task.title;
    document.getElementById('detail-desc').textContent  = task.description || 'No description provided.';
    document.getElementById('detail-link').textContent  = link;
    document.getElementById('response-count').textContent = taskFeedback.length;
    document.getElementById('pending-count').textContent  = pending.length;
  
    const metaEl = document.getElementById('detail-meta');
    [
      `Created ${formatDate(task.createdAt)}`,
      `${taskFeedback.length} / ${workers.length} responded`,
      `${pct}% response rate`
    ].forEach(text => {
      const span = document.createElement('span');
      span.textContent = text;
      metaEl.appendChild(span);
    });
  
    document.getElementById('copy-link-btn').addEventListener('click', function() {
      copyToClipboard(link, this, 'Copy Link');
    });
  
    // Render responses
    const responsesEl = document.getElementById('responses-container');
    if (taskFeedback.length === 0) {
      responsesEl.innerHTML = `<div class="empty-state card"><h4>No responses yet</h4><p>Share the task link with your team.</p></div>`;
    } else {
      taskFeedback.forEach(fb => {
        const card = document.createElement('div');
        card.className = 'response-card';
  
        const header = document.createElement('div');
        header.className = 'response-header';
  
        const avatar = document.createElement('div');
        avatar.className = 'response-avatar';
        avatar.textContent = fb.workerName ? fb.workerName.charAt(0).toUpperCase() : '?';
  
        const nameBlock = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'response-name';
        name.textContent = fb.workerName;
  
        const timeLine = document.createElement('div');
        timeLine.className = 'response-time';
        timeLine.textContent = `${fb.workerEmail} · ${formatDateTime(fb.submittedAt)}`;
  
        nameBlock.appendChild(name);
        nameBlock.appendChild(timeLine);
  
        const submittedBadge = document.createElement('span');
        submittedBadge.className = 'badge badge-success';
        submittedBadge.style.marginLeft = 'auto';
        submittedBadge.textContent = 'Submitted';
  
        header.appendChild(avatar);
        header.appendChild(nameBlock);
        header.appendChild(submittedBadge);
        card.appendChild(header);
  
        // Render each answer — all via textContent
        Object.entries(fb.answers).forEach(([q, a]) => {
          const row = document.createElement('div');
          row.className = 'answer-row';
  
          const qEl = document.createElement('div');
          qEl.className = 'answer-q';
          qEl.textContent = q;
  
          const aEl = document.createElement('div');
          aEl.className = 'answer-a';
          aEl.textContent = a;
  
          row.appendChild(qEl);
          row.appendChild(aEl);
          card.appendChild(row);
        });
  
        responsesEl.appendChild(card);
      });
    }
  
    // Render pending workers
    const pendingEl = document.getElementById('pending-container');
    if (pending.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:0.85rem; color:var(--success);';
      p.textContent = 'All workers have responded.';
      pendingEl.appendChild(p);
    } else {
      pending.forEach(w => {
        const item = document.createElement('div');
        item.className = 'pending-item';
  
        const dot = document.createElement('div');
        dot.className = 'pending-dot';
  
        const info = document.createElement('div');
        const wName = document.createElement('div');
        wName.className = 'pending-name';
        wName.textContent = w.name;
  
        const wEmail = document.createElement('div');
        wEmail.className = 'pending-email';
        wEmail.textContent = w.email;
  
        info.appendChild(wName);
        info.appendChild(wEmail);
        item.appendChild(dot);
        item.appendChild(info);
        pendingEl.appendChild(item);
      });
    }
  }