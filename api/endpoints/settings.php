<?php
declare(strict_types=1);

/** resource=settings */
function csap_endpoint_settings(string $method): void
{
    require_auth();

    if ($method === 'GET') {
        json_ok(['groups' => settings_admin_groups()]);
    }

    csrf_verify();
    $body = request_body();
    $values = isset($body['settings']) && is_array($body['settings']) ? $body['settings'] : $body;
    $allowed = array_keys(csap_setting_defaults());

    foreach ((array) $values as $key => $val) {
        if (in_array($key, $allowed, true)) {
            db_exec(
                'INSERT INTO settings (skey, svalue) VALUES (?, ?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)',
                [$key, (string) $val]
            );
        }
    }
    activity_log('save', 'settings', count((array) $values) . ' setting(s) updated');
    json_ok(['groups' => settings_admin_groups()]);
}