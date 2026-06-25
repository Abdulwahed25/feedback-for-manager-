<?php
/* =============================================
   auth/logout.php
   Handles user logout — security hardened
   ============================================= */

require_once '../config.php';

// Accept both POST and GET for logout
// POST is preferred to prevent CSRF logout attacks
setSecurityHeaders();
startSecureSession();

// ---- Destroy session completely ----

// 1. Clear all session variables
$_SESSION = [];

// 2. Delete the session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// 3. Destroy the session on the server
session_destroy();

// ---- Respond ----
// If called via fetch(), return JSON
// If called via direct link, redirect
$isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) &&
          strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

if ($isAjax) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true]);
    exit;
}

header('Location: ../../pages/login.html');
exit;