<?php
/* =============================================
   daily/get_monthly_notes.php
   Admin sees monthly overview + worker performance
   ============================================= */

require_once '../config.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendError('Method not allowed.', 405); }
setSecurityHeaders();
requireSessionAdmin();

$month = $_GET['month'] ?? date('Y-m');
if (!preg_match('/^\d{4}-\d{2}$/', $month)) { sendError('Invalid month format.'); }

$year  = (int) substr($month, 0, 4);
$mon   = (int) substr($month, 5, 2);
$daysInMonth = cal_days_in_month(CAL_GREGORIAN, $mon, $year);
$firstDay = "$year-" . str_pad($mon, 2, '0', STR_PAD_LEFT) . "-01";
$lastDay  = "$year-" . str_pad($mon, 2, '0', STR_PAD_LEFT) . "-$daysInMonth";

// Only count Sunday-Thursday as working days
$workingDays = [];
for ($d = 1; $d <= $daysInMonth; $d++) {
    $date    = "$year-" . str_pad($mon, 2, '0', STR_PAD_LEFT) . "-" . str_pad($d, 2, '0', STR_PAD_LEFT);
    $weekday = (int) date('w', strtotime($date));
    if ($weekday >= 0 && $weekday <= 4) { // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
        $workingDays[] = $date;
    }
}
$totalWorkingDays = count($workingDays);

try {
    $db = getDB();

    // Get all workers
    $workerStmt = $db->prepare('SELECT id, name, email FROM users WHERE role = "worker" ORDER BY name ASC');
    $workerStmt->execute();
    $workers = $workerStmt->fetchAll();

    // Get all notes for the month
    $notesStmt = $db->prepare(
        'SELECT dn.worker_id, dn.note_date, dn.notes,
            (SELECT COUNT(*) FROM daily_note_customers  WHERE note_id = dn.id) AS customer_count,
            (SELECT COUNT(*) FROM daily_note_quotations WHERE note_id = dn.id) AS quotation_count,
            (SELECT SUM(value_sar) FROM daily_note_quotations WHERE note_id = dn.id) AS total_value
         FROM daily_notes dn
         WHERE dn.note_date BETWEEN ? AND ?
         ORDER BY dn.note_date ASC'
    );
    $notesStmt->execute([$firstDay, $lastDay]);
    $allNotes = $notesStmt->fetchAll();

    // Build notes map: worker_id => [date => note]
    $notesMap = [];
    foreach ($allNotes as $note) {
        $notesMap[$note['worker_id']][$note['note_date']] = $note;
    }

    // Build performance per worker
    $performance = [];
    foreach ($workers as $worker) {
        $wid       = $worker['id'];
        $submitted = 0;
        $missed    = 0;
        $notes     = $notesMap[$wid] ?? [];

        foreach ($workingDays as $day) {
            if ($day > date('Y-m-d')) break; // don't count future days
            if (isset($notes[$day])) {
                $submitted++;
            } else {
                $missed++;
            }
        }

        $totalPast = $submitted + $missed;
        $rate      = $totalPast > 0 ? round(($submitted / $totalPast) * 100) : null;

        $performance[] = [
            'worker_id'    => $wid,
            'worker_name'  => $worker['name'],
            'worker_email' => $worker['email'],
            'submitted'    => $submitted,
            'missed'       => $missed,
            'rate'         => $rate,
            'notes_by_date'=> $notes,
        ];
    }

    // Get available months
    $monthsStmt = $db->query("SELECT DISTINCT DATE_FORMAT(note_date, '%Y-%m') AS month FROM daily_notes ORDER BY month DESC LIMIT 12");
    $months = array_column($monthsStmt->fetchAll(), 'month');

} catch (PDOException $e) {
    error_log('[Get Monthly Notes Error] ' . $e->getMessage());
    sendError('A server error occurred.', 500);
}

sendSuccess([
    'month'            => $month,
    'working_days'     => $workingDays,
    'total_working'    => $totalWorkingDays,
    'performance'      => $performance,
    'available_months' => $months,
]);