<?php
/* =============================================
   tasks/get_task_worker.php
   Returns a single task with its fields
   for the worker feedback form
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
$sessionUser = requireSessionWorker();

$taskId = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($taskId <= 0) {
    sendError('Invalid task ID.', 400);
}

try {
    $db = getDB();

    // Get task — must be active
    $taskStmt = $db->prepare(
        'SELECT id, title, description, status FROM tasks WHERE id = ? AND status = "active" LIMIT 1'
    );
    $taskStmt->execute([$taskId]);
    $task = $taskStmt->fetch();

    if (!$task) {
        sendError('Task not found or no longer active.', 404);
    }

    // Check if worker already submitted
    $dupStmt = $db->prepare(
        'SELECT id FROM feedback WHERE task_id = ? AND worker_id = ? LIMIT 1'
    );
    $dupStmt->execute([$taskId, $sessionUser['id']]);

    if ($dupStmt->fetch()) {
        sendError('Already submitted.', 409, ['already_submitted' => true]);
    }

    // Get fields
    $fieldStmt = $db->prepare(
        'SELECT id, label, field_type, is_required, field_order
         FROM task_fields
         WHERE task_id = ?
         ORDER BY field_order ASC'
    );
    $fieldStmt->execute([$taskId]);
    $task['fields'] = $fieldStmt->fetchAll();

} catch (PDOException $e) {
    error_log('[Get Task Worker Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['task' => $task]);