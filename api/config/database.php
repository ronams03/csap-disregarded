<?php
/* ==========================================================================
   CSAP-COC  |  API database layer (PDO)
   Reads credentials from environment (.env style) with XAMPP defaults.
   ========================================================================== */
declare(strict_types=1);

function csap_db_config(): array
{
    return [
        'host'    => getenv('CSAP_DB_HOST') ?: '127.0.0.1',
        'port'    => getenv('CSAP_DB_PORT') ?: '3306',
        'name'    => getenv('CSAP_DB_NAME') ?: 'csap_coc',
        'user'    => getenv('CSAP_DB_USER') ?: 'root',
        'pass'    => getenv('CSAP_DB_PASS') !== false ? (string) getenv('CSAP_DB_PASS') : '',
        'charset' => 'utf8mb4',
    ];
}

/** Shared PDO handle. Connects on first call; null when MySQL is unavailable. */
function db(): ?PDO
{
    static $pdo  = null;
    static $tried = false;

    if ($tried) {
        return $pdo;
    }
    $tried = true;
    $c = csap_db_config();

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $c['host'], $c['port'], $c['name'], $c['charset']);
    try {
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        $pdo = null;
    }
    return $pdo;
}

function db_ok(): bool
{
    return db() instanceof PDO;
}

/** Server-level PDO handle (no database selected) &mdash; used by the installer. */
function db_server(): ?PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $c = csap_db_config();
    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%s;charset=%s', $c['host'], $c['port'], $c['charset']),
            $c['user'],
            $c['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    } catch (Throwable $e) {
        $pdo = null;
    }
    return $pdo;
}

function db_run(string $sql, array $params = []): ?PDOStatement
{
    $pdo = db();
    if (!$pdo) {
        return null;
    }
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    } catch (Throwable $e) {
        $GLOBALS['CSAP_DB_ERROR'] = $e->getMessage();
        return null;
    }
}

/** Last captured database error (null when the previous query succeeded). */
function db_last_error(): ?string
{
    return $GLOBALS['CSAP_DB_ERROR'] ?? null;
}

function db_all(string $sql, array $params = []): array
{
    $stmt = db_run($sql, $params);
    return $stmt ? ($stmt->fetchAll() ?: []) : [];
}

function db_one(string $sql, array $params = []): ?array
{
    $stmt = db_run($sql, $params);
    if (!$stmt) {
        return null;
    }
    $row = $stmt->fetch();
    return $row ?: null;
}

function db_val(string $sql, array $params = [], $default = null)
{
    $stmt = db_run($sql, $params);
    if (!$stmt) {
        return $default;
    }
    $val = $stmt->fetchColumn();
    return $val === false ? $default : $val;
}

/** INSERT / UPDATE / DELETE. Returns affected rows, or -1 on failure. */
function db_exec(string $sql, array $params = []): int
{
    $stmt = db_run($sql, $params);
    return $stmt ? $stmt->rowCount() : -1;
}

function db_last_id(): int
{
    $pdo = db();
    return $pdo ? (int) $pdo->lastInsertId() : 0;
}

/* ---------------------------------------------------------------------------
   Schema cache
   information_schema lookups cost ~10ms each, and the app checks table/column
   existence in many places (installer, migrations, archive support, dashboard,
   front-page payload…). Every check is memoised for the duration of one request,
   and db_schema_warm() primes many tables with a SINGLE query. Call
   db_schema_flush() after any DDL so later checks see the new shape. */

/** Per-request cache: table name => list of column names (null = table absent). */
function &db_schema_cache(): array
{
    static $cache = [];
    return $cache;
}

function db_schema_flush(): void
{
    $cache = &db_schema_cache();
    $cache = [];
}

/** Load (and memoise) the column list of one table. */
function db_schema_load(string $table): void
{
    $c = csap_db_config();
    $rows = db_all(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
        [$c['name'], $table]
    );
    $cache = &db_schema_cache();
    $cache[$table] = $rows ? array_map(static fn($r) => (string) $r['column_name'], $rows) : null;
}

/** Prime the cache for many tables at once (one query instead of N). */
function db_schema_warm(array $tables): void
{
    $cache = &db_schema_cache();
    $want = [];
    foreach ($tables as $t) {
        $t = (string) $t;
        if ($t !== '' && !array_key_exists($t, $cache)) {
            $want[$t] = true;
        }
    }
    $want = array_keys($want);
    if (!$want) {
        return;
    }
    $c = csap_db_config();
    $ph = implode(',', array_fill(0, count($want), '?'));
    $rows = db_all(
        'SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = ? AND table_name IN (' . $ph . ')',
        array_merge([$c['name']], $want)
    );
    $byTable = [];
    foreach ($rows as $r) {
        $byTable[$r['table_name']][] = (string) $r['column_name'];
    }
    foreach ($want as $t) {
        $cache[$t] = $byTable[$t] ?? null;
    }
}

function db_table_exists(string $table): bool
{
    $cache = &db_schema_cache();
    if (!array_key_exists($table, $cache)) {
        db_schema_load($table);
    }
    return is_array($cache[$table]);
}

/** True when a column exists (used for zero-downtime migrations, e.g. officers.school_year). */
function db_column_exists(string $table, string $column): bool
{
    $cache = &db_schema_cache();
    if (!array_key_exists($table, $cache)) {
        db_schema_load($table);
    }
    return is_array($cache[$table]) && in_array($column, $cache[$table], true);
}