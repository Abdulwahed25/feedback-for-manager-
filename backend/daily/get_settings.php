<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
$sessionUser = requireSessionAdmin();
try {
    $db = getDB();
    $stmt = $db->prepare('SELECT * FROM reminder_settings WHERE admin_id = ? LIMIT 1');
    $stmt->execute([$sessionUser['id']]);
    $settings = $stmt->fetch();
    if (!$settings) { $settings = ['reminder_time' => '15:00:00', 'reminder_days' => '0,1,2,3,4', 'email_digest' => 1]; }
} catch (PDOException $e) { error_log('[Get Settings Error] ' . $e->getMessage()); sendError('Server error.', 500); }
sendSuccess(['settings' => $settings]);