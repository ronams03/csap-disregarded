<?php
declare(strict_types=1);

/** resource=auth  (a=login|logout|me) */
function csap_endpoint_auth(string $action, string $method): void
{
    switch ($action) {
        case 'login':
            $u = (string) input('username');
            $p = (string) input('password');
            if ($u === '' || $p === '') {
                json_fail('Username and password are required.', 422);
            }
            $admin = auth_login($u, $p);
            if (!$admin) {
                json_fail('Invalid username or password.', 401);
            }
            activity_log('login', 'auth', $admin['username'] ?? $u);
            json_ok(['admin' => $admin, 'csrf' => csrf_token()]);
            // no break

        case 'logout':
            activity_log('logout', 'auth', 'Signed out');
            auth_logout();
            json_ok(['ok' => true]);
            // no break

        case 'me':
        default:
            json_ok(['admin' => current_admin(), 'csrf' => csrf_token()]);
    }
}