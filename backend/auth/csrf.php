<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}
setSecurityHeaders();
$token = generateCsrfToken();
sendSuccess(['token' => $token]);