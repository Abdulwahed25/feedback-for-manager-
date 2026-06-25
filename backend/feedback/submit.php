<?php
/* =============================================
   feedback/submit.php
   Worker submits feedback on a task
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();

// ---- Auth: workers only ----
$sessionUser = requireSessionWorker();
verifyCsrfToken();

// ---- Rate limiting: prevent spam submissions ----
checkRateLimit('feedback_submit', 20, 3600);

// ---- Validate task ID ----
$taskId = getPostInt('task_id');
if (!$taskId || $taskId <= 0) { sendError('Invalid task ID.'); }

// ---- Validate answers ----
$answersRaw = $_POST['answers'] ?? '';
if (empty($answersRaw)) { sendError('Answers are required.'); }

$answers = json_decode($answersRaw, true);
if (!is_array($answers)) { sendError('Invalid answers format.'); }

try {
    $db = getDB();

    // ---- Verify task exists and is active ----
    $taskStmt = $db->prepare(
        'SELECT id, status FROM tasks WHERE id = ? LIMIT 1'
    );
    $taskStmt->execute([$taskId]);
    $task = $taskStmt->fetch();

    if (!$task) { sendError('Task not found.', 404); }
    if ($task['status'] !== 'active') { sendError('This task is no longer accepting feedback.', 403); }

    // ---- Prevent duplicate submission ----
    // Security: enforce on server side — never rely on client check alone
    $dupStmt = $db->prepare(
        'SELECT id FROM feedback WHERE task_id = ? AND worker_id = ? LIMIT 1'
    );
    $dupStmt->execute([$taskId, $sessionUser['id']]);
    if ($dupStmt->fetch()) {
        sendError('You have already submitted feedback for this task.', 409);
    }

    // ---- Get task fields to validate answers against ----
    $fieldStmt = $db->prepare(
        'SELECT id, label, field_type, is_required FROM task_fields WHERE task_id = ? ORDER BY field_order ASC'
    );
    $fieldStmt->execute([$taskId]);
    $fields = $fieldStmt->fetchAll();

    if (count($fields) === 0) { sendError('This task has no fields.', 400); }

    // ---- Validate each answer ----
    $allowedTypes  = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
    $allowedRating = ['1', '2', '3', '4', '5'];
    $allowedYesNo  = ['Yes', 'No'];
    $cleanAnswers  = [];

    foreach ($fields as $field) {
        $fieldId  = (int) $field['id'];
        $answer   = $answers[$fieldId] ?? '';
        $answer   = mb_substr(trim((string) $answer), 0, 2000);
        $type     = $field['field_type'];
        $required = (bool) $field['is_required'];

        if (!in_array($type, $allowedTypes, true)) continue;

        // Type-specific validation
        if ($type === 'rating' && !empty($answer) && !in_array($answer, $allowedRating, true)) {
            sendError('Invalid rating value.');
        }

        if ($type === 'yesno' && !empty($answer) && !in_array($answer, $allowedYesNo, true)) {
            sendError('Invalid yes/no value.');
        }

        if ($type === 'checkbox' && !empty($answer) && $answer !== 'Confirmed') {
            sendError('Invalid checkbox value.');
        }

        if ($required && empty($answer)) {
            sendError('Please answer all required fields.');
        }

        $cleanAnswers[$fieldId] = $answer;
    }

    // ---- Insert feedback and answers in transaction ----
    $db->beginTransaction();

    $fbStmt = $db->prepare(
        'INSERT INTO feedback (task_id, worker_id) VALUES (?, ?)'
    );
    $fbStmt->execute([$taskId, $sessionUser['id']]);
    $feedbackId = (int) $db->lastInsertId();

    $ansStmt = $db->prepare(
        'INSERT INTO feedback_answers (feedback_id, field_id, answer) VALUES (?, ?, ?)'
    );

    foreach ($cleanAnswers as $fieldId => $answer) {
        $ansStmt->execute([$feedbackId, $fieldId, $answer]);
    }

    $db->commit();

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[Submit Feedback Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

sendSuccess(['feedback_id' => $feedbackId], 201);