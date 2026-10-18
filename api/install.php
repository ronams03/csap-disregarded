<?php
/* ==========================================================================
   CSAP-COC  |  One-time installer (CLI or web)
   CLI  :  php api/install.php
   Web  :  http://localhost/csap-coc/api/install.php   (only while no admin exists)
   ========================================================================== */
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/seed.php';
require_once __DIR__ . '/helpers/collections.php';
require_once __DIR__ . '/helpers/content.php';
require_once __DIR__ . '/helpers/auth.php';
require_once __DIR__ . '/helpers/install.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    // Web mode: allowed only when there is no admin account yet.
    $admins = db_table_exists('admins') ? (int) db_val('SELECT COUNT(*) FROM admins', [], 0) : 0;
    if ($admins > 0) {
        require_superadmin();
    }
}

$log = csap_install(true);
$result = [
    'success' => true,
    'db'      => db_ok(),
    'log'     => $log,
    'admin'   => ['username' => 'admin', 'password' => 'admin123', 'note' => 'Change this password after your first sign-in.'],
    'api'     => 'api/index.php',
];

if ($isCli) {
    echo "CSAP-COC installer\n".str_repeat('=', 40)."\n";
    foreach ($log as $line) {
        echo " - {$line}\n";
    }
    if (db_ok() && db_table_exists('admins')) {
        $count = (int) db_val('SELECT COUNT(*) FROM admins', [], 0);
        echo " - Admin accounts: {$count}\n";
        echo "\nSign in at: /csap-coc/admin/  (admin / admin123)\n";
    } else {
        echo "\nWARNING: database not reachable. Start MySQL in XAMPP and retry.\n";
    }
    exit(0);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);