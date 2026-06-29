<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
$sessionUser = requireSessionWorker();

try {
    $db = getDB();

    $todayStmt = $db->prepare('SELECT * FROM daily_notes WHERE worker_id = ? AND note_date = CURDATE() LIMIT 1');
    $todayStmt->execute([$sessionUser['id']]);
    $today = $todayStmt->fetch();

    if ($today) {
        $cStmt = $db->prepare('SELECT customer_name AS name, problem FROM daily_note_customers WHERE note_id = ?');
        $cStmt->execute([$today['id']]);
        $today['customers'] = $cStmt->fetchAll();

        $qStmt = $db->prepare('SELECT customer_name AS name, value_sar AS value FROM daily_note_quotations WHERE note_id = ?');
        $qStmt->execute([$today['id']]);
        $today['quotations'] = $qStmt->fetchAll();
    }

    $historyStmt = $db->prepare(
        'SELECT dn.*,
            (SELECT COUNT(*) FROM daily_note_customers  WHERE note_id = dn.id) AS customer_count,
            (SELECT COUNT(*) FROM daily_note_quotations WHERE note_id = dn.id) AS quotation_count,
            (SELECT SUM(value_sar) FROM daily_note_quotations WHERE note_id = dn.id) AS total_value
         FROM daily_notes dn WHERE dn.worker_id = ? ORDER BY dn.note_date DESC LIMIT 30'
    );
    $historyStmt->execute([$sessionUser['id']]);
    $history = $historyStmt->fetchAll();

} catch (PDOException $e) {
    error_log('[Get My Notes Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['today' => $today ?: null, 'history' => $history]);