<?php
declare(strict_types=1);

/** Column filters arrive as f_<field>=<value> (dropdowns in the admin filter
 *  bar). collection_where() ignores names that are not collection fields. */
function csap_collection_filters(): array
{
    $filters = [];
    foreach ($_GET as $k => $v) {
        if (strpos((string) $k, 'f_') === 0 && is_scalar($v)) {
            $filters[substr((string) $k, 2)] = (string) $v;
        }
    }
    return $filters;
}

/** resource=collection&name=leaders[&id=1][&q=search] */
function csap_endpoint_collection(string $method): void
{
    require_auth();
    $name = (string) ($_GET['name'] ?? '');
    $meta = collection_admin_meta($name);
    if (!$meta) {
        json_fail('Unknown collection.', 404);
    }
    $id = isset($_GET['id']) ? (int) $_GET['id'] : null;

    if ($method === 'GET') {
        if ($id) {
            $row = collection_get($name, $id);
            if (!$row) {
                json_fail('Record not found.', 404);
            }
            json_ok(['meta' => $meta, 'item' => $row]);
        }
        // Metadata only (the "Add" form needs the field definitions, never the
        // rows) — avoids pulling a whole 2,000+ row collection.
        if ((string) ($_GET['meta'] ?? '') === '1') {
            json_ok(['meta' => $meta]);
        }
        $archivedOnly = (string) ($_GET['archived'] ?? '') === '1';
        $filters = csap_collection_filters();
        // Optional paging: limit/offset let long lists (students) load in
        // batches while `total` always reports the full match count.
        $limit = isset($_GET['limit']) ? max(1, min(500, (int) $_GET['limit'])) : null;
        $offset = isset($_GET['offset']) ? max(0, (int) $_GET['offset']) : 0;
        json_ok([
            'meta'  => $meta,
            'items' => collection_list($name, (string) ($_GET['q'] ?? ''), $archivedOnly, $filters, $limit, $offset),
            'total' => collection_count($name, (string) ($_GET['q'] ?? ''), $archivedOnly, $filters),
        ]);
    }

    csrf_verify();

    // Bulk Archive-storage operations: POST ?a=archive|restore {ids:[...]}.
    // With ?all=1 the search/filter parameters are honoured instead of `ids`,
    // so "Restore all" can act on a whole paged list.
    $bulk = (string) ($_GET['a'] ?? '');
    if ($method === 'POST' && ($bulk === 'archive' || $bulk === 'restore')) {
        if ((string) ($_GET['all'] ?? '') === '1') {
            $archivedScope = (string) ($_GET['archived'] ?? '') === '1';
            $ids = collection_ids($name, (string) ($_GET['q'] ?? ''), $archivedScope, csap_collection_filters());
        } else {
            $ids = array_values(array_filter(array_unique(array_map(
                static fn($v) => (int) $v,
                (array) (request_body()['ids'] ?? [])
            ))));
        }
        if (!$ids) {
            json_fail('No records selected.', 422);
        }
        $done = 0;
        foreach ($ids as $one) {
            $ok = $bulk === 'archive' ? collection_archive($name, $one) : collection_restore($name, $one);
            if ($ok) {
                $done++;
            }
        }
        activity_log($bulk, $name, $done . ' record(s): #' . implode(', #', array_slice($ids, 0, 25)));
        json_ok(['ids' => $ids, 'count' => $done]);
    }

    // Move a whole roster into another school year: POST ?a=move
    // {from: "<year>|''", school_year: "<year>"}. Officers only, and the target
    // must NOT be a past school year — rosters only ever move forward.
    if ($method === 'POST' && $bulk === 'move') {
        if ($name !== 'officers') {
            json_fail('Moving records between school years is only available for officers.', 422);
        }
        $body = request_body();
        $to = trim((string) ($body['school_year'] ?? ''));
        $from = trim((string) ($body['from'] ?? ''));
        if ($to === '') {
            json_fail('Choose the school year to move the officers into.', 422);
        }
        if (csap_is_past_school_year($to)) {
            json_fail('Officers cannot be moved to a past school year (S.Y. ' . $to . ').', 422);
        }
        $moved = officers_move_school_year($from, $to);
        if ($moved <= 0) {
            json_fail('No officers matched that school year.', 422);
        }
        activity_log('move', 'officers', $moved . ' officer(s) to S.Y. ' . $to);
        json_ok(['count' => $moved, 'school_year' => $to]);
    }

    if ($method === 'POST') {
        $newId = collection_save($name, request_body());
        if (!$newId) {
            json_fail('Could not save the record. ' . (db_last_error() ?: 'Check that required fields are filled.'), 422);
        }
        $item = collection_get($name, $newId);
        activity_log('create', $name, '#' . $newId . ' ' . ($item[$meta['title']] ?? ''));
        json_ok(['item' => $item], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if (!$id) {
            json_fail('Missing record id.', 422);
        }
        collection_save($name, request_body(), $id);
        $item = collection_get($name, $id);
        activity_log('update', $name, '#' . $id . ' ' . ($item[$meta['title']] ?? ''));
        json_ok(['item' => $item]);
    }

    if ($method === 'DELETE') {
        if (!$id) {
            json_fail('Missing record id.', 422);
        }
        $item = collection_get($name, $id);
        // Permanent erase is only possible from inside Archive storage.
        if (isset($_GET['purge'])) {
            activity_log('purge', $name, '#' . $id . ' ' . ($item[$meta['title']] ?? ''));
            collection_purge($name, $id);
            json_ok(['id' => $id, 'purged' => true]);
        }
        activity_log('archive', $name, '#' . $id . ' ' . ($item[$meta['title']] ?? ''));
        collection_delete($name, $id);
        json_ok(['id' => $id, 'archived' => true]);
    }

    json_fail('Unsupported method.', 405);
}