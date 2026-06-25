<?php
/* =============================================
   tasks/create.php
   Creates a new feedback task — security hardened
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed.', 405);
}

setSecurityHeaders();

// ---- Auth: admins only ----
$sessionUser = requireSessionAdmin();

// ---- CSRF verification ----
verifyCsrfToken();

// ---- Input validation ----
$title       = getPostString('title', 200);
$description = getPostString('description', 1000);
$fieldsRaw   = $_POST['fields'] ?? '';

if (empty($title)) {
    sendError('Task title is required.');
}

if (mb_strlen($title) < 3) {
    sendError('Task title is too short.');
}

// ---- Parse and validate fields ----
// Fields are sent as JSON string from the frontend
if (empty($fieldsRaw)) {
    sendError('At least one feedback field is required.');
}

$fields = json_decode($fieldsRaw, true);

if (!is_array($fields) || count($fields) === 0) {
    sendError('Invalid fields data.');
}

if (count($fields) > 20) {
    sendError('Too many fields. Maximum is 20.');
}

$allowedTypes = ['text', 'textarea', 'rating', 'select', 'checkbox', 'yesno'];
$cleanFields  = [];

foreach ($fields as $index => $field) {
    // Validate each field strictly
    if (!is_array($field)) {
        sendError('Invalid field format.');
    }

    $type     = $field['type']     ?? '';
    $label    = mb_substr(trim((string)($field['label'] ?? '')), 0, 300);
    $required = (bool)($field['required'] ?? false);

    if (!in_array($type, $allowedTypes, true)) {
        sendError("Invalid field type: {$type}");
    }

    if (empty($label)) {
        sendError('All fields must have a label.');
    }

    $cleanFields[] = [
        'type'     => $type,
        'label'    => $label,
        'required' => $required,
        'order'    => (int) $index,
    ];
}

// ---- Insert into database ----
try {
    $db = getDB();

    // Use transaction — insert task and all fields atomically
    $db->beginTransaction();

    // Insert task
    $stmt = $db->prepare(
        'INSERT INTO tasks (title, description, created_by, status)
         VALUES (?, ?, ?, "active")'
    );
    $stmt->execute([$title, $description, $sessionUser['id']]);
    $taskId = (int) $db->lastInsertId();

    // Insert fields
    $fieldStmt = $db->prepare(
        'INSERT INTO task_fields (task_id, label, field_type, is_required, field_order)
         VALUES (?, ?, ?, ?, ?)'
    );

    foreach ($cleanFields as $field) {
        $fieldStmt->execute([
            $taskId,
            $field['label'],
            $field['type'],
            $field['required'] ? 1 : 0,
            $field['order'],
        ]);
    }

    $db->commit();

} catch (PDOException $e) {
    $db->rollBack();
    error_log('[Create Task Error] ' . $e->getMessage());
    sendError('A server error occurred. Please try again.', 500);
}

sendSuccess(['task_id' => $taskId], 201);