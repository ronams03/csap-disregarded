<?php
/* ==========================================================================
   CSAP-COC  |  Installer / migrator
   Creates the database + tables from database/schema.sql and seeds the
   default content and the first administrator account (idempotent).
   ========================================================================== */
declare(strict_types=1);

/** Bump this whenever schema.sql or csap_migrate() changes, so existing
 *  installations re-check once and then skip migrations entirely. */
const CSAP_SCHEMA_VERSION = '2026-10-17.1';

function csap_schema_path(): string
{
    return dirname(__DIR__, 2) . '/database/schema.sql';
}

/** Run every statement in schema.sql (comments stripped). */
function csap_run_schema(): array
{
    $errors = [];
    $file = csap_schema_path();
    if (!is_file($file)) {
        return ['schema.sql not found at ' . $file];
    }
    $sql = (string) file_get_contents($file);
    // strip full-line `--` comments
    $lines = preg_split('/\r\n|\r|\n/', $sql) ?: [];
    $clean = [];
    foreach ($lines as $line) {
        if (preg_match('/^\s*--/', $line)) {
            continue;
        }
        $clean[] = $line;
    }
    $statements = array_filter(array_map('trim', explode(';', implode("\n", $clean))), static fn($s) => $s !== '');

    $pdo = db();
    if (!$pdo) {
        return ['Database connection unavailable.'];
    }
    foreach ($statements as $stmt) {
        try {
            $pdo->exec($stmt);
        } catch (Throwable $e) {
            $errors[] = $e->getMessage();
        }
    }
    return $errors;
}

function csap_seed_settings(): void
{
    foreach (csap_setting_defaults() as $key => $d) {
        db_exec(
            'INSERT INTO settings (skey, svalue, label, sgroup, stype, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE label = VALUES(label), sgroup = VALUES(sgroup), stype = VALUES(stype)',
            [$key, (string) $d['value'], $d['label'], $d['group'], $d['type'], $d['sort']]
        );
    }
}

function csap_seed_blocks(): void
{
    foreach (csap_block_defaults() as $page => $blocks) {
        $i = 0;
        foreach ($blocks as $key => $def) {
            $i++;
            db_exec(
                'INSERT IGNORE INTO content_blocks (page_key, block_key, value, sort_order) VALUES (?, ?, ?, ?)',
                [$page, $key, (string) $def['value'], $i]
            );
        }
    }
}

function csap_seed_collections(bool $force = false): void
{
    foreach (csap_collections() as $key => $meta) {
        if (!db_table_exists($meta['table'])) {
            continue;
        }
        $count = (int) db_val('SELECT COUNT(*) FROM ' . $meta['table'], [], 0);
        if ($count > 0 && !$force) {
            continue;
        }
        foreach (csap_collection_defaults($key) as $row) {
            if ($key === 'nav_items') {
                $parentId = collection_save($key, [
                    'label' => $row['label'], 'href' => $row['href'], 'parent_id' => null,
                    'is_cta' => $row['is_cta'], 'is_active' => 1, 'sort_order' => $row['sort_order'],
                ]);
                foreach (($row['children'] ?? []) as $ch) {
                    collection_save($key, [
                        'label' => $ch['label'], 'href' => $ch['href'], 'parent_id' => $parentId,
                        'is_cta' => 0, 'is_active' => 1, 'sort_order' => $ch['sort_order'],
                    ]);
                }
                continue;
            }
            collection_save($key, $row);
        }
    }
}

function csap_seed_admin(): void
{
    $count = (int) db_val('SELECT COUNT(*) FROM admins', [], 0);
    if ($count > 0) {
        return;
    }
    db_exec(
        'INSERT INTO admins (name, username, email, password_hash, role, bio) VALUES (?, ?, ?, ?, ?, ?)',
        [
            'CSAP-COC Administrator',
            'admin',
            'admin@csapcoc.local',
            password_hash('admin123', PASSWORD_DEFAULT),
            'superadmin',
            'Primary account for managing the CSAP-COC website.',
        ]
    );
}

/**
 * Bring an EXISTING install up to date without wiping data.
 * Currently: adds officers.school_year (older installs lack the column).
 */
