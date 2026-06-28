<?php
/* =============================================
   feedback/send_reminder.php
   Manager manually sends reminder to a worker
   ============================================= */

require_once '../config.php';
require_once '../email_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionAdmin();
verifyCsrfToken();
checkRateLimit('send_reminder', 20, 3600);

$taskId   = getPostInt('task_id');
$workerId = getPostInt('worker_id');

if (!$taskId || $taskId <= 0)    { sendError('Invalid task ID.'); }
if (!$workerId || $workerId <= 0) { sendError('Invalid worker ID.'); }

try {
    $db = getDB();

    $taskStmt = $db->prepare('SELECT id, title FROM tasks WHERE id = ? AND created_by = ? AND status = "active" LIMIT 1');
    $taskStmt->execute([$taskId, $sessionUser['id']]);
    $task = $taskStmt->fetch();
    if (!$task) { sendError('Task not found.', 404); }

    $workerStmt = $db->prepare('SELECT id, name, email FROM users WHERE id = ? AND role = "worker" LIMIT 1');
    $workerStmt->execute([$workerId]);
    $worker = $workerStmt->fetch();
    if (!$worker) { sendError('Worker not found.', 404); }

    $dupStmt = $db->prepare('SELECT id FROM feedback WHERE task_id = ? AND worker_id = ? LIMIT 1');
    $dupStmt->execute([$taskId, $workerId]);
    if ($dupStmt->fetch()) { sendError('This worker has already submitted feedback.', 409); }

} catch (PDOException $e) {
    error_log('[Send Reminder Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

$feedbackLink = PORTAL_URL . '/pages/worker-feedback.html?task=' . $taskId;

$html = emailHeader('Action Required', 'Your manager is waiting for your feedback')
    . "<p style='color:#1a1a2e;font-size:15px;margin:0 0 8px;'>Hi <strong>" . htmlspecialchars($worker['name']) . "</strong>,</p>
       <p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>
           This is a reminder from <strong>" . htmlspecialchars($sessionUser['name']) . "</strong>.
           You have not yet submitted your feedback on the task below. Please take a moment to complete it.
       </p>"
    . emailInfoBox('Task Requiring Your Feedback', htmlspecialchars($task['title']), 'From', htmlspecialchars($sessionUser['name']))
    . emailButton($feedbackLink, 'Submit My Feedback Now')
    . emailFooter();

$sent = sendEmail(
    $worker['email'],
    $worker['name'],
    '[Reminder] Feedback Required: ' . $task['title'],
    $html
);

if (!$sent) { sendError('Failed to send reminder email.', 500); }

sendSuccess(['message' => 'Reminder sent to ' . $worker['name']]);