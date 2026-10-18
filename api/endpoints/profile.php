<?php
declare(strict_types=1);

/** resource=profile — the signed-in user's own account */
function csap_endpoint_profile(string $method): void
{
    $admin = require_auth();

    if ($method === 'GET') {
        json_ok(['admin' => $admin]);
    }

    csrf_verify();
    $b = request_body();

    $name  = trim((string) ($b['name'] ?? $admin['name']));
    $email = trim((string) ($b['email'] ?? $admin['email']));
    if ($name === '' || $email === '') {
        json_fail('Name and email are required.', 422);
    }
    $dupe = db_val('SELECT id FROM admins WHERE email = ? AND id <> ?', [$email, $admin['id']]);
    if ($dupe) {
        json_fail('That email is already in use.', 422);
    }

    $fields = [
        'name'  => $name,
        'email' => $email,
        'phone' => trim((string) ($b['phone'] ?? '')),
        'bio'   => trim((string) ($b['bio'] ?? '')),
        'avatar'=> trim((string) ($b['avatar'] ?? '')),
    ];
    $sql = 'UPDATE admins SET name=:name, email=:email, phone=:phone, bio=:bio, avatar=:avatar';

    $newPass = (string) ($b['password'] ?? '');
    if ($newPass !== '') {
        if (($b['password_confirm'] ?? '') !== $newPass) {
            json_fail('The password confirmation does not match.', 422);
        }
        $current = (string) ($b['current_password'] ?? '');
        $hash = (string) db_val('SELECT password_hash FROM admins WHERE id = ?', [$admin['id']], '');
        if (!password_verify($current, $hash)) {
            json_fail('Your current password is incorrect.', 422);
        }
        if (strlen($newPass) < 6) {
            json_fail('The new password must be at least 6 characters.', 422);
        }
        $sql .= ', password_hash = :ph';
        $fields['ph'] = password_hash($newPass, PASSWORD_DEFAULT);
    }
    $sql .= ' WHERE id = :id';
    $fields['id'] = $admin['id'];

    db_exec($sql, $fields);
    activity_log('update', 'profile', 'Profile updated' . ($newPass !== '' ? ' + password changed' : ''));
    json_ok(['admin' => current_admin()]);
}