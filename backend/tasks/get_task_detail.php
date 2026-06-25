<?php
/* =============================================
   tasks/get_task_detail.php
   Returns full detail of one task including
   all feedback responses — admin only
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();
$sessionUser = requireSessionAdmin();

// ---- Validate task ID ----
$taskId = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($taskId <= 0) {
    sendError('Invalid task ID.', 400);
}

try {
    $db = getDB();

    // ---- Get task — verify it belongs to this admin ----
    // Security: IDOR prevention — always scope queries to the session user
    $stmt = $db->prepare(
        'SELECT id, title, description, status, created_at
         FROM tasks
         WHERE id = ? AND created_by = ?
         LIMIT 1'
    );
    $stmt->execute([$taskId, $sessionUser['id']]);
    $task = $stmt->fetch();

    if (!$task) {
        sendError('Task not found.', 404);
    }

    // ---- Get fields ----
    $fieldStmt = $db->prepare(
        'SELECT id, label, field_type, is_required, field_order
         FROM task_fields
         WHERE task_id = ?
         ORDER BY field_order ASC'
    );
    $fieldStmt->execute([$taskId]);
    $fields = $fieldStmt->fetchAll();

    // ---- Get all feedback submissions ----
    $feedbackStmt = $db->prepare(
        'SELECT f.id, f.submitted_at,
                u.id AS worker_id, u.name AS worker_name, u.email AS worker_email
         FROM feedback f
         JOIN users u ON u.id = f.worker_id
         WHERE f.task_id = ?
         ORDER BY f.submitted_at ASC'
    );
    $feedbackStmt->execute([$taskId]);
    $submissions = $feedbackStmt->fetchAll();

    // ---- Get answers for each submission ----
    $answerStmt = $db->prepare(
        'SELECT fa.feedback_id, fa.field_id, fa.answer
         FROM feedback_answers fa
         JOIN feedback f ON f.id = fa.feedback_id
         WHERE f.task_id = ?'
    );
    $answerStmt->execute([$taskId]);
    $answers = $answerStmt->fetchAll();

    // Group answers by feedback_id
    $answersMap = [];
    foreach ($answers as $a) {
        $answersMap[$a['feedback_id']][] = $a;
    }

    // Attach answers to submissions
    foreach ($submissions as &$sub) {
        $sub['answers'] = $answersMap[$sub['id']] ?? [];
    }
    unset($sub);

    // ---- Get all workers + who has responded ----
    $workerStmt = $db->prepare('SELECT id, name, email FROM users WHERE role = "worker" ORDER BY name ASC');
    $workerStmt->execute();
    $workers = $workerStmt->fetchAll();

    $respondedIds = array_column($submissions, 'worker_id');
    foreach ($workers as &$w) {
        $w['has_responded'] = in_array((int)$w['id'], array_map('intval', $respondedIds));
    }
    unset($w);

} catch (PDOException $e) {
    error_log('[Task Detail Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess([
    'task'        => $task,
    'fields'      => $fields,
    'submissions' => $submissions,
    'workers'     => $workers,
]);