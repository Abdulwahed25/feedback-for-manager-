<?php
/* =============================================
   feedback/get_feedback.php
   Returns feedback for a task — admin only
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionAdmin();

$taskId = isset($_GET['task_id']) ? (int) $_GET['task_id'] : 0;
if ($taskId <= 0) { sendError('Invalid task ID.', 400); }

try {
    $db = getDB();

    // Security: verify this task belongs to the requesting admin (IDOR prevention)
    $taskStmt = $db->prepare('SELECT id FROM tasks WHERE id = ? AND created_by = ? LIMIT 1');
    $taskStmt->execute([$taskId, $sessionUser['id']]);
    if (!$taskStmt->fetch()) { sendError('Task not found.', 404); }

    // Get all submissions with worker info
    $stmt = $db->prepare(
        'SELECT f.id, f.submitted_at,
                u.name AS worker_name, u.email AS worker_email
         FROM feedback f
         JOIN users u ON u.id = f.worker_id
         WHERE f.task_id = ?
         ORDER BY f.submitted_at ASC'
    );
    $stmt->execute([$taskId]);
    $submissions = $stmt->fetchAll();

    // Get all answers for this task
    $ansStmt = $db->prepare(
        'SELECT fa.feedback_id, tf.label AS question, fa.answer
         FROM feedback_answers fa
         JOIN task_fields tf ON tf.id = fa.field_id
         WHERE tf.task_id = ?'
    );
    $ansStmt->execute([$taskId]);
    $answers = $ansStmt->fetchAll();

    // Group answers by feedback_id
    $answersMap = [];
    foreach ($answers as $a) {
        $answersMap[$a['feedback_id']][] = [
            'question' => $a['question'],
            'answer'   => $a['answer'],
        ];
    }

    foreach ($submissions as &$sub) {
        $sub['answers'] = $answersMap[$sub['id']] ?? [];
    }
    unset($sub);

} catch (PDOException $e) {
    error_log('[Get Feedback Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['submissions' => $submissions]);