/* =============================================
   admin-users.js
   User management page logic
   ============================================= */

   let _selectedUserId   = null;
   let _selectedUserName = '';
   
   async function initUsersPage() {
     const user = await requireAdmin();
     if (!user) return;
     setNavbar(user);
     await loadUsers();
   }
   
   async function loadUsers() {
     const list = document.getElementById('users-list');
   
     try {
       const res = await apiPost('/users/manage_users.php', { action: 'list' });
   
       if (!res.success) {
         list.innerHTML = `<p style="color:var(--danger);">${escapeHTML(res.message)}</p>`;
         return;
       }
   
       const users   = res.data.users;
       const admins  = users.filter(u => u.role === 'admin');
       const workers = users.filter(u => u.role === 'worker');
   
       list.innerHTML = '';
   
       if (admins.length > 0) {
         const adminLabel = document.createElement('p');
         adminLabel.style.cssText = 'font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-400);margin:0 0 10px;';
         adminLabel.textContent = 'Managers';
         list.appendChild(adminLabel);
         admins.forEach(u => list.appendChild(buildUserCard(u)));
       }
   
       if (workers.length > 0) {
         const workerLabel = document.createElement('p');
         workerLabel.style.cssText = 'font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-400);margin:16px 0 10px;';
         workerLabel.textContent = 'Workers';
         list.appendChild(workerLabel);
         workers.forEach(u => list.appendChild(buildUserCard(u)));
       }
   
     } catch (e) {
       list.innerHTML = `<p style="color:var(--danger);">Could not load users.</p>`;
     }
   }
   
   function buildUserCard(user) {
     const card = document.createElement('div');
     card.className = 'user-card';
   
     const avatar = document.createElement('div');
     avatar.className = 'user-avatar';
     avatar.textContent = user.name.charAt(0).toUpperCase();
   
     const info = document.createElement('div');
     info.className = 'user-info';
   
     const name = document.createElement('div');
     name.className = 'user-name';
     name.textContent = user.name;
   
     const email = document.createElement('div');
     email.className = 'user-email';
     email.textContent = user.email;
   
     const badge = document.createElement('span');
     badge.className = `badge ${user.role === 'admin' ? 'badge-purple' : 'badge-grey'}`;
     badge.style.marginLeft = '8px';
     badge.textContent = user.role === 'admin' ? 'Manager' : 'Worker';
   
     name.appendChild(badge);
     info.appendChild(name);
     info.appendChild(email);
   
     const actions = document.createElement('div');
     actions.className = 'user-actions';
   
     const resetBtn = document.createElement('button');
     resetBtn.className = 'btn btn-outline btn-sm';
     resetBtn.textContent = 'Reset Password';
     resetBtn.addEventListener('click', () => openResetModal(user.id, user.name));
   
     const deleteBtn = document.createElement('button');
     deleteBtn.className = 'btn btn-danger btn-sm';
     deleteBtn.textContent = 'Delete';
     deleteBtn.addEventListener('click', () => deleteUser(user.id, user.name));
   
     actions.appendChild(resetBtn);
     actions.appendChild(deleteBtn);
   
     card.appendChild(avatar);
     card.appendChild(info);
     card.appendChild(actions);
   
     return card;
   }
   
   // ---- Create User ----
   
   function openCreateModal() {
     document.getElementById('create-modal').style.display = 'flex';
     document.getElementById('new-fname').focus();
   }
   
   function closeCreateModal() {
     document.getElementById('create-modal').style.display = 'none';
     document.getElementById('modal-alert').innerHTML = '';
     ['new-fname','new-lname','new-email','new-password'].forEach(id => {
       document.getElementById(id).value = '';
     });
   }
   
   async function createUser() {
     const btn = document.getElementById('create-btn');
     btn.disabled = true;
   
     const fname    = sanitizeText(document.getElementById('new-fname').value, 100);
     const lname    = sanitizeText(document.getElementById('new-lname').value, 100);
     const email    = sanitizeText(document.getElementById('new-email').value, 150);
     const role     = document.getElementById('new-role').value;
     const password = document.getElementById('new-password').value;
   
     if (!fname || !lname || !email || !password) {
       showAlert('modal-alert', 'Please fill in all fields.');
       btn.disabled = false;
       return;
     }
   
     try {
       const res = await apiPost('/users/manage_users.php', {
         action: 'create', fname, lname, email, role, password
       });
   
       if (!res.success) {
         showAlert('modal-alert', res.message);
         btn.disabled = false;
         return;
       }
   
       closeCreateModal();
       showAlert('alert-box', 'User created successfully.', 'success');
       await loadUsers();
   
     } catch (e) {
       showAlert('modal-alert', 'Could not connect to the server.');
       btn.disabled = false;
     }
   }
   
   // ---- Reset Password ----
   
   function openResetModal(userId, userName) {
     _selectedUserId   = userId;
     _selectedUserName = userName;
     document.getElementById('reset-user-name').textContent = 'Resetting password for: ' + userName;
     document.getElementById('reset-modal').style.display = 'flex';
     document.getElementById('reset-password').focus();
   }
   
   function closeResetModal() {
     document.getElementById('reset-modal').style.display = 'none';
     document.getElementById('reset-alert').innerHTML = '';
     document.getElementById('reset-password').value = '';
     _selectedUserId = null;
   }
   
   async function resetPassword() {
     const btn         = document.getElementById('reset-btn');
     const newPassword = document.getElementById('reset-password').value;
   
     if (!newPassword || newPassword.length < 8) {
       showAlert('reset-alert', 'Password must be at least 8 characters.');
       return;
     }
   
     btn.disabled = true;
   
     try {
       const res = await apiPost('/users/manage_users.php', {
         action: 'reset_password',
         user_id: _selectedUserId,
         new_password: newPassword
       });
   
       if (!res.success) {
         showAlert('reset-alert', res.message);
         btn.disabled = false;
         return;
       }
   
       closeResetModal();
       showAlert('alert-box', 'Password reset successfully.', 'success');
   
     } catch (e) {
       showAlert('reset-alert', 'Could not connect to the server.');
       btn.disabled = false;
     }
   }
   
   // ---- Delete User ----
   
   async function deleteUser(userId, userName) {
     if (!confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`)) return;
   
     try {
       const res = await apiPost('/users/manage_users.php', {
         action: 'delete',
         user_id: userId
       });
   
       if (!res.success) {
         showAlert('alert-box', res.message);
         return;
       }
   
       showAlert('alert-box', `${userName} has been deleted.`, 'success');
       await loadUsers();
   
     } catch (e) {
       showAlert('alert-box', 'Could not connect to the server.');
     }
   }