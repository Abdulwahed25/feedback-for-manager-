<?php
/* =============================================
   cron/send_auto_reminders.php
   Run every hour via cron job.
   Sends reminder to workers who have not responded
   after 24 hours of task creation.

   Cron entry (run every hour):
   0 * * * * /path/to/php /path/to/cron/send_auto_reminders.php
   ============================================= */

define('RUNNING_AS_CRON', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../email_helper.php';

echo "[" . date('Y-m-d H:i:s') . "] Auto reminder job started\n";

try {
    $db = getDB();

    // Find all active tasks older than 24 hours
    // where workers have NOT submitted feedback
    // and have NOT already received an auto reminder in the last 24 hours
    $stmt = $db->prepare("
        SELECT
            t.id         AS task_id,
            t.title      AS task_title,
            u.id         AS worker_id,
            u.name       AS worker_name,
            u.email      AS worker_email,
            m.name       AS manager_name,
            t.created_at AS task_created_at
        FROM tasks t
        JOIN users m ON m.id = t.created_by
        CROSS JOIN users u
        WHERE u.role = 'worker'
          AND t.status = 'active'
          AND t.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND NOT EXISTS (
              SELECT 1 FROM feedback f
              WHERE f.task_id = t.id AND f.worker_id = u.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM auto_reminders ar
              WHERE ar.task_id = t.id
                AND ar.worker_id = u.id
                AND ar.sent_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          )
        ORDER BY t.created_at ASC
    ");
    $stmt->execute();
    $pending = $stmt->fetchAll();

    echo "[" . date('Y-m-d H:i:s') . "] Found " . count($pending) . " reminders to send\n";

    foreach ($pending as $row) {
        $feedbackLink = PORTAL_URL . '/pages/worker-feedback.html?task=' . $row['task_id'];

        $html = emailHeader('Reminder: Feedback Still Pending', 'Please complete your feedback')
            . "<p style='color:#1a1a2e;font-size:15px;margin:0 0 8px;'>Hi <strong>" . htmlspecialchars($row['worker_name']) . "</strong>,</p>
               <p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>
                   You have a pending feedback task from <strong>" . htmlspecialchars($row['manager_name']) . "</strong>
                   that has been waiting for your response. Please take a moment to complete it.
               </p>"
            . emailInfoBox('Pending Task', htmlspecialchars($row['task_title']), 'Assigned', date('d M Y', strtotime($row['task_created_at'])))
            . "<div style='background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 16px;margin-bottom:20px;'>
                   <p style='margin:0;color:#b54708;font-size:13px;font-weight:600;'>
                       Your manager is waiting for your notes. Please submit your feedback as soon as possible.
                   </p>
               </div>"
            . emailButton($feedbackLink, 'Submit My Feedback Now')
            . emailFooter();

        $sent = sendEmail(
            $row['worker_email'],
            $row['worker_name'],
            '[Action Required] Feedback Still Pending: ' . $row['task_title'],
            $html
        );

        if ($sent) {
            // Log the auto reminder
            $db->prepare('INSERT INTO auto_reminders (task_id, worker_id, sent_at) VALUES (?, ?, NOW())')
               ->execute([$row['task_id'], $row['worker_id']]);
            echo "[" . date('Y-m-d H:i:s') . "] Reminder sent to {$row['worker_email']} for task: {$row['task_title']}\n";
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] FAILED to send to {$row['worker_email']}\n";
        }
    }

} catch (PDOException $e) {
    error_log('[Auto Reminder Error] ' . $e->getMessage());
    echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
}

echo "[" . date('Y-m-d H:i:s') . "] Auto reminder job finished\n";