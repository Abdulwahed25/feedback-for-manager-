<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
$sessionUser = requireSessionWorker();

try {
    $db = getDB();

    $todayStmt = $db->prepare(
        'SELECT dn.*,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT("name", customer_name, "problem", problem))
             FROM daily_note_customers WHERE note_id = dn.id) AS customers,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT("name", customer_name, "value", value_sar))
             FROM daily_note_quotations WHERE note_id = dn.id) AS quotations
         FROM daily_notes dn WHERE dn.worker_id = ? AND dn.note_date = CURDATE() LIMIT 1'
    );
    $todayStmt->execute([$sessionUser['id']]);
    $today = $todayStmt->fetch();
    if ($today) {
        $today['customers']  = json_decode($today['customers']  ?? '[]', true) ?: [];
        $today['quotations'] = json_decode($today['quotations'] ?? '[]', true) ?: [];
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