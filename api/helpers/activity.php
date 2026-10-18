<?php
declare(strict_types=1);

/** Append one row to the admin activity log (no-op when the table is absent). */
function activity_log(string $action, string $resource, ?string $detail = null): void
{
    if (!db_table_exists('activity_logs')) {
        return;
    }
    $admin = current_admin();
    db_exec(
        'INSERT INTO activity_logs (admin_id, admin_name, action, resource, detail, ip) VALUES (?,?,?,?,?,?)',
        [
            $admin['id'] ?? null,
            $admin['name'] ?? 'System',
            strtolower($action),
            $resource,
            $detail !== null ? mb_substr($detail, 0, 300) : null,
            $_SERVER['REMOTE_ADDR'] ?? '',
        ]
    );
}

const ACTIVITY_ACTIONS = ['create', 'update', 'delete', 'save', 'move', 'upload', 'login', 'logout'];