function csap_migrate(): array
{
    $log = [];
    if (!db_ok() || !db_table_exists('officers')) {
        return $log;
    }
    if (!db_column_exists('officers', 'school_year')) {
        try {
            db()->exec("ALTER TABLE officers ADD COLUMN school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026' AFTER id");
            $log[] = 'Migrated: officers.school_year column added.';
        } catch (Throwable $e) {
            $log[] = 'Migration warning: ' . $e->getMessage();
            return $log;
        }
    }
    // Index lookup for the school-year filter; ignore if it already exists.
    try {
        $idx = db_one(
            'SELECT COUNT(*) AS c FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [csap_db_config()['name'], 'officers', 'idx_officers_school_year']
        );
        if ($idx && (int) $idx['c'] === 0) {
            db()->exec('ALTER TABLE officers ADD KEY idx_officers_school_year (school_year)');
            $log[] = 'Migrated: officers.school_year index added.';
        }
    } catch (Throwable $e) {
        // non-fatal — filtering still works without the index
    }
    // Per-officer comment / note shown under the officer on the public site.
    if (!db_column_exists('officers', 'comment')) {
        try {
            db()->exec('ALTER TABLE officers ADD COLUMN comment TEXT NULL AFTER name');
            $log[] = 'Migrated: officers.comment column added.';
        } catch (Throwable $e) {
            $log[] = 'Migration warning: ' . $e->getMessage();
        }
    }
    // Officer option lists (dropdown values managed per school year).
    if (!db_table_exists('officer_options')) {
        try {
            db()->exec(
                'CREATE TABLE IF NOT EXISTS officer_options (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    school_year VARCHAR(20) NOT NULL DEFAULT \'\',
                    field_key VARCHAR(30) NOT NULL,
                    value VARCHAR(160) NOT NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (id),
                    UNIQUE KEY uniq_officer_option (field_key, school_year, value),
                    KEY idx_officer_options (field_key, school_year)
                ) ENGINE=InnoDB'
            );
            $log[] = 'Migrated: officer_options table created.';
        } catch (Throwable $e) {
            $log[] = 'Migration warning: ' . $e->getMessage();
        }
    }
    // Backfill the option lists from whatever officers already exist (once).
    try {
        if (db_table_exists('officer_options') && (int) db_val('SELECT COUNT(*) FROM officer_options', [], 0) === 0) {
            $added = csap_sync_officer_options();
            if ($added) {
                $log[] = 'Migrated: ' . $added . ' officer option(s) seeded.';
            }
        }
    } catch (Throwable $e) {
        // non-fatal
    }
    // Students (CSAP scholar masterlist) — added after the first release, so
    // existing installs get the table through this migration. Same DDL as
    // database/schema.sql section 6c; idempotent via IF NOT EXISTS.
    if (!db_table_exists('students')) {
        try {
            db()->exec(
                'CREATE TABLE IF NOT EXISTS students (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                    student_no VARCHAR(40) NULL,
                    last_name VARCHAR(80) NOT NULL,
                    first_name VARCHAR(80) NOT NULL,
                    middle_name VARCHAR(80) NULL,
                    name_ext VARCHAR(20) NULL,
                    sex VARCHAR(10) NULL,
                    birth_date DATE NULL,
                    email VARCHAR(190) NULL,
                    mobile VARCHAR(40) NULL,
                    address VARCHAR(255) NULL,
                    barangay VARCHAR(120) NULL,
                    city VARCHAR(120) NULL,
                    guardian_name VARCHAR(160) NULL,
                    guardian_contact VARCHAR(40) NULL,
                    campus VARCHAR(20) NULL,
                    department VARCHAR(120) NULL,
                    program VARCHAR(40) NULL,
                    year_level VARCHAR(20) NULL,
                    section VARCHAR(60) NULL,
                    school_year VARCHAR(20) NULL,
                    enrollment_status VARCHAR(30) NULL,
                    gwa VARCHAR(10) NULL,
                    scholarship_type VARCHAR(40) NULL,
                    csr_no VARCHAR(60) NULL,
                    hk_grant VARCHAR(20) NULL,
                    scholarship_status VARCHAR(30) NULL,
                    sdp_hours INT NULL,
                    duty_hours INT NULL,
                    membership_status VARCHAR(30) NULL,
                    position VARCHAR(120) NULL,
                    photo VARCHAR(255) NULL,
                    notes TEXT NULL,
                    archived_at DATETIME NULL,
                    PRIMARY KEY (id),
                    KEY idx_students_name (last_name, first_name),
                    KEY idx_students_school_year (school_year),
                    KEY idx_students_department (department),
                    KEY idx_students_program (program),
                    KEY idx_students_year_level (year_level)
                ) ENGINE=InnoDB'
            );
            $log[] = 'Migrated: students table created.';
        } catch (Throwable $e) {
            $log[] = 'Migration warning: ' . $e->getMessage();
        }
    }
    // Anything created above (officers / students / officer_options …) must be
    // re-read from information_schema before the archive checks below.
    db_schema_flush();
    // Archive storage (soft delete): every list table + admins gets archived_at.
    try {
        $archiveTables = ['admins'];
        foreach (csap_collections() as $meta) {
            $archiveTables[] = $meta['table'];
        }
        foreach (array_unique($archiveTables) as $t) {
            if (db_table_exists($t) && !db_column_exists($t, 'archived_at')) {
                db()->exec("ALTER TABLE `$t` ADD COLUMN archived_at DATETIME NULL");
                $log[] = "Migrated: $t.archived_at column added.";
            }
        }
    } catch (Throwable $e) {
        $log[] = 'Migration warning: ' . $e->getMessage();
    }
    db_schema_flush();
    return $log;
}

