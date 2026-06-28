<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
$sessionUser = requireSessionAdmin();
verifyCsrfToken();
$reminderTime = getPostString('reminder_time', 8);
$reminderDays = getPostString('reminder_days', 20);
$emailDigest  = filter_var($_POST['email_digest'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
if (!preg_match('/^\d{2}:\d{2}$/', $reminderTime)) { sendError('Invalid time format.'); }
[$h, $m] = explode(':', $reminderTime);
if ((int)$h > 23 || (int)$m > 59) { sendError('Invalid time value.'); }
$days = array_filter(explode(',', $reminderDays), fn($d) => preg_match('/^[0-6]$/', trim($d)));
if (empty($days)) { sendError('Please select at least one day.'); }
$cleanDays = implode(',', array_map('trim', $days));
try {
    $db = getDB();
    $db->prepare('INSERT INTO reminder_settings (admin_id, reminder_time, reminder_days, email_digest) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reminder_time = VALUES(reminder_time), reminder_days = VALUES(reminder_days), email_digest = VALUES(email_digest), updated_at = NOW()')
       ->execute([$sessionUser['id'], $reminderTime . ':00', $cleanDays, $emailDigest]);
} catch (PDOException $e) { error_log('[Save Settings Error] ' . $e->getMessage()); sendError('Server error.', 500); }
sendSuccess(['message' => 'Settings saved.']);