<?php
/* =============================================
   feedback/submit.php
   Worker submits feedback — security hardened
   Uses email_helper.php for sending emails
   ============================================= */

require_once '../config.php';
require_once '../email_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionWorker();
verifyCsrfToken();
checkRateLimit('feedback_submit', 20, 3600);

$taskId = getPostInt('task_id');
if (!$taskId || $taskId <= 0) { sendError('Invalid task ID.'); }

$answersRaw = $_POST['answers'] ?? '';
if (empty($answersRaw)) { sendError('Answers are required.'); }

$answers = json_decode($answersRaw, true);
if (!is_array($answers)) { sendError('Invalid answers format.'); }

try {
    $db = getDB();

    // Get task and manager info
    $taskStmt = $db->prepare(
        'SELECT t.id, t.title, t.status, t.created_by,
                u.name AS manager_name, u.email AS manager_email
         FROM tasks t
         JOIN users u ON u.id = t.created_by
         WHERE t.id = ? LIMIT 1'
    );
    $taskStmt->execute([$taskId]);
    $task = $taskStmt->fetch();

    if (!$task) { sendError('Task not found.', 404); }
    if ($task['status'] !== 'active') { sendError('This task is no longer accepting feedback.', 403); }

    // Prevent duplicate submission
    $dupStmt = $db->prepare('SELECT id FROM feedback WHERE task_id = ? AND worker_id = ? LIMIT 1');
    $dupStmt->execute([$taskId, $sessionUser['id']]);
    if ($dupStmt->fetch()) { sendError('You have already submitted feedback for this task.', 409); }

    // Get task fields
    $fieldStmt = $db->prepare(
        'SELECT id, label, field_type, is_required
         FROM task_fields
         WHERE task_id = ?
         ORDER BY field_order ASC'
    );
    $fieldStmt->execute([$taskId]);
    $fields = $fieldStmt->fetchAll();
    if (count($fields) === 0) { sendError('This task has no fields.', 400); }

    // Validate and clean answers
    $allowedTypes  = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
    $allowedRating = ['1', '2', '3', '4', '5'];
    $allowedYesNo  = ['Yes', 'No'];
    $cleanAnswers   = [];
    $labeledAnswers = [];

    foreach ($fields as $field) {
        $fieldId  = (int) $field['id'];
        $answer   = mb_substr(trim((string)($answers[$fieldId] ?? '')), 0, 2000);
        $type     = $field['field_type'];
        $required = (bool) $field['is_required'];

        if (!in_array($type, $allowedTypes, true)) continue;
        if ($type === 'rating'   && !empty($answer) && !in_array($answer, $allowedRating, true)) { sendError('Invalid rating value.'); }
        if ($type === 'yesno'    && !empty($answer) && !in_array($answer, $allowedYesNo, true))  { sendError('Invalid yes/no value.'); }
        if ($type === 'checkbox' && !empty($answer) && $answer !== 'Confirmed')                   { sendError('Invalid checkbox value.'); }
        if ($required && empty($answer)) { sendError('Please answer all required fields.'); }

        $cleanAnswers[$fieldId] = $answer;
        $labeledAnswers[] = ['question' => $field['label'], 'answer' => $answer ?: '--'];
    }

    // Insert feedback in transaction
    $db->beginTransaction();
    $db->prepare('INSERT INTO feedback (task_id, worker_id) VALUES (?, ?)')->execute([$taskId, $sessionUser['id']]);
    $feedbackId = (int) $db->lastInsertId();
    $ansStmt = $db->prepare('INSERT INTO feedback_answers (feedback_id, field_id, answer) VALUES (?, ?, ?)');
    foreach ($cleanAnswers as $fid => $ans) { $ansStmt->execute([$feedbackId, $fid, $ans]); }
    $db->commit();

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[Submit Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

// Build answers table for email
$answersHtml = '';
foreach ($labeledAnswers as $i => $item) {
    $bg = $i % 2 === 0 ? '#f9f8ff' : '#ffffff';
    $answersHtml .= "
    <tr style='background:{$bg};'>
        <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;color:#5c5c7a;font-size:13px;font-weight:600;width:40%;vertical-align:top;'>
            " . htmlspecialchars($item['question']) . "
        </td>
        <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;color:#1a1a2e;font-size:14px;vertical-align:top;'>
            " . htmlspecialchars($item['answer']) . "
        </td>
    </tr>";
}

$portalLink  = PORTAL_URL . '/pages/admin-task-detail.html?id=' . $taskId;
$submittedAt = date('d M Y, h:i A');

// Build and send email to manager
$html = emailHeader('New Feedback Received', 'A team member has submitted their feedback')
    . "<p style='color:#1a1a2e;font-size:15px;margin:0 0 8px;'>Hi <strong>"
        . htmlspecialchars($task['manager_name']) . "</strong>,</p>
       <p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>
           <strong>" . htmlspecialchars($sessionUser['name']) . "</strong>
           (" . htmlspecialchars($sessionUser['email']) . ")
           has submitted feedback on the task below.
       </p>"
    . emailInfoBox('Task', htmlspecialchars($task['title']), 'Submitted', $submittedAt)
    . "<p style='font-size:12px;font-weight:700;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;'>Feedback Summary</p>
       <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #ede8fa;border-radius:8px;overflow:hidden;margin-bottom:28px;'>
           {$answersHtml}
       </table>"
    . emailButton($portalLink, 'View All Responses in Portal')
    . emailFooter();

sendEmail(
    $task['manager_email'],
    $task['manager_name'],
    "[Sales Department] New Feedback: {$task['title']} from {$sessionUser['name']}",
    $html,
    "Hi {$task['manager_name']},\n\n{$sessionUser['name']} submitted feedback on: {$task['title']}\nSubmitted: {$submittedAt}\n\nView in portal: {$portalLink}"
);

sendSuccess(['feedback_id' => $feedbackId], 201);