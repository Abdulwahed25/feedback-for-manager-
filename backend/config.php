<?php
/* =============================================
   config.php
   Database connection — security hardened
   ============================================= */

// ---- Security: Prevent direct access ----
// This file should never be accessed directly via browser
if (basename($_SERVER['PHP_SELF']) === 'config.php') {
    http_response_code(403);
    exit('Access denied.');
}

// ---- Database credentials ----
// In production: move these to environment variables
// or a file outside the web root. Never commit real
// credentials to version control.
define('DB_HOST',    'localhost');
define('DB_NAME',    'sales_department');
define('DB_USER',    'root');       // Change in production
define('DB_PASS',    '');           // Change in production
define('DB_CHARSET', 'utf8mb4');    // Full Unicode + emoji safe

// ---- Security headers ----
// Applied on every response through config.php
function setSecurityHeaders(): void {
    // Prevent browsers from MIME-sniffing
    header('X-Content-Type-Options: nosniff');
    // Block clickjacking
    header('X-Frame-Options: DENY');
    // Enable XSS filter in older browsers
    header('X-XSS-Protection: 1; mode=block');
    // Restrict referrer information
    header('Referrer-Policy: strict-origin-when-cross-origin');
    // Content Security Policy — adjust as needed
    header("Content-Security-Policy: default-src 'self'");
    // Force HTTPS in production (comment out on localhost)
    // header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// ---- PDO Connection ----
// Returns a secure PDO instance with:
// - Prepared statements enforced
// - Error mode set to exceptions
// - Emulated prepares disabled (real prepared statements)
// - Strict types enforced

function getDB(): PDO {
    static $pdo = null;

    // Singleton — reuse connection within same request
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        // Throw exceptions on errors — never fail silently
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        // Return results as associative arrays
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Disable emulated prepares — use real prepared statements
        // This is critical for preventing SQL injection
        PDO::ATTR_EMULATE_PREPARES   => false,
        // Stringify fetches off — return proper PHP types
        PDO::ATTR_STRINGIFY_FETCHES  => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Security: NEVER expose database errors to the client
        // Log the real error server-side only
        error_log('[DB Connection Error] ' . $e->getMessage());
        // Send generic error to client
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'A server error occurred. Please try again later.']);
        exit;
    }
}

// ---- JSON Response helpers ----

function sendSuccess(array $data = [], int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

function sendError(string $message, int $code = 400, array $data = []): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    $payload = ['success' => false, 'message' => $message];
    if (!empty($data)) $payload['data'] = $data;
    echo json_encode($payload);
    exit;
}

// ---- Session management ----
// Call this at the top of every authenticated PHP file

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    session_set_cookie_params([
        'lifetime' => 0,              // Session cookie — expires on browser close
        'path'     => '/',
        'domain'   => '',
        'secure'   => false,          // Set to true in production (HTTPS)
        'httponly' => true,           // Block JavaScript access to session cookie
        'samesite' => 'Strict',       // Prevent CSRF via cross-site requests
    ]);

    session_start();
}

// ---- Auth helpers ----

function requireSessionAdmin(): array {
    startSecureSession();
    if (empty($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        sendError('Unauthorized.', 401);
    }
    return $_SESSION['user'];
}

function requireSessionWorker(): array {
    startSecureSession();
    if (empty($_SESSION['user']) || $_SESSION['user']['role'] !== 'worker') {
        sendError('Unauthorized.', 401);
    }
    return $_SESSION['user'];
}

function requireSessionAny(): array {
    startSecureSession();
    if (empty($_SESSION['user'])) {
        sendError('Unauthorized.', 401);
    }
    return $_SESSION['user'];
}

// ---- Input sanitization helpers ----

function getPostString(string $key, int $maxLength = 500): string {
    $val = $_POST[$key] ?? '';
    return mb_substr(trim((string) $val), 0, $maxLength);
}

function getPostInt(string $key): ?int {
    $val = $_POST[$key] ?? null;
    return is_numeric($val) ? (int) $val : null;
}

function getPostBool(string $key): bool {
    return filter_var($_POST[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
}

// ---- CSRF Protection ----

function generateCsrfToken(): string {
    startSecureSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrfToken(): void {
    startSecureSession();
    $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        sendError('Invalid request. Please refresh and try again.', 403);
    }
}

// ---- Rate limiting ----

function checkRateLimit(string $key, int $maxAttempts = 5, int $windowSeconds = 900): void {
    startSecureSession();
    $now  = time();
    $data = $_SESSION['rate_' . $key] ?? ['attempts' => [], 'locked' => false, 'lockedAt' => 0];

    // Remove expired attempts
    $data['attempts'] = array_filter($data['attempts'], fn($t) => $now - $t < $windowSeconds);

    // Check if locked
    if ($data['locked'] && ($now - $data['lockedAt']) < $windowSeconds) {
        sendError('Too many attempts. Please wait 15 minutes before trying again.', 429);
    }

    // Auto-unlock after window
    if ($data['locked'] && ($now - $data['lockedAt']) >= $windowSeconds) {
        $data = ['attempts' => [], 'locked' => false, 'lockedAt' => 0];
    }

    $_SESSION['rate_' . $key] = $data;
}

function recordFailedAttempt(string $key, int $maxAttempts = 5, int $windowSeconds = 900): void {
    startSecureSession();
    $now  = time();
    $data = $_SESSION['rate_' . $key] ?? ['attempts' => [], 'locked' => false, 'lockedAt' => 0];

    $data['attempts'][] = $now;
    $data['attempts']   = array_filter($data['attempts'], fn($t) => $now - $t < $windowSeconds);

    if (count($data['attempts']) >= $maxAttempts) {
        $data['locked']   = true;
        $data['lockedAt'] = $now;
    }

    $_SESSION['rate_' . $key] = $data;
}

function clearRateLimit(string $key): void {
    startSecureSession();
    unset($_SESSION['rate_' . $key]);
}