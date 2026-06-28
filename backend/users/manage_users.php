<?php
/* =============================================
   users/manage_users.php
   Admin creates, deletes, resets user passwords
   No public signup — admin manages all accounts
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionAdmin();
verifyCsrfToken();

$action = getPostString('action', 20);
$allowed_actions = ['create', 'delete', 'reset_password', 'list'];
if (!in_array($action, $allowed_actions, true)) { sendError('Invalid action.'); }

try {
    $db = getDB();

    // ---- LIST USERS ----
    if ($action === 'list') {
        $stmt = $db->prepare('SELECT id, name, email, role, created_at FROM users ORDER BY role ASC, name ASC');
        $stmt->execute();
        sendSuccess(['users' => $stmt->fetchAll()]);
    }

    // ---- CREATE USER ----
    if ($action === 'create') {
        $fname    = getPostString('fname', 100);
        $lname    = getPostString('lname', 100);
        $email    = strtolower(getPostString('email', 150));
        $password = $_POST['password'] ?? '';
        $role     = getPostString('role', 10);

        if (empty($fname) || empty($lname) || empty($email) || empty($password)) {
            sendError('Please fill in all fields.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { sendError('Invalid email address.'); }
        if (strlen($password) < 8) { sendError('Password must be at least 8 characters.'); }
        if (!in_array($role, ['admin', 'worker'], true)) { sendError('Invalid role.'); }

        $check = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $check->execute([$email]);
        if ($check->fetch()) { sendError('An account with this email already exists.'); }

        $name = trim($fname . ' ' . $lname);
        $hash = password_hash($password, PASSWORD_BCRYPT);

        $db->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')->execute([$name, $email, $hash, $role]);

        sendSuccess(['message' => 'User created successfully.', 'user_id' => (int)$db->lastInsertId()], 201);
    }

    // ---- DELETE USER ----
    if ($action === 'delete') {
        $userId = getPostInt('user_id');
        if (!$userId) { sendError('Invalid user ID.'); }

        // Prevent admin from deleting themselves
        if ($userId === (int)$sessionUser['id']) { sendError('You cannot delete your own account.'); }

        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        sendSuccess(['message' => 'User deleted successfully.']);
    }

    // ---- RESET PASSWORD ----
    if ($action === 'reset_password') {
        $userId      = getPostInt('user_id');
        $newPassword = $_POST['new_password'] ?? '';

        if (!$userId) { sendError('Invalid user ID.'); }
        if (strlen($newPassword) < 8) { sendError('Password must be at least 8 characters.'); }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $db->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([$hash, $userId]);

        sendSuccess(['message' => 'Password reset successfully.']);
    }

} catch (PDOException $e) {
    error_log('[Manage Users Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}