<?php
/* ==========================================================================
   CSAP-COC  |  JSON response helpers
   Consistent envelope:  { "success": bool, "data": mixed, "error": string|null }
   ========================================================================== */
declare(strict_types=1);

/** Emit a JSON envelope and stop. */
function json_out($data = null, bool $success = true, ?string $error = null, int $status = 200): void
{
    $body = json_encode(
        ['success' => $success, 'data' => $data, 'error' => $error],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );

    $headers = [
        'Content-Type: application/json; charset=utf-8',
        'X-Content-Type-Options: nosniff',
        'Cache-Control: no-store',
        'Vary: Accept-Encoding',
    ];

    /* gzip the JSON when the client asks for it. List payloads shrink by
       80-95% (a full student list goes from ~1.6 MB to a couple hundred KB),
       so pages feel far snappier on a real connection. */
    $accepts = strtolower((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''));
    if (strpos($accepts, 'gzip') !== false
        && function_exists('gzencode')
        && !ini_get('zlib.output_compression')
        && !headers_sent()) {
        $gz = gzencode((string) $body, 6);
        if ($gz !== false && strlen($gz) < strlen((string) $body)) {
            $headers[] = 'Content-Encoding: gzip';
            $headers[] = 'Content-Length: ' . strlen($gz);
            $body = $gz;
        }
    }

    if (!headers_sent()) {
        http_response_code($status);
        foreach ($headers as $h) {
            header($h);
        }
    }
    echo $body;
    exit;
}

function json_ok($data = null, int $status = 200): void
{
    json_out($data, true, null, $status);
}

function json_fail(string $error, int $status = 400, $data = null): void
{
    json_out($data, false, $error, $status);
}

/** Read the JSON request body (falls back to form-encoded POST). */
function request_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $raw = file_get_contents('php://input');
    if ($raw !== false && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $body = $decoded;
            return $body;
        }
    }
    $body = $_POST ?: [];
    return $body;
}

/** Effective HTTP method (honours X-HTTP-Method-Override and ?_method=). */
function request_method(): string
{
    $m = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? ($_GET['_method'] ?? '');
    if ($override) {
        $m = strtoupper($override);
    }
    return $m;
}

function input(string $key, $default = null)
{
    $b = request_body();
    $v = $b[$key] ?? $default;
    return is_string($v) ? trim($v) : $v;
}

/** Cast a value to a clean integer or null. */
function to_int($v): ?int
{
    if ($v === null || $v === '') {
        return null;
    }
    return (int) $v;
}

/** Normalise a "yes/no like" checkbox to 0/1. */
function to_bit($v): int
{
    if (is_bool($v)) {
        return $v ? 1 : 0;
    }
    return in_array((string) $v, ['1', 'true', 'on', 'yes'], true) ? 1 : 0;
}