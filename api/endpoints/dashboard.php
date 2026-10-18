<?php
declare(strict_types=1);

/** resource=dashboard */
function csap_endpoint_dashboard(): void
{
    $admin = require_auth();
    json_ok([
        'admin'           => $admin,
        'stats'           => dashboard_stats(),
        'blocks'          => array_map(static fn($p) => $p['label'], csap_block_pages()),
        'settings'        => setting('site_title'),
        'recent_activity' => db_table_exists('activity_logs')
            ? db_all('SELECT id, admin_name, action, resource, detail, created_at FROM activity_logs ORDER BY id DESC LIMIT 8')
            : [],
    ]);
}