<?php
/* =============================================
   auth/login.php
   Handles user login — security hardened
   ============================================= */

require_once '../config.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
startSecureSession();

// ---- Rate limiting ----
// Block after 5 failed attempts within 15 minutes
checkRateLimit('login');

// ---- CSRF verification ----
verifyCsrfToken();

// ---- Input validation ----
$email    = getPostString('email', 150);
$password = $_POST['password'] ?? '';

if (empty($email) || empty($password)) {
    sendError('Please fill in all fields.');
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Invalid email address.');
}

// Enforce password length bounds
if (strlen($password) < 8 || strlen($password) > 128) {
    // Generic message — do not reveal which field is wrong
    recordFailedAttempt('login');
    sendError('Incorrect email or password.');
}

// ---- Database lookup ----
try {
    $db   = getDB();
    $stmt = $db->prepare('SELECT id, name, email, password, role FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([strtolower($email)]);
    $user = $stmt->fetch();
} catch (PDOException $e) {
    error_log('[Login Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

// ---- Password verification ----
// Security: use password_verify() with bcrypt — never plain text or SHA2
// Constant-time comparison prevents timing attacks
if (!$user || !password_verify($password, $user['password'])) {
    recordFailedAttempt('login');
    // Generic message — never reveal whether email or password is wrong
    sendError('Incorrect email or password.');
}

// ---- Rehash if needed ----
// If bcrypt cost factor was increased, rehash transparently
if (password_needs_rehash($user['password'], PASSWORD_BCRYPT)) {
    $newHash = password_hash($password, PASSWORD_BCRYPT);
    $update  = $db->prepare('UPDATE users SET password = ? WHERE id = ?');
    $update->execute([$newHash, $user['id']]);
}

// ---- Session setup ----
// Regenerate session ID on login to prevent session fixation attacks
session_regenerate_id(true);

// Store only what is needed — never store the password hash in session
$_SESSION['user'] = [
    'id'   => (int) $user['id'],
    'name' => $user['name'],
    'email'=> $user['email'],
    'role' => $user['role'],
];

// Clear rate limit on successful login
clearRateLimit('login');

sendSuccess([
    'name' => $user['name'],
    'role' => $user['role'],
]);