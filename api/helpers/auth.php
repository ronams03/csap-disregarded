<?php
/* ==========================================================================
   CSAP-COC  |  Session auth for the admin API
   ========================================================================== */
declare(strict_types=1);

function auth_start(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'path' => '/']);
        session_start();
    }
}

/** Public admin record for the logged-in user (password excluded). */
function current_admin(): ?array
{
    auth_start();
    $id = $_SESSION['admin_id'] ?? null;
    if (!$id) {
        return null;
    }
    $row = db_one(
        'SELECT id, name, username, email, role, phone, bio, avatar, is_active, last_login, created_at
         FROM admins WHERE id = ? LIMIT 1',
        [(int) $id]
    );
    if (!$row || !(int) $row['is_active']) {
        return null;
    }
    return $row;
}

function is_superadmin(?array $admin = null): bool
{
    $admin = $admin ?? current_admin();
    return $admin && $admin['role'] === 'superadmin';
}

/** Attempt login; returns the admin row on success, or null. */
function auth_login(string $username, string $password): ?array
{
    $row = db_one(
        'SELECT * FROM admins WHERE (username = ? OR email = ?) AND is_active = 1 LIMIT 1',
        [$username, $username]
    );
    if (!$row || !password_verify($password, (string) $row['password_hash'])) {
        return null;
    }
    auth_start();
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $row['id'];
    $_SESSION['csrf']     = bin2hex(random_bytes(16));
    db_exec('UPDATE admins SET last_login = NOW() WHERE id = ?', [(int) $row['id']]);
    return current_admin();
}

function auth_logout(): void
{
    auth_start();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool) ($p['secure'] ?? false), (bool) ($p['httponly'] ?? true));
    }
    session_destroy();
}

function csrf_token(): string
{
    auth_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

/** Guard for mutating requests. */
function csrf_verify(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? (request_body()['_csrf'] ?? '');
    auth_start();
    if (empty($_SESSION['csrf']) || !hash_equals((string) $_SESSION['csrf'], (string) $sent)) {
        json_fail('Invalid or expired session token. Please sign in again.', 419);
    }
}

/** Abort with 401 unless a user is signed in. */
function require_auth(): array
{
    $admin = current_admin();
    if (!$admin) {
        json_fail('Authentication required.', 401);
    }
    return $admin;
}

/** Abort with 403 unless the user is a superadmin. */
function require_superadmin(): array
{
    $admin = require_auth();
    if ($admin['role'] !== 'superadmin') {
        json_fail('You do not have permission to perform this action.', 403);
    }
    return $admin;
}