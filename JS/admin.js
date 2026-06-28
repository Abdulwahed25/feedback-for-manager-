/* =============================================
   admin.js
   Admin pages — connected to PHP backend
   ============================================= */

// ---- DASHBOARD ----

async function initDashboard() {
    const user = await requireAdmin();
    if (!user) return;
  
    setNavbar(user);
    document.getElementById('welcome-msg').textContent = greet(user);
  
    try {
      const res = await apiGet('/tasks/get_tasks.php');
  
      if (!res.success) {
        showAlert('dashboard-alert', res.message || 'Could not load tasks.');
        return;
      }
  
      const tasks       = res.data.tasks;
      const workerCount = res.data.worker_count;
  
      const activeTasks    = tasks.filter(t => t.status === 'active');
      const totalResponses = tasks.reduce((sum, t) => sum + parseInt(t.response_count || 0), 0);
      const expectedTotal  = activeTasks.length * workerCount;
      const rate = expectedTotal > 0
        ? Math.round((totalResponses / expectedTotal) * 100) + '%'
        : '--';
  
      document.getElementById('stat-active').textContent    = activeTasks.length;
      document.getElementById('stat-responses').textContent = totalResponses;
      document.getElementById('stat-rate').textContent      = rate;
      document.getElementById('stat-workers').textContent   = workerCount;
  
      renderTaskList(tasks, workerCount);
      renderLatestLink(tasks);
  
    } catch (e) {
      showAlert('dashboard-alert', 'Could not connect to the server.');
    }
  }
  
  function renderTaskList(tasks, workerCount) {
    const listEl = document.getElementById('task-list');
    listEl.innerHTML = '';
  
    if (tasks.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h4>No tasks yet</h4>
          <p>Create your first task to start collecting feedback.</p>
          <a href="admin-create-task.html" class="btn btn-primary btn-sm" style="margin-top:8px;">Create Task</a>
        </div>`;
      return;
    }
  
    [...tasks].slice(0, 6).forEach(task => {
      const count     = parseInt(task.response_count || 0);
      const pct       = workerCount > 0 ? Math.round((count / workerCount) * 100) : 0;
      const fillClass = pct >= 80 ? 'success' : pct >= 40 ? '' : 'warning';
  
      const a = document.createElement('a');
      a.className = 'task-item';
      a.href = `admin-task-detail.html?id=${encodeURIComponent(task.id)}`;
  
      const icon = document.createElement('div');
      icon.className = 'task-icon';
  
      const info = document.createElement('div');
      info.className = 'task-info';
  
      const title = document.createElement('div');
      title.className = 'task-title';
      title.textContent = task.title;
  
      const meta = document.createElement('div');
      meta.className = 'task-meta';
  
      const dateSpan = document.createElement('span');
      dateSpan.textContent = formatDate(task.created_at);
  
      const countSpan = document.createElement('span');
      countSpan.textContent = `${count} / ${workerCount} responded`;
  
      const badge = document.createElement('span');
      badge.className = `badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}`;
      badge.textContent = task.status;
  
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
    const latest = tasks[0]; // already sorted DESC from server
    const link   = buildFeedbackLink(latest.id);
    document.getElementById('copy-url').textContent = link;
    document.getElementById('copy-btn').style.display = 'inline-flex';
  }
  
  function copyDashboardLink() {
    const url = document.getElementById('copy-url').textContent;
    const btn = document.getElementById('copy-btn');
    copyToClipboard(url, btn, 'Copy');
  }
  
  
  // ---- CREATE TASK ----
  
  let fields = [];
  const ALLOWED_FIELD_TYPES = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
  
  const fieldTypeLabels = {
    text:     'Short Text',
    textarea: 'Long Text',
    rating:   'Rating 1 to 5',
    select:   'Dropdown',
    checkbox: 'Checkbox',
    yesno:    'Yes / No'
  };
  
  async function initCreateTask() {
    const user = await requireAdmin();
    if (!user) return;
    setNavbar(user);
  
    fields = [
      { id: generateId('f'), type: 'textarea', label: 'What is your understanding of this task?', required: true  },
      { id: generateId('f'), type: 'rating',   label: 'How clear was the information provided?',  required: true  },
      { id: generateId('f'), type: 'text',     label: 'Any questions or concerns?',               required: false }
    ];
  
    renderFields();
  }
  
  function addField(type) {
    if (!ALLOWED_FIELD_TYPES.includes(type)) return;
    fields.push({ id: generateId('f'), type, label: fieldTypeLabels[type] + ' Question', required: false });
    renderFields();
  }
  
  function deleteField(id) {
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
    if (f) { f.label = sanitizeText(val, VALIDATION.MAX_LABEL_LENGTH); updatePreview(); }
  }
  
  function renderFields() {
    const list  = document.getElementById('fields-list');
    const empty = document.getElementById('fields-empty');
    if (empty) empty.style.display = fields.length ? 'none' : 'block';
  
    list.querySelectorAll('.field-item').forEach(el => el.remove());
  
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
      labelInput.addEventListener('change', (function(fid) {
        return function() { updateFieldLabel(fid, this.value); };
      })(f.id));
  
      const typeTag = document.createElement('div');
      typeTag.className = 'field-type-tag';
      typeTag.textContent = fieldTypeLabels[f.type] || '';
  
      info.appendChild(labelInput);
      info.appendChild(typeTag);
  
      const reqBtn = document.createElement('button');
      reqBtn.className = `field-required-toggle ${f.required ? 'on' : ''}`;
      reqBtn.textContent = f.required ? 'Required' : 'Optional';
      reqBtn.addEventListener('click', (function(fid) {
        return function() { toggleRequired(fid); };
      })(f.id));
  
      const delBtn = document.createElement('button');
      delBtn.className = 'field-delete';
      delBtn.textContent = 'Remove';
      delBtn.addEventListener('click', (function(fid) {
        return function() { deleteField(fid); };
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
  
    if (titleEl) titleEl.textContent = document.getElementById('task-title')?.value || 'Task title will appear here';
    if (descEl)  descEl.textContent  = document.getElementById('task-desc')?.value  || 'Description will appear here';
  
    if (!fieldsEl) return;
    if (fields.length === 0) {
      fieldsEl.innerHTML = `<p style="color:var(--grey-300); font-size:0.82rem; text-align:center; padding:20px 0;">Add fields to see preview</p>`;
      return;
    }
  
    fieldsEl.innerHTML = '';
    fields.forEach(f => {
      const fieldDiv  = document.createElement('div');
      fieldDiv.className = 'preview-field';
  
      const labelDiv = document.createElement('div');
      labelDiv.className = 'preview-label';
      labelDiv.textContent = f.label;
      if (f.required) {
        const req = document.createElement('span');
        req.className = 'req';
        req.textContent = ' *';
        labelDiv.appendChild(req);
      }
      fieldDiv.appendChild(labelDiv);
  
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
        cb.type = 'checkbox'; cb.disabled = true;
        inputEl.appendChild(cb);
        inputEl.append(' I confirm');
      } else if (f.type === 'yesno') {
        inputEl = document.createElement('div');
        inputEl.className = 'preview-yesno';
        ['Yes','No'].forEach(v => {
          const b = document.createElement('button');
          b.disabled = true; b.textContent = v;
          inputEl.appendChild(b);
        });
      }
  
      if (inputEl) fieldDiv.appendChild(inputEl);
      fieldsEl.appendChild(fieldDiv);
    });
  }
  
  async function createTask() {
    const btn   = document.getElementById('create-task-btn');
    const title = sanitizeText(document.getElementById('task-title').value, VALIDATION.MAX_TITLE_LENGTH);
    const desc  = sanitizeText(document.getElementById('task-desc').value,  VALIDATION.MAX_DESC_LENGTH);
  
    if (!title || title.length < 3) { showAlert('task-alert', 'Please enter a valid task title.'); return; }
    if (fields.length === 0)        { showAlert('task-alert', 'Please add at least one field.');   return; }
  
    for (const f of fields) {
      if (!ALLOWED_FIELD_TYPES.includes(f.type)) { showAlert('task-alert', 'Invalid field type.'); return; }
      if (!f.label || f.label.trim().length === 0) { showAlert('task-alert', 'All fields must have a label.'); return; }
    }
  
    if (btn) btn.disabled = true;
  
    try {
      const res = await apiPost('/tasks/create.php', {
        title,
        description: desc,
        fields: fields.map((f, i) => ({
          type:     f.type,
          label:    sanitizeText(f.label, VALIDATION.MAX_LABEL_LENGTH),
          required: Boolean(f.required),
          order:    i,
        })),
      });
  
      if (!res.success) {
        showAlert('task-alert', res.message || 'Could not create task.');
        if (btn) btn.disabled = false;
        return;
      }
  
      const link    = buildFeedbackLink(res.data.task_id);
      const linkEl  = document.getElementById('generated-link');
      const resultEl = document.getElementById('link-result');
      if (linkEl)   linkEl.textContent = link;
      if (resultEl) { resultEl.style.display = 'block'; resultEl.scrollIntoView({ behavior: 'smooth' }); }
  
    } catch (e) {
      showAlert('task-alert', 'Could not connect to the server.');
      if (btn) btn.disabled = false;
    }
  }
  
  function copyGeneratedLink() {
    const link = document.getElementById('generated-link').textContent;
    copyToClipboard(link, document.getElementById('copy-generated-btn'), 'Copy Link');
  }
  
  
  // ---- TASK DETAIL / HISTORY ----
  
  async function initTaskDetail() {
    const user = await requireAdmin();
    if (!user) return;
    setNavbar(user);
  
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('id');
  
    if (!taskId || typeof taskId !== 'string' || taskId.length > 20) {
      await renderHistory();
      return;
    }
  
    await renderDetail(taskId);
  }
  
  async function renderHistory() {
    document.title = 'History - Sales Department';
    const content  = document.getElementById('page-content');
    content.innerHTML = '<p style="color:var(--grey-400); padding:20px;">Loading...</p>';
  
    try {
      const res = await apiGet('/tasks/get_tasks.php');
      if (!res.success) { content.innerHTML = `<p>${escapeHTML(res.message)}</p>`; return; }
  
      const tasks       = res.data.tasks;
      const workerCount = res.data.worker_count;
  
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
  
      content.innerHTML = `
        <div class="page-header"><h2>History</h2><p>All feedback tasks and their responses.</p></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Task</th><th>Created</th><th>Responses</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody id="history-tbody"></tbody>
          </table>
        </div>`;
  
      const tbody = document.getElementById('history-tbody');
  
      tasks.forEach(task => {
        const count  = parseInt(task.response_count || 0);
        const pct    = workerCount > 0 ? Math.round((count / workerCount) * 100) : 0;
        const safeId = encodeURIComponent(task.id);
  
        const tr = document.createElement('tr');
  
        const tdTitle = document.createElement('td');
        const link    = document.createElement('a');
        link.href = `admin-task-detail.html?id=${safeId}`;
        link.style.cssText = 'font-weight:600; color:var(--purple-600);';
        link.textContent = task.title;
        tdTitle.appendChild(link);
  
        const tdDate  = document.createElement('td');
        tdDate.textContent = formatDate(task.created_at);
  
        const tdCount = document.createElement('td');
        tdCount.textContent = `${count} / ${workerCount}`;
  
        const tdRate  = document.createElement('td');
        const wrap    = document.createElement('div');
        wrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
        const bar = document.createElement('div');
        bar.className = 'progress-bar'; bar.style.width = '80px';
        const barFill = document.createElement('div');
        barFill.className = `progress-fill ${pct >= 80 ? 'success' : ''}`;
        barFill.style.width = `${pct}%`;
        bar.appendChild(barFill);
        const pctSpan = document.createElement('span');
        pctSpan.style.cssText = 'font-size:0.82rem; color:var(--grey-400);';
        pctSpan.textContent = `${pct}%`;
        wrap.appendChild(bar); wrap.appendChild(pctSpan);
        tdRate.appendChild(wrap);
  
        const tdStatus = document.createElement('td');
        const badge    = document.createElement('span');
        badge.className = `badge ${task.status === 'active' ? 'badge-success' : 'badge-grey'}`;
        badge.textContent = task.status;
        tdStatus.appendChild(badge);
  
        const tdAction = document.createElement('td');
        const viewLink = document.createElement('a');
        viewLink.href = `admin-task-detail.html?id=${safeId}`;
        viewLink.className = 'btn btn-outline btn-sm';
        viewLink.textContent = 'View';
        tdAction.appendChild(viewLink);
  
        tr.appendChild(tdTitle); tr.appendChild(tdDate); tr.appendChild(tdCount);
        tr.appendChild(tdRate);  tr.appendChild(tdStatus); tr.appendChild(tdAction);
        tbody.appendChild(tr);
      });
  
    } catch (e) {
      content.innerHTML = '<p>Could not connect to the server.</p>';
    }
  }
  
  async function renderDetail(taskId) {
    const content = document.getElementById('page-content');
    content.innerHTML = '<p style="color:var(--grey-400); padding:20px;">Loading...</p>';
  
    try {
      const res = await apiGet(`/tasks/get_task_detail.php?id=${encodeURIComponent(taskId)}`);
  
      if (!res.success) {
        content.innerHTML = `<div class="empty-state"><h3>Task not found</h3></div>`;
        return;
      }
  
      const { task, fields, submissions, workers } = res.data;
      const pending     = workers.filter(w => !w.has_responded);
      const pct         = workers.length > 0 ? Math.round((submissions.length / workers.length) * 100) : 0;
      const link        = buildFeedbackLink(task.id);
  
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
            <span class="stat-value">${submissions.length}</span>
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
        ${task.status === 'active' ? `
        <div style="margin-bottom:24px;">
          <button class="btn btn-danger btn-sm" id="close-task-btn">Close Task</button>
        </div>` : ''}
        <div class="detail-two-col">
          <div>
            <h3 style="margin-bottom:16px;">Responses (${submissions.length})</h3>
            <div id="responses-container"></div>
          </div>
          <div>
            <div class="card">
              <h4 style="margin-bottom:12px;">Pending (${pending.length})</h4>
              <div id="pending-container"></div>
            </div>
          </div>
        </div>`;
  
      // Fill user data safely
      document.getElementById('detail-title').textContent = task.title;
      document.getElementById('detail-desc').textContent  = task.description || 'No description provided.';
      document.getElementById('detail-link').textContent  = link;
  
      const metaEl = document.getElementById('detail-meta');
      [`Created ${formatDate(task.created_at)}`, `${submissions.length} / ${workers.length} responded`, `${pct}% response rate`].forEach(text => {
        const span = document.createElement('span');
        span.textContent = text;
        metaEl.appendChild(span);
      });
  
      document.getElementById('copy-link-btn').addEventListener('click', function() {
        copyToClipboard(link, this, 'Copy Link');
      });
  
      // Close task button
      const closeBtn = document.getElementById('close-task-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', async function() {
          if (!confirm('Are you sure you want to close this task? Workers will no longer be able to submit feedback.')) return;
          this.disabled = true;
          const closeRes = await apiPost('/tasks/close_task.php', { task_id: task.id });
          if (closeRes.success) {
            window.location.reload();
          } else {
            showAlert('page-content', closeRes.message || 'Could not close task.');
            this.disabled = false;
          }
        });
      }
  
      // Responses
      const responsesEl = document.getElementById('responses-container');
      if (submissions.length === 0) {
        responsesEl.innerHTML = `<div class="empty-state card"><h4>No responses yet</h4><p>Share the task link with your team.</p></div>`;
      } else {
        submissions.forEach(sub => {
          const card   = document.createElement('div');
          card.className = 'response-card';
  
          const header = document.createElement('div');
          header.className = 'response-header';
  
          const avatar = document.createElement('div');
          avatar.className = 'response-avatar';
          avatar.textContent = sub.worker_name ? sub.worker_name.charAt(0).toUpperCase() : '?';
  
          const nameBlock = document.createElement('div');
          const name = document.createElement('div');
          name.className = 'response-name';
          name.textContent = sub.worker_name;
  
          const timeLine = document.createElement('div');
          timeLine.className = 'response-time';
          timeLine.textContent = `${sub.worker_email} · ${formatDateTime(sub.submitted_at)}`;
  
          nameBlock.appendChild(name);
          nameBlock.appendChild(timeLine);
  
          const badge = document.createElement('span');
          badge.className = 'badge badge-success';
          badge.style.marginLeft = 'auto';
          badge.textContent = 'Submitted';
  
          header.appendChild(avatar);
          header.appendChild(nameBlock);
          header.appendChild(badge);
          card.appendChild(header);
  
          // Match answers to field labels
          (sub.answers || []).forEach(ans => {
            const row  = document.createElement('div');
            row.className = 'answer-row';
            const qEl  = document.createElement('div');
            qEl.className = 'answer-q';
            qEl.textContent = ans.question || ans.field_id;
            const aEl  = document.createElement('div');
            aEl.className = 'answer-a';
            aEl.textContent = ans.answer || '--';
            row.appendChild(qEl);
            row.appendChild(aEl);
            card.appendChild(row);
          });
  
          responsesEl.appendChild(card);
        });
      }
  
      // Pending
      const pendingEl = document.getElementById('pending-container');
      if (pending.length === 0) {
        const p = document.createElement('p');
        p.style.cssText = 'font-size:0.85rem; color:var(--success);';
        p.textContent = 'All workers have responded.';
        pendingEl.appendChild(p);
      } else {
        pending.forEach(w => {
          const item  = document.createElement('div');
          item.className = 'pending-item';
  
          const dot   = document.createElement('div');
          dot.className = 'pending-dot';
  
          const info  = document.createElement('div');
          info.style.flex = '1';
          const wName = document.createElement('div');
          wName.className = 'pending-name';
          wName.textContent = w.name;
          const wEmail = document.createElement('div');
          wEmail.className = 'pending-email';
          wEmail.textContent = w.email;
          info.appendChild(wName);
          info.appendChild(wEmail);
  
          const reminderBtn = document.createElement('button');
          reminderBtn.className = 'btn btn-outline btn-sm';
          reminderBtn.textContent = 'Send Reminder';
          reminderBtn.style.flexShrink = '0';
          reminderBtn.addEventListener('click', (function(tId, wId, btn) {
            return async function() {
              btn.disabled = true;
              btn.textContent = 'Sending...';
              try {
                const res = await apiPost('/feedback/send_reminder.php', { task_id: tId, worker_id: wId });
                if (res.success) {
                  btn.textContent = 'Sent';
                  btn.style.color = 'var(--success)';
                  btn.style.borderColor = 'var(--success)';
                } else {
                  btn.textContent = res.message || 'Failed';
                  btn.disabled = false;
                }
              } catch(e) {
                btn.textContent = 'Error';
                btn.disabled = false;
              }
            };
          })(task.id, w.id, reminderBtn));
  
          item.appendChild(dot);
          item.appendChild(info);
          item.appendChild(reminderBtn);
          pendingEl.appendChild(item);
        });
      }
  
    } catch (e) {
      content.innerHTML = '<p>Could not connect to the server.</p>';
    }
  }