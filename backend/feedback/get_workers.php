<?php
/* =============================================
   users/get_workers.php
   Returns list of all workers — admin only
   ============================================= */

require_once '../../backend/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }

setSecurityHeaders();
requireSessionAdmin();

try {
    $db   = getDB();
    $stmt = $db->prepare(
        'SELECT id, name, email, created_at
         FROM users
         WHERE role = "worker"
         ORDER BY name ASC'
    );
    $stmt->execute();
    $workers = $stmt->fetchAll();

} catch (PDOException $e) {
    error_log('[Get Workers Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess(['workers' => $workers]);