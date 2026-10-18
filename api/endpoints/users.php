<?php
declare(strict_types=1);

/** WHERE clause + params for the users list: archive scope + optional search.
 *  Shared by the list read and by the bulk "all" operations. */
function csap_users_scope(bool $archivedOnly, string $q): array
{
    $conds = [];
    $params = [];
    if (db_column_exists('admins', 'archived_at')) {
        $conds[] = $archivedOnly ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
    }
    if ($q !== '') {
        $like = [];
        foreach (['name', 'username', 'email', 'role'] as $col) {
            $like[] = "$col LIKE ?";
            $params[] = '%' . $q . '%';
        }
        $conds[] = '(' . implode(' OR ', $like) . ')';
    }
    return [$conds ? ' WHERE ' . implode(' AND ', $conds) : '', $params];
}

/** resource=users — administrator management (superadmin only) */
function csap_endpoint_users(string $method): void
{
    $me = require_superadmin();
    $id = isset($_GET['id']) ? (int) $_GET['id'] : null;

    if ($method === 'GET') {
        if ($id) {
            $row = db_one('SELECT id, name, username, email, role, phone, bio, avatar, is_active, archived_at, last_login, created_at FROM admins WHERE id = ?', [$id]);
            if (!$row) {
                json_fail('User not found.', 404);
            }
            json_ok(['item' => $row]);
        }
        $archivedOnly = (string) ($_GET['archived'] ?? '') === '1';
        $q = trim((string) ($_GET['q'] ?? ''));
        list($scope, $params) = csap_users_scope($archivedOnly, $q);
        $sel = 'SELECT id, name, username, email, role, phone, bio, avatar, is_active, archived_at, last_login, created_at FROM admins';
        // Paged like every other list so the archive screen behaves the same.
        $sql = $sel . $scope . ' ORDER BY ' . ($archivedOnly ? 'archived_at DESC, id DESC' : 'id ASC');
        $limit = isset($_GET['limit']) ? max(1, min(500, (int) $_GET['limit'])) : null;
        if ($limit !== null) {
            $sql .= ' LIMIT ' . $limit . ' OFFSET ' . max(0, (int) ($_GET['offset'] ?? 0));
        }
        json_ok([
            'items' => db_all($sql, $params),
            'total' => (int) db_val('SELECT COUNT(*) FROM admins' . $scope, $params, 0),
        ]);
    }

    csrf_verify();

    // Bulk Archive-storage operations: POST ?a=archive|restore {ids:[...]}.
    // With ?all=1 the archive scope + search are used instead of `ids`.
    $bulk = (string) ($_GET['a'] ?? '');
    if ($method === 'POST' && ($bulk === 'archive' || $bulk === 'restore')) {
        if ((string) ($_GET['all'] ?? '') === '1') {
            $archivedScope = (string) ($_GET['archived'] ?? '') === '1';
            list($scope, $params) = csap_users_scope($archivedScope, trim((string) ($_GET['q'] ?? '')));
            $ids = array_map(
                static fn($r) => (int) $r['id'],
                db_all('SELECT id FROM admins' . $scope, $params)
            );
        } else {
            $ids = array_values(array_filter(array_unique(array_map(
                static fn($v) => (int) $v,
                (array) (request_body()['ids'] ?? [])
            ))));
        }
        if (!$ids) {
            json_fail('No users selected.', 422);
        }
        $done = [];
        $skipped = [];
        foreach ($ids as $one) {
            $why = $bulk === 'archive' ? users_guard_archive((int) $me['id'], $one) : users_guard_restore($one);
            if ($why !== null) {
                $skipped[] = ['id' => $one, 'reason' => $why];
                continue;
            }
            if ($bulk === 'archive') {
                db_exec('UPDATE admins SET is_active = 0, archived_at = NOW() WHERE id = ?', [$one]);
            } else {
                db_exec('UPDATE admins SET is_active = 1, archived_at = NULL WHERE id = ?', [$one]);
            }
            $done[] = $one;
        }
        activity_log($bulk, 'admin_users', count($done) . ' user(s): #' . implode(', #', $done));
        json_ok(['ids' => $done, 'skipped' => $skipped]);
    }
    $b = request_body();

    if ($method === 'POST') {
        $name  = trim((string) ($b['name'] ?? ''));
        $user  = trim((string) ($b['username'] ?? ''));
        $email = trim((string) ($b['email'] ?? ''));
        $pass  = (string) ($b['password'] ?? '');
        $sentRole = (string) ($b['role'] ?? 'editor');
        $role = in_array($sentRole, ['superadmin', 'editor'], true) ? $sentRole : 'editor';
        if ($name === '' || $user === '' || $email === '' || strlen($pass) < 6) {
            json_fail('Name, username, email and a 6+ character password are required.', 422);
        }
        if (($b['password_confirm'] ?? '') !== $pass) {
            json_fail('The password confirmation does not match.', 422);
        }
        if (db_val('SELECT id FROM admins WHERE username = ? OR email = ?', [$user, $email])) {
            json_fail('That username or email is already taken.', 422);
        }
        db_exec(
            'INSERT INTO admins (name, username, email, password_hash, role, phone, bio, avatar, is_active) VALUES (?,?,?,?,?,?,?,?,?)',
            [$name, $user, $email, password_hash($pass, PASSWORD_DEFAULT), $role,
             trim((string) ($b['phone'] ?? '')), trim((string) ($b['bio'] ?? '')), trim((string) ($b['avatar'] ?? '')), to_bit($b['is_active'] ?? 1)]
        );
        activity_log('create', 'admin_users', $user);
        json_ok(['item' => db_one('SELECT id, name, username, email, role, is_active FROM admins WHERE id = ?', [db_last_id()])], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if (!$id) {
            json_fail('Missing user id.', 422);
        }
        $sentRole = (string) ($b['role'] ?? 'editor');
        $role = in_array($sentRole, ['superadmin', 'editor'], true) ? $sentRole : 'editor';
        $fields = [
            'name' => trim((string) ($b['name'] ?? '')),
            'username' => trim((string) ($b['username'] ?? '')),
            'email' => trim((string) ($b['email'] ?? '')),
            'role' => $role,
            'phone' => trim((string) ($b['phone'] ?? '')),
            'bio' => trim((string) ($b['bio'] ?? '')),
            'avatar' => trim((string) ($b['avatar'] ?? '')),
            'is_active' => to_bit($b['is_active'] ?? 1),
            'id' => $id,
        ];
        $sql = 'UPDATE admins SET name=:name, username=:username, email=:email, role=:role, phone=:phone, bio=:bio, avatar=:avatar, is_active=:is_active';
        if (!empty($b['password'])) {
            if (strlen((string) $b['password']) < 6) {
                json_fail('Password must be at least 6 characters.', 422);
            }
            if (($b['password_confirm'] ?? '') !== $b['password']) {
                json_fail('The password confirmation does not match.', 422);
            }
            $sql .= ', password_hash = :ph';
            $fields['ph'] = password_hash((string) $b['password'], PASSWORD_DEFAULT);
        }
        $sql .= ' WHERE id = :id';
        db_exec($sql, $fields);
        activity_log('update', 'admin_users', '#' . $id . ' ' . ($fields['username'] ?? ''));
        json_ok(['item' => db_one('SELECT id, name, username, email, role, phone, bio, avatar, is_active FROM admins WHERE id = ?', [$id])]);
    }

    if ($method === 'DELETE') {
        if (!$id || $id === (int) $me['id']) {
            json_fail('You cannot delete your own account.', 422);
        }
        $why = users_guard_archive((int) $me['id'], $id);
        if ($why !== null) {
            json_fail($why, 422);
        }
        // Permanent erase is only possible from inside Archive storage.
        if (isset($_GET['purge'])) {
            db_exec('DELETE FROM admins WHERE id = ?', [$id]);
            activity_log('purge', 'admin_users', '#' . $id);
            json_ok(['id' => $id, 'purged' => true]);
        }
        db_exec('UPDATE admins SET is_active = 0, archived_at = NOW() WHERE id = ?', [$id]);
        activity_log('archive', 'admin_users', '#' . $id);
        json_ok(['id' => $id, 'archived' => true]);
    }

    json_fail('Unsupported method.', 405);
}

/** Refuse archiving your own account or the last active superadmin. */
function users_guard_archive(int $meId, int $id): ?string
{
    if ($id === $meId) {
        return 'You cannot archive your own account.';
    }
    $target = db_one('SELECT role FROM admins WHERE id = ?', [$id]);
    if ($target && $target['role'] === 'superadmin') {
        $scope = db_column_exists('admins', 'archived_at') ? " AND archived_at IS NULL" : '';
        $supers = (int) db_val("SELECT COUNT(*) FROM admins WHERE role = 'superadmin'" . $scope, [], 0);
        if ($supers <= 1) {
            return 'At least one superadmin must remain.';
        }
    }
    return null;
}

/** Refuse restoring a username/email that an active account already uses. */
function users_guard_restore(int $id): ?string
{
    $row = db_one('SELECT username, email FROM admins WHERE id = ?', [$id]);
    if (!$row) {
        return 'User not found.';
    }
    $clash = db_val(
        'SELECT id FROM admins WHERE id <> ? AND archived_at IS NULL AND (username = ? OR email = ?) LIMIT 1',
        [$id, $row['username'], $row['email']]
    );
    if ($clash) {
        return 'An active account already uses that username or email.';
    }
    return null;
}