/**
 * Populate officer_options from the distinct values already stored on officers.
 * Idempotent: relies on the (field_key, school_year, value) unique key.
 * Returns the number of new option rows inserted.
 */
function csap_sync_officer_options(): int
{
    if (!db_ok() || !db_table_exists('officer_options') || !db_table_exists('officers')) {
        return 0;
    }
    $before = (int) db_val('SELECT COUNT(*) FROM officer_options', [], 0);
    $cols = ['school_year', 'category', 'department', 'year_level', 'role'];
    foreach ($cols as $col) {
        try {
            db_exec(
                "INSERT IGNORE INTO officer_options (school_year, field_key, value, sort_order)
                 SELECT DISTINCT school_year, ?, $col, 0
                 FROM officers WHERE $col IS NOT NULL AND $col <> ''",
                [$col]
            );
        } catch (Throwable $e) {
            // skip a column that a very old install might not have
        }
    }
    $after = (int) db_val('SELECT COUNT(*) FROM officer_options', [], 0);
    return max(0, $after - $before);
}

/** Full install. Returns a log of what happened. */
function csap_install(bool $seed = true): array
{
    $log = [];

    $c = csap_db_config();
    $server = db_server();
    if (!$server) {
        return ['Could not connect to MySQL. Is it running?'];
    }
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . $c['name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $log[] = "Database `{$c['name']}` ready.";

    if (!db()) {
        return array_merge($log, ['Could not select the database.']);
    }
    $errs = csap_run_schema();
    $log[] = $errs ? ('Schema warnings: ' . implode(' | ', $errs)) : 'Tables created/verified.';
    // The schema just ran (CREATE TABLE IF NOT EXISTS) — drop the memoised
    // table/column info so the checks below see the new shape.
    db_schema_flush();
    // Always run lightweight migrations too (safe on fresh installs).
    $log = array_merge($log, csap_migrate());

    if ($seed) {
        csap_seed_settings();
        csap_seed_blocks();
        csap_seed_collections();
        csap_seed_admin();
        $log[] = 'Default content + administrator seeded.';
    }
    return $log;
}

/** Silent, best-effort install used by the API router on first run. */
function csap_ensure_installed(): void
{
    if (!db_ok()) {
        return;
    }

    /* FAST PATH — the applied schema version is kept in `settings`, so a normal
       request costs ONE indexed SELECT instead of ~40 information_schema lookups.
       Migrations only run when the stored version is missing or out of date. */
    $current = db_val("SELECT svalue FROM settings WHERE skey = 'schema_version' LIMIT 1");
    // A probe on a fresh database must not leak as a later "last error".
    $GLOBALS['CSAP_DB_ERROR'] = null;
    if (is_string($current) && $current === CSAP_SCHEMA_VERSION) {
        return;
    }

    if (!db_table_exists('content_blocks') || !db_table_exists('admins') || !db_table_exists('activity_logs')) {
        csap_install(true);
    } else {
        // Existing install: just make sure new columns (e.g. officers.school_year) exist.
        try {
            csap_migrate();
        } catch (Throwable $e) {
            // ignore — endpoints will surface a clearer error if the DB is down
        }
    }

    // Remember the version so the next request takes the fast path.
    try {
        db_exec(
            "INSERT INTO settings (skey, svalue, label, sgroup, stype, sort_order)
             VALUES ('schema_version', ?, 'Schema version', 'system', 'text', 0)
             ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)",
            [CSAP_SCHEMA_VERSION]
        );
    } catch (Throwable $e) {
        // non-fatal — we simply re-check on the next request
    }
    db_schema_flush();
}