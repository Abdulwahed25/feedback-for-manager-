<?php
/* =============================================
   daily/save_note.php
   Worker saves or updates today's daily note
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionWorker();
verifyCsrfToken();
checkRateLimit('save_note', 60, 3600);

$noteDate  = getPostString('note_date', 10);
$notes     = getPostString('notes', 3000);
$customers = json_decode($_POST['customers'] ?? '[]', true);
$quotations= json_decode($_POST['quotations'] ?? '[]', true);

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $noteDate)) { sendError('Invalid date format.'); }
if ($noteDate > date('Y-m-d')) { sendError('You cannot submit notes for a future date.'); }
if (empty(trim($notes))) { sendError('Additional notes are required.'); }
if (!is_array($customers))  { $customers  = []; }
if (!is_array($quotations)) { $quotations = []; }
if (count($customers)  > 20) { sendError('Too many customer entries.'); }
if (count($quotations) > 20) { sendError('Too many quotation entries.'); }

// Sanitize customers
$cleanCustomers = [];
foreach ($customers as $c) {
    $cleanCustomers[] = [
        'name'    => mb_substr(trim((string)($c['name']    ?? '')), 0, 200),
        'problem' => mb_substr(trim((string)($c['problem'] ?? '')), 0, 1000),
    ];
}

// Sanitize quotations
$cleanQuotations = [];
foreach ($quotations as $q) {
    $val = filter_var($q['value'] ?? '', FILTER_VALIDATE_FLOAT);
    $cleanQuotations[] = [
        'name'  => mb_substr(trim((string)($q['name'] ?? '')), 0, 200),
        'value' => ($val !== false && $val >= 0 && $val <= 999999999.99) ? $val : null,
    ];
}

try {
    $db = getDB();
    $db->beginTransaction();

    // Upsert daily note
    $db->prepare(
        'INSERT INTO daily_notes (worker_id, note_date, notes)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE notes = VALUES(notes), updated_at = NOW()'
    )->execute([$sessionUser['id'], $noteDate, $notes]);

    // Get note ID
    $noteStmt = $db->prepare('SELECT id FROM daily_notes WHERE worker_id = ? AND note_date = ? LIMIT 1');
    $noteStmt->execute([$sessionUser['id'], $noteDate]);
    $noteId = (int)$noteStmt->fetch()['id'];

    // Replace customers
    $db->prepare('DELETE FROM daily_note_customers WHERE note_id = ?')->execute([$noteId]);
    $cStmt = $db->prepare('INSERT INTO daily_note_customers (note_id, customer_name, problem) VALUES (?, ?, ?)');
    foreach ($cleanCustomers as $c) {
        $cStmt->execute([$noteId, $c['name'] ?: null, $c['problem'] ?: null]);
    }

    // Replace quotations
    $db->prepare('DELETE FROM daily_note_quotations WHERE note_id = ?')->execute([$noteId]);
    $qStmt = $db->prepare('INSERT INTO daily_note_quotations (note_id, customer_name, value_sar) VALUES (?, ?, ?)');
    foreach ($cleanQuotations as $q) {
        $qStmt->execute([$noteId, $q['name'] ?: null, $q['value']]);
    }

    $db->commit();

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[Save Note Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['message' => 'Note saved successfully.', 'note_id' => $noteId]);