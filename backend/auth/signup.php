<?php
/* =============================================
   auth/signup.php
   Handles user registration — security hardened
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
startSecureSession();

// ---- CSRF verification ----
verifyCsrfToken();

// ---- Rate limiting ----
// Prevent mass account creation
checkRateLimit('signup', 10, 3600); // 10 signups per hour per session

// ---- Input collection and sanitization ----
$fname    = getPostString('fname', 100);
$lname    = getPostString('lname', 100);
$email    = strtolower(getPostString('email', 150));
$password = $_POST['password'] ?? '';
$confirm  = $_POST['confirm']  ?? '';
$role     = getPostString('role', 10);

// ---- Validation ----

if (empty($fname) || empty($lname) || empty($email) || empty($password) || empty($confirm)) {
    sendError('Please fill in all fields.');
}

// Name validation — letters, spaces, hyphens, apostrophes only
if (!preg_match('/^[\p{L}\p{M}\s\'\-]+$/u', $fname) || !preg_match('/^[\p{L}\p{M}\s\'\-]+$/u', $lname)) {
    sendError('Name contains invalid characters.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendError('Please enter a valid email address.');
}

if (strlen($password) < 8) {
    sendError('Password must be at least 8 characters.');
}

if (strlen($password) > 128) {
    sendError('Password is too long.');
}

if ($password !== $confirm) {
    sendError('Passwords do not match.');
}

// Whitelist role — never trust client input
if (!in_array($role, ['admin', 'worker'], true)) {
    sendError('Invalid role selected.');
}

// ---- Check for duplicate email ----
try {
    $db   = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        sendError('An account with this email already exists.');
    }
} catch (PDOException $e) {
    error_log('[Signup Check Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

// ---- Hash password ----
// Security: bcrypt with default cost (12)
// Never use MD5, SHA1, SHA2, or plain text
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

// ---- Insert user ----
try {
    $name = trim($fname . ' ' . $lname);
    $stmt = $db->prepare(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$name, $email, $hashedPassword, $role]);
    $userId = (int) $db->lastInsertId();
} catch (PDOException $e) {
    error_log('[Signup Insert Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

// ---- Create session ----
session_regenerate_id(true);

$_SESSION['user'] = [
    'id'    => $userId,
    'name'  => $name,
    'email' => $email,
    'role'  => $role,
];

recordFailedAttempt('signup'); // track signup rate
clearRateLimit('signup');

sendSuccess([
    'name' => $name,
    'role' => $role,
], 201);