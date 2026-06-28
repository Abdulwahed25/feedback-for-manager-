/* =============================================
   worker-daily-note.js
   Worker daily note page logic
   ============================================= */

   let _customerSelected  = null;
   let _quotationSelected = null;
   
   async function initDailyNote() {
     const user = await requireWorker();
     if (!user) return;
     setNavbar(user);
   
     // Set today's date display
     const today = new Date();
     const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
     document.getElementById('display-date').textContent = today.toLocaleDateString('en-GB', options);
   
     // Character counter for notes
     const notesEl = document.getElementById('notes');
     notesEl.addEventListener('input', function() {
       document.getElementById('notes-count').textContent = `${this.value.length} / 3000`;
     });
   
     // Load today's note if exists
     await loadMyNotes();
   }
   
   async function loadMyNotes() {
     try {
       const res = await apiGet('/daily/get_my_notes.php');
       if (!res.success) return;
   
       // Fill today's form if note exists
       if (res.data.today) {
         const note = res.data.today;
         selectYesNo('customer',  note.new_customer  == 1);
         selectYesNo('quotation', note.new_quotation == 1);
         if (note.customer_name)  document.getElementById('customer-name').value  = note.customer_name;
         if (note.quotation_value) document.getElementById('quotation-value').value = note.quotation_value;
         if (note.notes)          document.getElementById('notes').value = note.notes;
         document.getElementById('notes-count').textContent = `${note.notes?.length || 0} / 3000`;
       }
   
       // Render history
       renderHistory(res.data.history);
   
     } catch (e) {
       console.error('Could not load notes:', e);
     }
   }
   
   function selectYesNo(field, isYes) {
     if (field === 'customer')  _customerSelected  = isYes;
     if (field === 'quotation') _quotationSelected = isYes;
   
     const yesBtn = document.getElementById(`${field}-yes`);
     const noBtn  = document.getElementById(`${field}-no`);
     const condField = document.getElementById(field === 'customer' ? 'customer-name-field' : 'quotation-value-field');
   
     yesBtn.classList.toggle('selected', isYes);
     noBtn.classList.toggle('selected',  !isYes);
     condField.classList.toggle('visible', isYes);
   }
   
   async function saveNote() {
     const btn = document.getElementById('save-btn');
     btn.disabled = true;
     btn.textContent = 'Saving...';
   
     if (_customerSelected === null || _quotationSelected === null) {
       showAlert('alert-box', 'Please answer all questions (New Customer and New Quotation).');
       btn.disabled = false;
       btn.textContent = 'Save Today\'s Notes';
       return;
     }
   
     const data = {
       note_date:       new Date().toISOString().split('T')[0],
       new_customer:    _customerSelected  ? '1' : '0',
       customer_name:   sanitizeText(document.getElementById('customer-name').value,  200),
       new_quotation:   _quotationSelected ? '1' : '0',
       quotation_value: document.getElementById('quotation-value').value.trim(),
       notes:           sanitizeText(document.getElementById('notes').value, 3000),
     };
   
     try {
       const res = await apiPost('/daily/save_note.php', data);
   
       if (!res.success) {
         showAlert('alert-box', res.message || 'Could not save notes.');
         btn.disabled = false;
         btn.textContent = 'Save Today\'s Notes';
         return;
       }
   
       // Show saved indicator
       const indicator = document.getElementById('save-indicator');
       indicator.style.display = 'block';
       setTimeout(() => { indicator.style.display = 'none'; }, 3000);
   
       showAlert('alert-box', 'Your notes have been saved successfully.', 'success');
       await loadMyNotes();
   
     } catch (e) {
       showAlert('alert-box', 'Could not connect to the server.');
     }
   
     btn.disabled = false;
     btn.textContent = 'Save Today\'s Notes';
   }
   
   function renderHistory(history) {
     const listEl = document.getElementById('history-list');
   
     // Filter out today
     const today = new Date().toISOString().split('T')[0];
     const pastNotes = history.filter(n => n.note_date !== today);
   
     if (pastNotes.length === 0) {
       listEl.innerHTML = '<p style="color:var(--grey-400);font-size:0.88rem;">No previous notes yet.</p>';
       return;
     }
   
     listEl.innerHTML = '';
   
     pastNotes.forEach(note => {
       const item = document.createElement('div');
       item.className = 'history-item';
   
       const dateEl = document.createElement('div');
       dateEl.className = 'history-date';
       dateEl.textContent = formatDate(note.note_date);
   
       const tags = document.createElement('div');
       tags.className = 'history-tags';
   
       const customerBadge = document.createElement('span');
       customerBadge.className = `badge ${note.new_customer == 1 ? 'badge-success' : 'badge-grey'}`;
       customerBadge.textContent = note.new_customer == 1
         ? 'New Customer' + (note.customer_name ? ': ' + note.customer_name : '')
         : 'No New Customer';
   
       const quotationBadge = document.createElement('span');
       quotationBadge.className = `badge ${note.new_quotation == 1 ? 'badge-purple' : 'badge-grey'}`;
       quotationBadge.textContent = note.new_quotation == 1
         ? 'Quotation: SAR ' + parseFloat(note.quotation_value || 0).toLocaleString()
         : 'No Quotation';
   
       tags.appendChild(customerBadge);
       tags.appendChild(quotationBadge);
   
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