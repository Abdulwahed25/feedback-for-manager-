<?php
require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
requireSessionAdmin();

$date = $_GET['date'] ?? date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { sendError('Invalid date.'); }

try {
    $db = getDB();

    $workerStmt = $db->prepare('SELECT id, name, email FROM users WHERE role = "worker" ORDER BY name ASC');
    $workerStmt->execute();
    $workers = $workerStmt->fetchAll();

    $notesStmt = $db->prepare(
        'SELECT dn.*, u.name AS worker_name,
            (SELECT COUNT(*) FROM daily_note_customers  WHERE note_id = dn.id) AS customer_count,
            (SELECT COUNT(*) FROM daily_note_quotations WHERE note_id = dn.id) AS quotation_count,
            (SELECT SUM(value_sar) FROM daily_note_quotations WHERE note_id = dn.id) AS total_value,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT("name", customer_name, "problem", problem))
             FROM daily_note_customers WHERE note_id = dn.id) AS customers,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT("name", customer_name, "value", value_sar))
             FROM daily_note_quotations WHERE note_id = dn.id) AS quotations
         FROM daily_notes dn
         JOIN users u ON u.id = dn.worker_id
         WHERE dn.note_date = ?
         ORDER BY u.name ASC'
    );
    $notesStmt->execute([$date]);
    $notes = $notesStmt->fetchAll();
    foreach ($notes as &$note) {
        $note['customers']  = json_decode($note['customers']  ?? '[]', true) ?: [];
        $note['quotations'] = json_decode($note['quotations'] ?? '[]', true) ?: [];
    }

    $datesStmt = $db->query('SELECT DISTINCT note_date FROM daily_notes ORDER BY note_date DESC LIMIT 30');
    $dates = array_column($datesStmt->fetchAll(), 'note_date');

    $statsStmt = $db->prepare(
        'SELECT
            COUNT(DISTINCT dn.id) AS submitted,
            (SELECT COUNT(*) FROM daily_note_customers  c JOIN daily_notes n ON n.id = c.note_id WHERE n.note_date = ?) AS total_customers,
            (SELECT COUNT(*) FROM daily_note_quotations q JOIN daily_notes n ON n.id = q.note_id WHERE n.note_date = ?) AS total_quotations,
            (SELECT SUM(q.value_sar) FROM daily_note_quotations q JOIN daily_notes n ON n.id = q.note_id WHERE n.note_date = ?) AS total_value
         FROM daily_notes dn WHERE dn.note_date = ?'
    );
    $statsStmt->execute([$date, $date, $date, $date]);
    $stats = $statsStmt->fetch();

} catch (PDOException $e) {
    error_log('[Get All Notes Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['date' => $date, 'workers' => $workers, 'notes' => $notes, 'dates' => $dates, 'stats' => $stats]);