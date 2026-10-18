<?php
/* ==========================================================================
   CSAP-COC  |  API front controller
   Single JSON entry point:   /api/index.php?r=<resource>[&a=<action>][&id=][&name=]
   Envelope:  { "success": bool, "data": mixed, "error": string|null }
   ========================================================================== */
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/seed.php';
require_once __DIR__ . '/helpers/collections.php';
require_once __DIR__ . '/helpers/content.php';
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/helpers/install.php';
require_once __DIR__ . '/helpers/activity.php';
require_once __DIR__ . '/endpoints/auth.php';
require_once __DIR__ . '/endpoints/content.php';
require_once __DIR__ . '/endpoints/dashboard.php';
require_once __DIR__ . '/endpoints/blocks.php';
require_once __DIR__ . '/endpoints/calendar.php';
require_once __DIR__ . '/endpoints/settings.php';
require_once __DIR__ . '/endpoints/collection.php';
require_once __DIR__ . '/endpoints/profile.php';
require_once __DIR__ . '/endpoints/users.php';
require_once __DIR__ . '/endpoints/upload.php';
require_once __DIR__ . '/endpoints/activity.php';

$clean = static fn($v): string => preg_replace('/[^a-z_]/', '', strtolower((string) $v)) ?: '';

$resource = $clean($_GET['r'] ?? 'content');
$action   = $clean($_GET['a'] ?? '');
$method   = request_method();

// Best-effort first-run install so the very first request "just works".
try {
    csap_ensure_installed();
} catch (Throwable $e) {
    // ignore — the endpoints below will report a clearer error
}

try {
    switch ($resource) {
        case 'content':    csap_endpoint_content();                 break;
        case 'auth':       csap_endpoint_auth($action, $method);    break;
        case 'dashboard':  csap_endpoint_dashboard();               break;
        case 'blocks':     csap_endpoint_blocks($method);           break;
        // Public read (no auth) + admin import actions live in the same resource.
        case 'calendar':   csap_endpoint_calendar($method);         break;
        case 'settings':   csap_endpoint_settings($method);         break;
        case 'collection': csap_endpoint_collection($method);       break;
        case 'profile':    csap_endpoint_profile($method);          break;
        case 'users':      csap_endpoint_users($method);            break;
        case 'upload':     csap_endpoint_upload();                  break;
        case 'activity':   csap_endpoint_activity($method);         break;

        case 'ping':
            json_ok(['pong' => true, 'db' => db_ok(), 'time' => date('c')]);
            break;

        case 'install':
            $admins = db_table_exists('admins') ? (int) db_val('SELECT COUNT(*) FROM admins', [], 0) : 0;
            if ($admins > 0) {
                require_superadmin();
            }
            json_ok(['log' => csap_install(true)]);
            break;

        default:
            json_fail('Unknown resource: ' . $resource, 404);
    }
} catch (Throwable $e) {
    json_fail('Server error: ' . $e->getMessage(), 500);
}