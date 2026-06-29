/* =============================================
   admin-daily-notes.js
   ============================================= */

   let _currentView = 'daily';

   async function initAdminDailyNotes() {
     const user = await requireAdmin();
     if (!user) return;
     setNavbar(user);
   
     // Set today in date picker — force Gregorian using ISO format
     const today = new Date();
     const iso   = today.toISOString().split('T')[0]; // YYYY-MM-DD always Gregorian
     const monthIso = iso.substring(0, 7); // YYYY-MM
   
     document.getElementById('date-picker').value  = iso;
     document.getElementById('month-picker').value = monthIso;
   
     await loadNotes(iso);
   }
   
   function switchView(view) {
     _currentView = view;
     document.getElementById('view-daily').style.display   = view === 'daily'   ? 'block' : 'none';
     document.getElementById('view-monthly').style.display = view === 'monthly' ? 'block' : 'none';
     document.getElementById('tab-daily').classList.toggle('active',   view === 'daily');
     document.getElementById('tab-monthly').classList.toggle('active', view === 'monthly');
   
     if (view === 'monthly') {
       const month = document.getElementById('month-picker').value || new Date().toISOString().substring(0, 7);
       loadMonthly(month);
     }
   }
   
   async function loadNotes(date) {
     // Sync date picker
     document.getElementById('date-picker').value = date;
   
     const container = document.getElementById('notes-container');
     container.innerHTML = '<p style="color:var(--grey-400);">Loading...</p>';
   
     try {
       const res = await apiGet('/daily/get_all_notes.php?date=' + encodeURIComponent(date));
       if (!res.success) { container.innerHTML = '<p style="color:var(--danger);">' + escapeHTML(res.message) + '</p>'; return; }
   
       const { workers, notes, dates, stats } = res.data;
   
       // Update stats
       document.getElementById('stat-submitted').textContent     = stats.submitted || 0;
       document.getElementById('stat-submitted-sub').textContent = 'out of ' + workers.length + ' workers';
       document.getElementById('stat-customers').textContent     = stats.total_customers  || 0;
       document.getElementById('stat-quotations').textContent    = stats.total_quotations || 0;
       document.getElementById('stat-value').textContent         = stats.total_value
         ? 'SAR ' + parseFloat(stats.total_value).toLocaleString('en-SA', { minimumFractionDigits: 0 })
         : '--';
   
       // Populate date dropdown
       const select = document.getElementById('date-select');
       select.innerHTML = '';
       const todayIso = new Date().toISOString().split('T')[0];
       const todayOpt = document.createElement('option');
       todayOpt.value = todayIso;
       todayOpt.textContent = 'Today';
       select.appendChild(todayOpt);
   
       dates.forEach(function(d) {
         if (d === todayIso) return;
         const opt = document.createElement('option');
         opt.value = d;
         opt.textContent = formatDate(d);
         select.appendChild(opt);
       });
       select.value = date;
   
       // Build notes map
       const notesMap = {};
       notes.forEach(function(n) { notesMap[n.worker_id] = n; });
   
       container.innerHTML = '';
   
       workers.forEach(function(worker) {
         const note = notesMap[worker.id];
         const card = document.createElement('div');
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
         badge.className = 'badge ' + (note ? 'badge-success' : 'badge-warning');
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
   
           fields.appendChild(buildNoteField('New Customers',  String(note.customer_count  || 0), note.customer_count  > 0));
           fields.appendChild(buildNoteField('New Quotations', String(note.quotation_count || 0), note.quotation_count > 0));
           fields.appendChild(buildNoteField('Total Value',    note.total_value ? 'SAR ' + parseFloat(note.total_value).toLocaleString() : '--', null));
           fields.appendChild(buildNoteField('Last Updated',   formatDateTime(note.updated_at), null));
   
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
   
   async function loadMonthly(month) {
     document.getElementById('month-picker').value = month;
   
     const container = document.getElementById('monthly-container');
     container.innerHTML = '<p style="color:var(--grey-400);">Loading...</p>';
   
     try {
       const res = await apiGet('/daily/get_monthly_notes.php?month=' + encodeURIComponent(month));
       if (!res.success) { container.innerHTML = '<p style="color:var(--danger);">' + escapeHTML(res.message) + '</p>'; return; }
   
       const { performance, working_days, total_working, available_months } = res.data;
   
       // Populate month dropdown
       const select = document.getElementById('month-select');
       select.innerHTML = '';
       const currentMonth = new Date().toISOString().substring(0, 7);
       const currentOpt   = document.createElement('option');
       currentOpt.value = currentMonth;
       currentOpt.textContent = 'This Month';
       select.appendChild(currentOpt);
   
       available_months.forEach(function(m) {
         if (m === currentMonth) return;
         const opt = document.createElement('option');
         opt.value = m;
         const d = new Date(m + '-01');
         opt.textContent = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
         select.appendChild(opt);
       });
       select.value = month;
   
       container.innerHTML = '';
   
       // Summary header
       const today = new Date().toISOString().split('T')[0];
       const pastDays = working_days.filter(function(d) { return d <= today; }).length;
   
       const summary = document.createElement('div');
       summary.className = 'card';
       summary.style.marginBottom = '20px';
       summary.innerHTML = '<p style="font-size:0.88rem;color:var(--grey-600);">Showing performance for <strong>' + pastDays + ' working days</strong> (Sun–Thu) so far this month. Total working days this month: <strong>' + total_working + '</strong>.</p>';
       container.appendChild(summary);
   
       // Per worker performance
       performance.forEach(function(p) {
         const rate = p.rate;
         const rateColor = rate === null ? 'var(--grey-400)' : rate >= 80 ? 'var(--success)' : rate >= 50 ? '#b54708' : 'var(--danger)';
   
         const card = document.createElement('div');
         card.className = 'perf-card';
   
         const header = document.createElement('div');
         header.className = 'perf-header';
         header.onclick = function() {
           const grid = card.querySelector('.calendar-grid');
           grid.classList.toggle('open');
         };
   
         const avatar = document.createElement('div');
         avatar.className = 'perf-avatar';
         avatar.textContent = p.worker_name.charAt(0).toUpperCase();
   
         const info = document.createElement('div');
         info.className = 'perf-info';
         info.innerHTML = '<div class="perf-name">' + escapeHTML(p.worker_name) + '</div><div class="perf-email">' + escapeHTML(p.worker_email) + '</div>';
   
         const stats = document.createElement('div');
         stats.className = 'perf-stats';
         stats.innerHTML =
           '<div class="perf-stat"><div class="perf-stat-value" style="color:var(--success);">' + p.submitted + '</div><div class="perf-stat-label">Submitted</div></div>' +
           '<div class="perf-stat"><div class="perf-stat-value" style="color:var(--danger);">' + p.missed + '</div><div class="perf-stat-label">Missed</div></div>' +
           '<div class="perf-stat"><div class="perf-stat-value" style="color:' + rateColor + ';">' + (rate !== null ? rate + '%' : '--') + '</div><div class="perf-stat-label">Rate</div></div>';
   
         const arrow = document.createElement('div');
         arrow.style.cssText = 'color:var(--grey-400);font-size:0.8rem;flex-shrink:0;';
         arrow.textContent = '▼ Details';
   
         header.appendChild(avatar);
         header.appendChild(info);
         header.appendChild(stats);
         header.appendChild(arrow);
   
         // Calendar grid
         const grid = document.createElement('div');
         grid.className = 'calendar-grid';
   
         const legend = document.createElement('div');
         legend.className = 'cal-legend';
         legend.innerHTML =
           '<span><div class="cal-dot" style="background:#ecfdf3;border:1px solid #027a48;"></div> Submitted</span>' +
           '<span><div class="cal-dot" style="background:#fee2e2;border:1px solid #b42318;"></div> Missed</span>' +
           '<span><div class="cal-dot" style="background:var(--grey-100);"></div> Weekend / Future</span>';
   
         const dates = document.createElement('div');
         dates.className = 'calendar-dates';
   
         // Get first day of month to add empty cells
         const firstDate = new Date(month + '-01');
         const firstWeekday = firstDate.getDay(); // 0=Sun
   
         // Add empty cells before first day
         for (let i = 0; i < firstWeekday; i++) {
           const empty = document.createElement('div');
           empty.className = 'cal-day empty';
           dates.appendChild(empty);
         }
   
         // Add all days of month
         const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate();
         for (let d = 1; d <= daysInMonth; d++) {
           const dateStr = month + '-' + String(d).padStart(2, '0');
           const weekday = new Date(dateStr).getDay();
           const isWeekend = weekday === 5 || weekday === 6; // Fri=5, Sat=6
           const isFuture  = dateStr > today;
           const hasNote   = p.notes_by_date && p.notes_by_date[dateStr];
   
           const cell = document.createElement('div');
           cell.textContent = d;
   
           if (isWeekend || isFuture) {
             cell.className = 'cal-day ' + (isFuture ? 'future' : 'weekend');
             cell.title = isFuture ? 'Future' : 'Weekend';
           } else if (hasNote) {
             cell.className = 'cal-day submitted';
             cell.title = 'Submitted';
           } else {
             cell.className = 'cal-day missed';
             cell.title = 'Missed';
           }
   
           dates.appendChild(cell);
         }
   
         grid.appendChild(legend);
         grid.appendChild(dates);
   
         card.appendChild(header);
         card.appendChild(grid);
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