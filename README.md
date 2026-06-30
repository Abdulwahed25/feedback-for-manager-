# Sales Department Portal

An internal web application built for the Sales Department at Tawuniya to streamline manager-to-team communication, feedback collection, and daily activity tracking. Built during a student internship to replace email-based workflows that were not getting consistent responses from the team.

## The Problem

The sales manager would email tasks and questions to the team via Outlook, but workers were inconsistent about replying, and there was no way to track who had responded, follow up automatically, or see a clear history of submissions. There was also no structured way to track daily sales activity like new customers or quotation requests.

## What This Portal Does

### Feedback Tasks
The manager creates a task with a custom form (short text, long text, ratings, dropdowns, yes/no questions) directly in the portal. A unique link is generated and pasted into an Outlook email. Workers click the link, log in, and submit their answers. The manager receives an instant email with the full response and can see live stats on who has and has not responded.

### Reminders
If a worker has not responded, the manager can send a one-click manual reminder email from the task detail page. An automatic reminder system (via scheduled cron job) also nudges workers who have not responded after a set period, and sends the manager a daily digest summarizing team-wide response rates.

### Daily Sales Notes
Each worker logs their daily activity: number of new customers (with optional name and notes per customer), number of new quotation requests (with optional customer name and value in SAR), and a required free-text summary of their day. Workers can update their entry throughout the day.

### Manager Daily Notes View
The manager can view all submitted notes for any given day, see team-wide stats (total new customers, total quotation value, etc.), and switch to a Monthly Performance view showing each worker's submission rate over working days (Sunday–Thursday) with an expandable calendar showing exactly which days were submitted vs. missed.

### User Management
Since public signup is disabled for security, the manager has a dedicated admin page to create accounts, reset passwords, and remove users — no direct database access needed.

### Settings
The manager can configure the daily reminder time, which days reminders are sent, and whether to receive the daily email digest.

## Tech Stack

- **Backend:** PHP (vanilla, no framework) with PDO for MySQL
- **Database:** MySQL / MariaDB
- **Frontend:** HTML, CSS, vanilla JavaScript (no framework)
- **Email:** PHPMailer via Gmail SMTP
- **Local environment:** XAMPP (Apache, MySQL, PHP)

## Security Measures

- Passwords hashed with bcrypt (`PASSWORD_BCRYPT`)
- CSRF tokens validated on every state-changing request
- Prepared statements (PDO) used throughout — no raw SQL string concatenation
- Session-based authentication with role checks (`admin` / `worker`) enforced server-side on every endpoint
- Rate limiting on sensitive actions (login, signup, feedback submission, reminders)
- Input validation and length limits on all user-submitted fields
- IDOR protection — tasks and notes are scoped to the authenticated user's session
- XSS prevention — all dynamic content rendered via `textContent` / DOM methods, never raw `innerHTML` with user data
- No public registration — all accounts are admin-provisioned

## Project Structure

```
sales-department/
├── backend/
│   ├── config.php                 # DB connection, session helpers, security utilities
│   ├── email_helper.php           # Shared email sending + HTML template functions
│   ├── auth/                      # Login, logout, session check, CSRF token
│   ├── tasks/                     # Create, list, fetch, close feedback tasks
│   ├── feedback/                  # Submit feedback, fetch responses, send reminders
│   ├── daily/                     # Save/fetch daily notes, monthly performance, settings
│   ├── users/                     # Admin user management (create/delete/reset)
│   └── cron/                      # Scheduled jobs: auto reminders, daily digest, daily note reminder
├── pages/                         # All HTML pages (admin + worker views)
├── js/                            # Page-specific JavaScript + shared utils.js
├── css/                           # style.css (global), admin.css, worker.css, auth.css
└── vendor/                        # PHPMailer (via Composer)
```

## Database Schema (Core Tables)

- `users` — id, name, email, password (bcrypt), role, created_at
- `tasks` — feedback tasks created by admin
- `task_fields` — custom form fields per task
- `feedback` / `feedback_answers` — worker submissions and their answers
- `daily_notes` — one row per worker per day, contains required notes text
- `daily_note_customers` — multiple customer entries per daily note (name + problem)
- `daily_note_quotations` — multiple quotation entries per daily note (name + value)
- `reminders` / `auto_reminders` — logs of manual and automatic reminders sent
- `reminder_settings` — per-admin configuration for reminder time/days/digest

## Known Limitations / Next Steps

- Currently tested via XAMPP locally and exposed temporarily through ngrok for remote testing — not yet on permanent hosting
- Cron jobs (auto reminders, daily digest) require a real server with scheduled task support to run automatically
- An Outlook Add-in prototype was built (task pane that creates a task and inserts the link directly into a new email) but requires HTTPS hosting and company IT approval for installation on a managed Microsoft 365 account
- Mobile responsiveness has been partially tested but not fully polished


## Author

It is Built by Abdulwahed Zuhair Al Adi, Computer Science student at King Fahd University of Petroleum and Minerals (KFUPM), during a student internship in the Sales Department at Tawuniya.