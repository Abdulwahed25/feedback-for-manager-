<?php
/* =============================================
   tasks/close_task.php
   Closes a task — admin only
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionAdmin();
verifyCsrfToken();

$taskId = getPostInt('task_id');
if (!$taskId || $taskId <= 0) { sendError('Invalid task ID.'); }

try {
    $db = getDB();

    // Security: scope update to this admin's tasks only (IDOR prevention)
    $stmt = $db->prepare(
        'UPDATE tasks SET status = "closed"
         WHERE id = ? AND created_by = ? AND status = "active"'
    );
    $stmt->execute([$taskId, $sessionUser['id']]);

    if ($stmt->rowCount() === 0) {
        sendError('Task not found or already closed.', 404);
    }
} catch (PDOException $e) {
    error_log('[Close Task Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['message' => 'Task closed successfully.']);