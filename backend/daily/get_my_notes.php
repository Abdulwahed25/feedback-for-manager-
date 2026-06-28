<?php
/* =============================================
   daily/get_my_notes.php
   Returns worker's own daily notes
   ============================================= */

require_once '../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
$sessionUser = requireSessionWorker();

try {
    $db = getDB();

    $todayStmt = $db->prepare('SELECT * FROM daily_notes WHERE worker_id = ? AND note_date = CURDATE() LIMIT 1');
    $todayStmt->execute([$sessionUser['id']]);
    $todayNote = $todayStmt->fetch();

    $historyStmt = $db->prepare('SELECT * FROM daily_notes WHERE worker_id = ? ORDER BY note_date DESC LIMIT 30');
    $historyStmt->execute([$sessionUser['id']]);
    $history = $historyStmt->fetchAll();

} catch (PDOException $e) {
    error_log('[Get My Notes Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['today' => $todayNote ?: null, 'history' => $history]);