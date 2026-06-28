<?php
/* =============================================
   cron/daily_reminder.php
   Run every minute via cron:
   * * * * * /path/to/php /path/to/cron/daily_reminder.php
   ============================================= */

define('RUNNING_AS_CRON', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../email_helper.php';

$currentTime = date('H:i');
$currentDay  = (int) date('w');

try {
    $db = getDB();

    $stmt = $db->query('SELECT rs.*, u.name AS admin_name, u.email AS admin_email FROM reminder_settings rs JOIN users u ON u.id = rs.admin_id');
    $allSettings = $stmt->fetchAll();

    if (empty($allSettings)) {
        $allSettings = [['reminder_time' => '15:00:00', 'reminder_days' => '0,1,2,3,4', 'email_digest' => 1, 'admin_id' => null, 'admin_name' => null, 'admin_email' => null]];
    }

    foreach ($allSettings as $setting) {
        $reminderTime = substr($setting['reminder_time'], 0, 5);
        $allowedDays  = array_map('intval', explode(',', $setting['reminder_days']));

        if ($currentTime !== $reminderTime) continue;
        if (!in_array($currentDay, $allowedDays)) continue;

        // Workers who have NOT submitted today
        $workerStmt = $db->prepare(
            'SELECT u.id, u.name, u.email FROM users u
             WHERE u.role = "worker"
             AND NOT EXISTS (SELECT 1 FROM daily_notes dn WHERE dn.worker_id = u.id AND dn.note_date = CURDATE())'
        );
        $workerStmt->execute();
        $pendingWorkers = $workerStmt->fetchAll();

        $todayDate = date('d M Y');
        $dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        $todayName = $dayNames[$currentDay];

        foreach ($pendingWorkers as $worker) {
            $noteLink = PORTAL_URL . '/pages/worker-daily-note.html';

            $html = emailHeader('Daily Note Reminder', "Please submit your notes for today")
                . "<p style='color:#1a1a2e;font-size:15px;margin:0 0 8px;'>Hi <strong>" . htmlspecialchars($worker['name']) . "</strong>,</p>
                   <p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>
                       This is your daily reminder to submit your sales notes for today. It only takes a few minutes.
                   </p>"
                . emailInfoBox('Today', "{$todayName}, {$todayDate}", 'Status', 'Not submitted yet')
                . "<div style='background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:14px 16px;margin-bottom:20px;'>
                       <p style='margin:0;color:#b54708;font-size:13px;font-weight:600;'>Please submit your daily notes before the end of the day.</p>
                   </div>"
                . emailButton($noteLink, 'Submit My Daily Notes')
                . emailFooter();

            sendEmail($worker['email'], $worker['name'], "[Sales Department] Daily Notes Reminder — {$todayDate}", $html);
        }

        // Email digest to manager
        if ($setting['email_digest'] && $setting['admin_email']) {
            $notesStmt = $db->prepare(
                'SELECT dn.*, u.name AS worker_name FROM daily_notes dn
                 JOIN users u ON u.id = dn.worker_id
                 WHERE dn.note_date = CURDATE() ORDER BY u.name ASC'
            );
            $notesStmt->execute();
            $submitted = $notesStmt->fetchAll();
            $pending   = count($pendingWorkers);

            $rows = '';
            foreach ($submitted as $i => $note) {
                $bg = $i % 2 === 0 ? '#f9f8ff' : '#ffffff';
                $rows .= "<tr style='background:{$bg};'>
                    <td style='padding:10px 16px;border-bottom:1px solid #ede8fa;font-size:13px;font-weight:600;'>" . htmlspecialchars($note['worker_name']) . "</td>
                    <td style='padding:10px 16px;border-bottom:1px solid #ede8fa;font-size:13px;text-align:center;color:" . ($note['new_customer'] ? '#027a48' : '#9a9ab0') . ";'>" . ($note['new_customer'] ? 'Yes' : 'No') . "</td>
                    <td style='padding:10px 16px;border-bottom:1px solid #ede8fa;font-size:13px;text-align:center;color:" . ($note['new_quotation'] ? '#027a48' : '#9a9ab0') . ";'>" . ($note['new_quotation'] ? 'Yes' : 'No') . "</td>
                    <td style='padding:10px 16px;border-bottom:1px solid #ede8fa;font-size:13px;text-align:center;'>" . ($note['quotation_value'] ? 'SAR ' . number_format($note['quotation_value'], 2) : '--') . "</td>
                </tr>";
            }

            $html = emailHeader('Daily Sales Notes Digest', "{$todayName}, {$todayDate}")
                . "<p style='color:#1a1a2e;font-size:15px;margin:0 0 8px;'>Hi <strong>" . htmlspecialchars($setting['admin_name']) . "</strong>,</p>
                   <p style='color:#5c5c7a;font-size:14px;margin:0 0 24px;line-height:1.6;'>Here is your team's daily notes status as of " . date('h:i A') . ".</p>
                   <table width='100%' cellpadding='0' cellspacing='0' style='background:#f5f2fd;border-radius:8px;margin-bottom:24px;'>
                       <tr>
                           <td style='padding:16px 20px;text-align:center;border-right:1px solid #ede8fa;'>
                               <p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;'>Submitted</p>
                               <p style='margin:0;font-size:24px;font-weight:800;color:#027a48;'>" . count($submitted) . "</p>
                           </td>
                           <td style='padding:16px 20px;text-align:center;'>
                               <p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;'>Pending</p>
                               <p style='margin:0;font-size:24px;font-weight:800;color:" . ($pending > 0 ? '#b54708' : '#027a48') . ";'>{$pending}</p>
                           </td>
                       </tr>
                   </table>"
                . (count($submitted) > 0 ? "
                   <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #ede8fa;border-radius:8px;overflow:hidden;margin-bottom:24px;'>
                       <thead><tr style='background:#f5f2fd;'>
                           <th style='padding:10px 16px;text-align:left;font-size:11px;color:#9a9ab0;'>Worker</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;color:#9a9ab0;'>New Customer</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;color:#9a9ab0;'>Quotation</th>
                           <th style='padding:10px 16px;text-align:center;font-size:11px;color:#9a9ab0;'>Value (SAR)</th>
                       </tr></thead>
                       <tbody>{$rows}</tbody>
                   </table>" : '')
                . emailButton(PORTAL_URL . '/pages/admin-daily-notes.html', 'View Full Notes in Portal')
                . emailFooter();

            sendEmail($setting['admin_email'], $setting['admin_name'], "[Sales Department] Daily Notes Digest — {$todayDate}", $html);
        }
    }

} catch (PDOException $e) {
    error_log('[Daily Reminder Error] ' . $e->getMessage());
}