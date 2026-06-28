/* =============================================
   admin-settings.js
   Settings page logic
   ============================================= */

   let _emailDigest = true;

   async function initSettings() {
     const user = await requireAdmin();
     if (!user) return;
     setNavbar(user);
   
     try {
       const res = await apiGet('/daily/get_settings.php');
       if (!res.success) return;
   
       const s = res.data.settings;
   
       // Set time
       const timeVal = s.reminder_time ? s.reminder_time.substring(0, 5) : '15:00';
       document.getElementById('reminder-time').value = timeVal;
   
       // Set days
       const selectedDays = s.reminder_days.split(',').map(d => d.trim());
       document.querySelectorAll('.day-btn').forEach(btn => {
         btn.classList.toggle('selected', selectedDays.includes(btn.dataset.day));
       });
   
       // Set email digest
       _emailDigest = s.email_digest == 1;
       const toggle = document.getElementById('email-digest-toggle');
       toggle.classList.toggle('on', _emailDigest);
   
     } catch (e) {
       showAlert('alert-box', 'Could not load settings.');
     }
   }
   
   function toggleDay(btn) {
     btn.classList.toggle('selected');
   }
   
   function toggleEmailDigest(btn) {
     _emailDigest = !_emailDigest;
     btn.classList.toggle('on', _emailDigest);
   }
   
   async function saveSettings() {
     const btn = document.querySelector('.btn-primary');
     btn.disabled = true;
     btn.textContent = 'Saving...';
   
     const reminderTime = document.getElementById('reminder-time').value;
     const selectedDays = [...document.querySelectorAll('.day-btn.selected')].map(b => b.dataset.day);
   
     if (!reminderTime) {
       showAlert('alert-box', 'Please set a reminder time.');
       btn.disabled = false; btn.textContent = 'Save Settings';
       return;
     }
   
     if (selectedDays.length === 0) {
       showAlert('alert-box', 'Please select at least one day.');
       btn.disabled = false; btn.textContent = 'Save Settings';
       return;
     }
   
     try {
       const res = await apiPost('/daily/save_settings.php', {
         reminder_time: reminderTime,
         reminder_days: selectedDays.join(','),
         email_digest:  _emailDigest ? '1' : '0',
       });
   
       if (!res.success) {
         showAlert('alert-box', res.message || 'Could not save settings.');
       } else {
         showAlert('alert-box', 'Settings saved successfully.', 'success');
       }
   
     } catch (e) {
       showAlert('alert-box', 'Could not connect to the server.');
     }
   
     btn.disabled = false;
     btn.textContent = 'Save Settings';
   }