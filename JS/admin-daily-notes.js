/* =============================================
   admin-daily-notes.js
   Admin daily notes page
   ============================================= */

   async function initAdminDailyNotes() {
    const user = await requireAdmin();
    if (!user) return;
    setNavbar(user);
  
    // Set today's date in picker
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-picker').value = today;
  
    await loadNotes(today);
  }
  
  async function loadNotes(date) {
    const container = document.getElementById('notes-container');
    container.innerHTML = '<p style="color:var(--grey-400);">Loading...</p>';
  
    try {
      const res = await apiGet(`/daily/get_all_notes.php?date=${encodeURIComponent(date)}`);
      if (!res.success) { container.innerHTML = `<p style="color:var(--danger);">${escapeHTML(res.message)}</p>`; return; }
  
      const { workers, notes, dates, stats } = res.data;
  
      // Update stats
      document.getElementById('stat-submitted').textContent     = stats.submitted || 0;
      document.getElementById('stat-submitted-sub').textContent = `out of ${workers.length} workers`;
      document.getElementById('stat-customers').textContent     = stats.new_customers || 0;
      document.getElementById('stat-quotations').textContent    = stats.new_quotations || 0;
      document.getElementById('stat-value').textContent         = stats.total_value
        ? 'SAR ' + parseFloat(stats.total_value).toLocaleString('en-SA', { minimumFractionDigits: 0 })
        : '--';
  
      // Populate date dropdown
      const select = document.getElementById('date-select');
      select.innerHTML = '';
      const todayOpt = document.createElement('option');
      todayOpt.value = new Date().toISOString().split('T')[0];
      todayOpt.textContent = 'Today';
      select.appendChild(todayOpt);
  
      dates.forEach(d => {
        if (d === todayOpt.value) return;
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = formatDate(d);
        select.appendChild(opt);
      });
      select.value = date;
  
      // Build notes map
      const notesMap = {};
      notes.forEach(n => { notesMap[n.worker_id] = n; });
  
      container.innerHTML = '';
  
      workers.forEach(worker => {
        const note   = notesMap[worker.id];
        const card   = document.createElement('div');
        card.className = 'worker-note-card';
  
        const header = document.createElement('div');
        header.className = 'worker-note-header';
  
        const avatar = document.createElement('div');
        avatar.className = 'worker-note-avatar';
        avatar.textContent = worker.name.charAt(0).toUpperCase();
  
        const nameBlock = document.createElement('div');
        nameBlock.style.flex = '1';
  
        const name = document.createElement('div');
        name.style.cssText = 'font-weight:600;font-size:0.95rem;color:var(--grey-900);';
        name.textContent = worker.name;
  
        const email = document.createElement('div');
        email.style.cssText = 'font-size:0.8rem;color:var(--grey-400);';
        email.textContent = worker.email;
  
        nameBlock.appendChild(name);
        nameBlock.appendChild(email);
  
        const badge = document.createElement('span');
        badge.className = `badge ${note ? 'badge-success' : 'badge-warning'}`;
        badge.textContent = note ? 'Submitted' : 'Not submitted';
  
        header.appendChild(avatar);
        header.appendChild(nameBlock);
        header.appendChild(badge);
        card.appendChild(header);
  
        if (note) {
          const body = document.createElement('div');
          body.className = 'worker-note-body';
  
          const fields = document.createElement('div');
          fields.className = 'note-fields';
  
          const customerField = buildNoteField('New Customer',
            note.new_customer == 1 ? (note.customer_name || 'Yes') : 'No',
            note.new_customer == 1);
  
          const quotationField = buildNoteField('New Quotation',
            note.new_quotation == 1 ? (note.quotation_value ? 'SAR ' + parseFloat(note.quotation_value).toLocaleString() : 'Yes') : 'No',
            note.new_quotation == 1);
  
          const updatedField = buildNoteField('Last Updated', formatDateTime(note.updated_at), null);
  
          fields.appendChild(customerField);
          fields.appendChild(quotationField);
          fields.appendChild(updatedField);
          body.appendChild(fields);
  
          if (note.notes) {
            const noteText = document.createElement('div');
            noteText.className = 'note-text';
            noteText.textContent = note.notes;
            body.appendChild(noteText);
          }
  
          card.appendChild(body);
        } else {
          const empty = document.createElement('div');
          empty.className = 'not-submitted';
          empty.textContent = 'This worker has not submitted notes for this day yet.';
          card.appendChild(empty);
        }
  
        container.appendChild(card);
      });
  
    } catch (e) {
      container.innerHTML = '<p style="color:var(--danger);">Could not connect to the server.</p>';
    }
  }
  
  function buildNoteField(label, value, isPositive) {
    const field = document.createElement('div');
    field.className = 'note-field';
  
    const labelEl = document.createElement('div');
    labelEl.className = 'note-field-label';
    labelEl.textContent = label;
  
    const valueEl = document.createElement('div');
    valueEl.className = 'note-field-value' + (isPositive === true ? ' yes' : isPositive === false ? ' no' : '');
    valueEl.textContent = value;
  
    field.appendChild(labelEl);
    field.appendChild(valueEl);
    return field;
  }