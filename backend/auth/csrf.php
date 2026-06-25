<?php
/* =============================================
   auth/csrf.php
   Returns a CSRF token for the frontend to use
   on every POST request
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();

$token = generateCsrfToken();

sendSuccess(['token' => $token]);