<?php
/* =============================================
   auth/session.php
   Returns the current session user to the frontend
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
startSecureSession();

if (empty($_SESSION['user'])) {
    sendError('Not authenticated.', 401);
}

// Return user info — never return password
sendSuccess([
    'user' => [
        'id'    => $_SESSION['user']['id'],
        'name'  => $_SESSION['user']['name'],
        'email' => $_SESSION['user']['email'],
        'role'  => $_SESSION['user']['role'],
    ]
]);