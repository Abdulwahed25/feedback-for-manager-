<?php
/* =============================================
   daily/get_all_notes.php
   Manager sees all workers' daily notes
   ============================================= */

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
        'SELECT dn.*, u.name AS worker_name
         FROM daily_notes dn
         JOIN users u ON u.id = dn.worker_id
         WHERE dn.note_date = ?
         ORDER BY u.name ASC'
    );
    $notesStmt->execute([$date]);
    $notes = $notesStmt->fetchAll();

    $datesStmt = $db->query('SELECT DISTINCT note_date FROM daily_notes ORDER BY note_date DESC LIMIT 30');
    $dates = array_column($datesStmt->fetchAll(), 'note_date');

    $statsStmt = $db->prepare(
        'SELECT COUNT(*) AS submitted,
                SUM(new_customer) AS new_customers,
                SUM(new_quotation) AS new_quotations,
                SUM(quotation_value) AS total_value
         FROM daily_notes WHERE note_date = ?'
    );
    $statsStmt->execute([$date]);
    $stats = $statsStmt->fetch();

} catch (PDOException $e) {
    error_log('[Get All Notes Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['date' => $date, 'workers' => $workers, 'notes' => $notes, 'dates' => $dates, 'stats' => $stats]);