/* =============================================
   worker-daily-note.js
   ============================================= */

   let _customersCount  = 0;
   let _quotationsCount = 0;
   
   async function initDailyNote() {
     const user = await requireWorker();
     if (!user) return;
     setNavbar(user);
   
     const today = new Date();
     const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
     document.getElementById('display-date').textContent = today.toLocaleDateString('en-GB', options);
   
     await loadMyNotes();
   }
   
   async function loadMyNotes() {
     try {
       const res = await apiGet('/daily/get_my_notes.php');
       if (!res.success) return;
   
       if (res.data.today) {
         const note = res.data.today;
         document.getElementById('notes').value = note.notes || '';
         document.getElementById('notes-count').textContent = `${(note.notes || '').length} / 3000`;
   
         // Restore customers
         const customers = note.customers || [];
         _customersCount = customers.length;
         document.getElementById('customers-count').textContent = _customersCount;
         renderEntries('customers', _customersCount, customers);
   
         // Restore quotations
         const quotations = note.quotations || [];
         _quotationsCount = quotations.length;
         document.getElementById('quotations-count').textContent = _quotationsCount;
         renderEntries('quotations', _quotationsCount, quotations);
       }
   
       renderHistory(res.data.history || []);
   
     } catch (e) {
       console.error('Could not load notes:', e);
     }
   }
   
   function changeCount(type, delta) {
     if (type === 'customers') {
       _customersCount = Math.max(0, Math.min(20, _customersCount + delta));
       document.getElementById('customers-count').textContent = _customersCount;
       renderEntries('customers', _customersCount);
     } else {
       _quotationsCount = Math.max(0, Math.min(20, _quotationsCount + delta));
       document.getElementById('quotations-count').textContent = _quotationsCount;
       renderEntries('quotations', _quotationsCount);
     }
   }
   
   function renderEntries(type, count, existingData) {
     const container = document.getElementById(`${type}-entries`);
     const current   = container.querySelectorAll('.entry-card');
   
     // Add new cards
     while (container.children.length < count) {
       const i    = container.children.length;
       const card = document.createElement('div');
       card.className = 'entry-card';
   
       const title = document.createElement('div');
       title.className = 'entry-card-title';
       title.textContent = type === 'customers' ? `Customer ${i + 1}` : `Quotation ${i + 1}`;
   
       const fields = document.createElement('div');
       fields.className = 'entry-fields';
   
       if (type === 'customers') {
         fields.innerHTML = `
           <div class="form-group" style="margin-bottom:0;">
             <label class="form-label">Name <span style="color:var(--grey-400);font-weight:400;">(optional)</span></label>
             <input class="form-input" type="text" data-field="name" placeholder="Customer name" maxlength="200"/>
           </div>
           <div class="form-group" style="margin-bottom:0;">
             <label class="form-label">Problem / Issue <span style="color:var(--grey-400);font-weight:400;">(optional)</span></label>
             <input class="form-input" type="text" data-field="problem" placeholder="Briefly describe the issue" maxlength="1000"/>
           </div>`;
       } else {
         fields.innerHTML = `
           <div class="form-group" style="margin-bottom:0;">
             <label class="form-label">Customer Name <span style="color:var(--grey-400);font-weight:400;">(optional)</span></label>
             <input class="form-input" type="text" data-field="name" placeholder="Customer name" maxlength="200"/>
           </div>
           <div class="form-group" style="margin-bottom:0;">
             <label class="form-label">Value (SAR) <span style="color:var(--grey-400);font-weight:400;">(optional)</span></label>
             <input class="form-input" type="number" data-field="value" placeholder="e.g. 15000" min="0" max="999999999" step="0.01"/>
           </div>`;
       }
   
       card.appendChild(title);
       card.appendChild(fields);
       container.appendChild(card);
   
       // Fill existing data if provided
       if (existingData && existingData[i]) {
         const d = existingData[i];
         card.querySelector('[data-field="name"]').value    = d.name    || '';
         if (type === 'customers') {
           card.querySelector('[data-field="problem"]').value = d.problem || '';
         } else {
           card.querySelector('[data-field="value"]').value   = d.value   || '';
         }
       }
     }
   
     // Remove extra cards
     while (container.children.length > count) {
       container.removeChild(container.lastChild);
     }
   }
   
   function collectEntries(type) {
     const cards = document.getElementById(`${type}-entries`).querySelectorAll('.entry-card');
     return Array.from(cards).map(card => {
       const name = card.querySelector('[data-field="name"]')?.value.trim() || '';
       if (type === 'customers') {
         return { name, problem: card.querySelector('[data-field="problem"]')?.value.trim() || '' };
       } else {
         return { name, value: card.querySelector('[data-field="value"]')?.value.trim() || '' };
       }
     });
   }
   
   async function saveNote() {
     const btn   = document.getElementById('save-btn');
     const notes = document.getElementById('notes').value.trim();
   
     if (!notes) {
       showAlert('alert-box', 'Additional Notes field is required.');
       return;
     }
   
     btn.disabled = true;
     btn.textContent = 'Saving...';
   
     const data = {
       note_date:  new Date().toISOString().split('T')[0],
       notes:      sanitizeText(notes, 3000),
       customers:  JSON.stringify(collectEntries('customers')),
       quotations: JSON.stringify(collectEntries('quotations')),
     };
   
     try {
       const res = await apiPost('/daily/save_note.php', data);
   
       if (!res.success) {
         showAlert('alert-box', res.message || 'Could not save notes.');
         btn.disabled = false;
         btn.textContent = 'Save Today\'s Notes';
         return;
       }
   
       const indicator = document.getElementById('save-indicator');
       indicator.style.display = 'block';
       setTimeout(() => { indicator.style.display = 'none'; }, 3000);
   
       showAlert('alert-box', 'Notes saved successfully.', 'success');
       await loadMyNotes();
   
     } catch (e) {
       showAlert('alert-box', 'Could not connect to the server.');
     }
   
     btn.disabled = false;
     btn.textContent = 'Save Today\'s Notes';
   }
   
   function renderHistory(history) {
     const listEl = document.getElementById('history-list');
     const today  = new Date().toISOString().split('T')[0];
     const past   = history.filter(n => n.note_date !== today);
   
     if (past.length === 0) {
       listEl.innerHTML = '<p style="color:var(--grey-400);font-size:0.88rem;">No previous notes yet.</p>';
       return;
     }
   
     listEl.innerHTML = '';
     past.forEach(note => {
       const item = document.createElement('div');
       item.className = 'history-item';
   
       const dateEl = document.createElement('div');
       dateEl.className = 'history-date';
       dateEl.textContent = formatDate(note.note_date);
   
       const tags = document.createElement('div');
       tags.className = 'history-tags';
   
       const cBadge = document.createElement('span');
       cBadge.className = `badge ${note.customer_count > 0 ? 'badge-success' : 'badge-grey'}`;
       cBadge.textContent = `${note.customer_count} Customer${note.customer_count != 1 ? 's' : ''}`;
   
       const qBadge = document.createElement('span');
       qBadge.className = `badge ${note.quotation_count > 0 ? 'badge-purple' : 'badge-grey'}`;
       qBadge.textContent = note.quotation_count > 0
         ? `${note.quotation_count} Quotation${note.quotation_count != 1 ? 's' : ''}` + (note.total_value ? ' · SAR ' + parseFloat(note.total_value).toLocaleString() : '')
         : '0 Quotations';
   
       tags.appendChild(cBadge);
       tags.appendChild(qBadge);
       item.appendChild(dateEl);
       item.appendChild(tags);
   
       if (note.notes) {
         const noteText = document.createElement('div');
         noteText.className = 'history-note';
         noteText.textContent = note.notes;
         item.appendChild(noteText);
       }
   
       listEl.appendChild(item);
     });
   }