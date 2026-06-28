<?php
/* =============================================
   cron/daily_digest.php
   Run every day at 8 AM via cron job.
   Sends manager a daily summary of team responses.

   Cron entry (run daily at 8 AM):
   0 8 * * * /path/to/php /path/to/cron/daily_digest.php
   ============================================= */

define('RUNNING_AS_CRON', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../email_helper.php';

echo "[" . date('Y-m-d H:i:s') . "] Daily digest job started\n";

try {
    $db = getDB();

    // Get all admins
    $admins = $db->query('SELECT id, name, email FROM users WHERE role = "admin"')->fetchAll();

    foreach ($admins as $admin) {

        // Get active tasks for this admin
        $taskStmt = $db->prepare("
            SELECT
                t.id, t.title, t.created_at,
                COUNT(DISTINCT u.id) AS total_workers,
                COUNT(DISTINCT f.worker_id) AS responded,
                (COUNT(DISTINCT u.id) - COUNT(DISTINCT f.worker_id)) AS pending
            FROM tasks t
            CROSS JOIN users u ON u.role = 'worker'
            LEFT JOIN feedback f ON f.task_id = t.id AND f.worker_id = u.id
            WHERE t.created_by = ? AND t.status = 'active'
            GROUP BY t.id
            ORDER BY t.created_at DESC
        ");
        $taskStmt->execute([$admin['id']]);
        $tasks = $taskStmt->fetchAll();

        if (empty($tasks)) {
            echo "[" . date('Y-m-d H:i:s') . "] No active tasks for {$admin['email']}, skipping\n";
            continue;
        }

        // Calculate overall stats
        $totalWorkers   = $tasks[0]['total_workers'] ?? 0;
        $totalResponded = array_sum(array_column($tasks, 'responded'));
        $totalPending   = array_sum(array_column($tasks, 'pending'));
        $totalExpected  = count($tasks) * $totalWorkers;
        $overallRate    = $totalExpected > 0 ? round(($totalResponded / $totalExpected) * 100) : 0;

        // Build task rows
        $taskRows = '';
        foreach ($tasks as $i => $task) {
            $rate   = $task['total_workers'] > 0 ? round(($task['responded'] / $task['total_workers']) * 100) : 0;
            $color  = $rate >= 80 ? '#027a48' : ($rate >= 40 ? '#b54708' : '#b42318');
            $bg     = $i % 2 === 0 ? '#f9f8ff' : '#ffffff';
            $date   = date('d M Y', strtotime($task['created_at']));

            $taskRows .= "
            <tr style='background:{$bg};'>
                <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;color:#1a1a2e;font-size:14px;font-weight:600;'>
                    " . htmlspecialchars($task['title']) . "
                    <div style='font-size:12px;color:#9a9ab0;font-weight:400;margin-top:2px;'>{$date}</div>
                </td>
                <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;text-align:center;color:#1a1a2e;font-size:14px;'>
                    {$task['responded']} / {$task['total_workers']}
                </td>
                <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;text-align:center;'>
                    <span style='color:{$color};font-weight:700;font-size:14px;'>{$rate}%</span>
                </td>
                <td style='padding:12px 16px;border-bottom:1px solid #ede8fa;text-align:center;'>
                    <span style='background:" . ($task['pending'] > 0 ? '#fff8e1' : '#ecfdf3') . ";
                                 color:" . ($task['pending'] > 0 ? '#b54708' : '#027a48') . ";
                                 padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600;'>
                        {$task['pending']} pending
                    </span>
                </td>
            </tr>";
        }

        $portalLink = PORTAL_URL . '/pages/admin-dashboard.html';

        $html = emailHeader('Daily Team Summary', 'Good morning, ' . htmlspecialchars($admin['name']))
            . "<p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>
                   Here is your team feedback summary for today. You have <strong>" . count($tasks) . " active task(s)</strong> with an overall response rate of
                   <strong style='color:#5d3bb5;'>{$overallRate}%</strong>.
               </p>

               <table width='100%' cellpadding='0' cellspacing='0' style='background:#f5f2fd;border-radius:8px;margin-bottom:24px;'>
                   <tr>
                       <td style='padding:16px 20px;text-align:center;border-right:1px solid #ede8fa;'>
                           <p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Active Tasks</p>
                           <p style='margin:0;font-size:24px;font-weight:800;color:#5d3bb5;'>" . count($tasks) . "</p>
                       </td>
                       <td style='padding:16px 20px;text-align:center;border-right:1px solid #ede8fa;'>
                           <p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Total Responses</p>
                           <p style='margin:0;font-size:24px;font-weight:800;color:#1a1a2e;'>{$totalResponded}</p>
                       </td>
                       <td style='padding:16px 20px;text-align:center;'>
                           <p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Still Pending</p>
                           <p style='margin:0;font-size:24px;font-weight:800;color:" . ($totalPending > 0 ? '#b54708' : '#027a48') . ";'>{$totalPending}</p>
                       </td>
                   </tr>
               </table>

               <p style='font-size:12px;font-weight:700;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;'>Task Breakdown</p>
               <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #ede8fa;border-radius:8px;overflow:hidden;margin-bottom:24px;'>
                   <thead>
                       <tr style='background:#f5f2fd;'>
                           <th style='padding:10px 16px;text-align:left;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Task</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Responses</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Rate</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>Status</th>
                       </tr>
                   </thead>
                   <tbody>{$taskRows}</tbody>
               </table>"
            . emailButton($portalLink, 'Open Portal Dashboard')
            . emailFooter();

        $sent = sendEmail(
            $admin['email'],
            $admin['name'],
            '[Daily Summary] Team Feedback Report - ' . date('d M Y'),
            $html
        );

        if ($sent) {
            echo "[" . date('Y-m-d H:i:s') . "] Daily digest sent to {$admin['email']}\n";
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] FAILED to send digest to {$admin['email']}\n";
        }
    }

} catch (PDOException $e) {
    error_log('[Daily Digest Error] ' . $e->getMessage());
    echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
}

echo "[" . date('Y-m-d H:i:s') . "] Daily digest job finished\n";