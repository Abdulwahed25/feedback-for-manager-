<?php
/* =============================================
   email_helper.php
   Shared email functions used by all PHP files
   ============================================= */

require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

define('MAIL_FROM',      'lightk621@gmail.com');
define('MAIL_FROM_NAME', 'Sales Department Portal');
define('MAIL_PASSWORD',  'ylfs zyql abzw yxzt');
define('PORTAL_URL',     'http://localhost/sales-department');

function sendEmail(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody = ''): bool {
    try {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = MAIL_FROM;
        $mail->Password   = MAIL_PASSWORD;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $htmlBody;
        $mail->AltBody = $textBody ?: strip_tags($htmlBody);
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('[Email Error] ' . $e->getMessage());
        return false;
    }
}

function emailHeader(string $title, string $subtitle = ''): string {
    $sub = $subtitle ? "<p style='color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:14px;'>{$subtitle}</p>" : '';
    return "<!DOCTYPE html><html><head><meta charset='UTF-8'/></head>
<body style='margin:0;padding:0;background:#f5f2fd;font-family:Arial,sans-serif;'>
<table width='100%' cellpadding='0' cellspacing='0' style='background:#f5f2fd;padding:32px 16px;'>
<tr><td align='center'>
<table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%;'>
<tr><td style='background:linear-gradient(135deg,#2d1b69,#5d3bb5);border-radius:12px 12px 0 0;padding:32px;text-align:center;'>
<div style='display:inline-block;background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 16px;margin-bottom:16px;'>
<span style='color:white;font-size:13px;font-weight:600;letter-spacing:1px;'>SALES DEPARTMENT PORTAL</span>
</div>
<h1 style='color:white;margin:0;font-size:22px;font-weight:700;'>{$title}</h1>{$sub}
</td></tr>
<tr><td style='background:white;padding:32px;'>";
}

function emailFooter(): string {
    return "</td></tr>
<tr><td style='background:#f5f2fd;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;'>
<p style='margin:0;font-size:12px;color:#9a9ab0;'>Sales Department Portal &mdash; Internal use only.</p>
</td></tr>
</table></td></tr></table></body></html>";
}

function emailButton(string $url, string $label): string {
    return "<table width='100%' cellpadding='0' cellspacing='0' style='margin-top:24px;'>
<tr><td align='center'>
<a href='{$url}' style='display:inline-block;background:#5d3bb5;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;'>{$label}</a>
</td></tr></table>";
}

function emailInfoBox(string $label, string $value, string $label2 = '', string $value2 = ''): string {
    $right = $label2 ? "<td style='padding:16px 20px;text-align:right;'>
<p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>{$label2}</p>
<p style='margin:0;font-size:14px;color:#5c5c7a;'>{$value2}</p></td>" : '';
    return "<table width='100%' cellpadding='0' cellspacing='0' style='background:#f5f2fd;border-radius:8px;margin-bottom:24px;'>
<tr><td style='padding:16px 20px;'>
<p style='margin:0 0 4px;font-size:11px;font-weight:600;color:#9a9ab0;text-transform:uppercase;letter-spacing:1px;'>{$label}</p>
<p style='margin:0;font-size:16px;font-weight:700;color:#1a1a2e;'>{$value}</p>
</td>{$right}</tr></table>";
}