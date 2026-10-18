<?php
/* ==========================================================================
   CSAP-COC  |  Calendar endpoint
   GET  r=calendar               (public)  every published calendar entry
   GET  r=calendar&a=sources     (admin)  dated records that can be imported
   POST r=calendar&a=import      (admin)  add existing records to the calendar
   ========================================================================== */
declare(strict_types=1);

function csap_endpoint_calendar(string $method): void
{
    $action = (string) ($_GET['a'] ?? '');

    /* ---- public read: the website's calendar grid + header marquee ---- */
    if ($method === 'GET' && $action === '') {
        json_ok([
            'items' => calendar_public_items(),
            'kinds' => csap_calendar_kinds(),
            'today' => date('Y-m-d'),
        ]);
        return;
    }

    /* ---- everything below needs a signed-in admin ---- */
    require_auth();

    if ($method === 'GET' && $action === 'sources') {
        json_ok(['items' => calendar_source_items()]);
        return;
    }

    csrf_verify();

    if ($method === 'POST' && $action === 'import') {
        $body = request_body();
        $rows = isset($body['rows']) && is_array($body['rows']) ? $body['rows'] : [];
        // "Add all existing" — no explicit rows: pull every candidate.
        if (!$rows && !empty($body['all'])) {
            $rows = calendar_source_items();
        }
        if (!$rows) {
            json_fail('Nothing to add — pick at least one record.', 422);
            return;
        }
        $result = calendar_import_sources($rows);
        if (isset($result['error'])) {
            json_fail($result['error'], 500);
            return;
        }
        activity_log('create', 'calendar:import', $result['added'] . ' imported / ' . $result['skipped'] . ' skipped');
        json_ok($result);
        return;
    }

    json_fail('Unsupported method.', 405);
}
