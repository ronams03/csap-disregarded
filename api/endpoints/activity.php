<?php
declare(strict_types=1);

/** resource=activity — filtered paginated audit trail (admin only) */
function csap_endpoint_activity(string $method): void
{
    require_auth();
    if ($method !== 'GET') {
        json_fail('Unsupported method.', 405);
    }

    $q        = trim((string) ($_GET['q'] ?? ''));
    $action   = (string) ($_GET['action'] ?? '');
    $resource = (string) ($_GET['resource'] ?? '');
    $days     = max(0, (int) ($_GET['days'] ?? 0));
    $limit    = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
    $offset   = max(0, (int) ($_GET['offset'] ?? 0));

    $where = [];
    $params = [];
    if ($action !== '' && $action !== 'all' && in_array($action, ACTIVITY_ACTIONS, true)) {
        $where[] = 'action = :a';
        $params['a'] = $action;
    }
    if ($resource !== '' && $resource !== 'all') {
        $where[] = 'resource = :r';
        $params['r'] = $resource;
    }
    if ($days > 0) {
        $where[] = 'created_at >= DATE_SUB(NOW(), INTERVAL :d DAY)';
        $params['d'] = $days;
    }
    if ($q !== '') {
        $where[] = '(admin_name LIKE :q1 OR resource LIKE :q2 OR detail LIKE :q3)';
        $params['q1'] = '%' . $q . '%';
        $params['q2'] = '%' . $q . '%';
        $params['q3'] = '%' . $q . '%';
    }

    $whereSql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';
    $total = (int) db_val('SELECT COUNT(*) FROM activity_logs' . $whereSql, $params, 0);
    $items = db_all(
        'SELECT id, admin_name, action, resource, detail, created_at FROM activity_logs' . $whereSql
        . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
        $params
    );
    $resources = array_map(
        static fn($r) => $r['resource'],
        db_all('SELECT DISTINCT resource FROM activity_logs ORDER BY resource ASC')
    );

    json_ok([
        'items'     => $items,
        'total'     => $total,
        'limit'     => $limit,
        'offset'    => $offset,
        'actions'   => ACTIVITY_ACTIONS,
        'resources' => $resources,
    ]);
}