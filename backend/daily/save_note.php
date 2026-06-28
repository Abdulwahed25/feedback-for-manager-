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

$noteDate     = getPostString('note_date', 10);
$newCustomer  = filter_var($_POST['new_customer']  ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
$customerName = getPostString('customer_name', 200);
$newQuotation = filter_var($_POST['new_quotation'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
$quotationRaw = $_POST['quotation_value'] ?? '';
$notes        = getPostString('notes', 3000);

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $noteDate)) { sendError('Invalid date format.'); }
if ($noteDate > date('Y-m-d')) { sendError('You cannot submit notes for a future date.'); }

$quotationValue = null;
if (!empty($quotationRaw)) {
    $quotationValue = filter_var($quotationRaw, FILTER_VALIDATE_FLOAT);
    if ($quotationValue === false || $quotationValue < 0 || $quotationValue > 999999999.99) {
        sendError('Invalid quotation value.');
    }
}

if (!$newCustomer)  { $customerName  = null; }
if (!$newQuotation) { $quotationValue = null; }

try {
    $db = getDB();
    $db->prepare(
        'INSERT INTO daily_notes
            (worker_id, note_date, new_customer, customer_name, new_quotation, quotation_value, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            new_customer    = VALUES(new_customer),
            customer_name   = VALUES(customer_name),
            new_quotation   = VALUES(new_quotation),
            quotation_value = VALUES(quotation_value),
            notes           = VALUES(notes),
            updated_at      = NOW()'
    )->execute([$sessionUser['id'], $noteDate, $newCustomer, $customerName, $newQuotation, $quotationValue, $notes]);

} catch (PDOException $e) {
    error_log('[Save Note Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['message' => 'Note saved successfully.', 'date' => $noteDate]);