<?php
/* =============================================
   tasks/get_tasks_worker.php
   Returns pending and completed tasks for
   the logged-in worker
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
$sessionUser = requireSessionWorker();

try {
    $db = getDB();

    // Get all active tasks
    $allStmt = $db->prepare(
        'SELECT id, title, description, status, created_at
         FROM tasks
         WHERE status = "active"
         ORDER BY created_at DESC'
    );
    $allStmt->execute();
    $allTasks = $allStmt->fetchAll();

    // Get tasks this worker already submitted feedback on
    $doneStmt = $db->prepare(
        'SELECT task_id, submitted_at FROM feedback WHERE worker_id = ?'
    );
    $doneStmt->execute([$sessionUser['id']]);
    $done = $doneStmt->fetchAll();

    $doneMap = [];
    foreach ($done as $d) {
        $doneMap[$d['task_id']] = $d['submitted_at'];
    }

    $pending   = [];
    $completed = [];

    foreach ($allTasks as $task) {
        if (isset($doneMap[$task['id']])) {
            $task['submitted_at'] = $doneMap[$task['id']];
            $completed[] = $task;
        } else {
            $pending[] = $task;
        }
    }

} catch (PDOException $e) {
    error_log('[Get Tasks Worker Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess([
    'pending'   => $pending,
    'completed' => $completed,
]);