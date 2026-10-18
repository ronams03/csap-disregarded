<?php
/* ==========================================================================
   CSAP-COC  |  Content readers (settings, blocks, nav) + front-page payload
   ========================================================================== */
declare(strict_types=1);

/* ------------------------------------------------------------------ settings */
function all_settings(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $defaults = csap_setting_defaults();
    $out = [];
    foreach ($defaults as $k => $d) {
        $out[$k] = (string) $d['value'];
    }
    foreach (db_all('SELECT skey, svalue FROM settings') as $row) {
        if (array_key_exists($row['skey'], $out)) {
            $out[$row['skey']] = (string) $row['svalue'];
        }
    }
    $cache = $out;
    return $out;
}

function setting(string $key, string $default = ''): string
{
    $all = all_settings();
    return $all[$key] ?? $default;
}

/** Settings shaped for the admin "Settings" screen (grouped, with labels). */
function settings_admin_groups(): array
{
    $defaults = csap_setting_defaults();
    $stored   = [];
    foreach (db_all('SELECT skey, svalue FROM settings') as $row) {
        $stored[$row['skey']] = (string) $row['svalue'];
    }
    $groups = [];
    foreach ($defaults as $key => $d) {
        $groups[$d['group']][] = [
            'key'   => $key,
            'label' => $d['label'],
            'type'  => $d['type'],
            'value' => $stored[$key] ?? (string) $d['value'],
        ];
    }
    return $groups;
}

/* -------------------------------------------------------------------- blocks */
function csap_block_pages(): array
{
    return [
        'hero'             => ['label' => 'Hero / Welcome',           'icon' => 'home'],
        'about'            => ['label' => 'About Us',                 'icon' => 'info'],
        'history'          => ['label' => 'Our History',              'icon' => 'clock', 'collections' => ['history_pillars']],
        'leaders'          => ['label' => 'Lineage of Leadership',    'icon' => 'crown', 'collections' => ['leaders']],
        'officers'         => ['label' => 'Officers',                 'icon' => 'users', 'collections' => ['officers']],
        'contact'          => ['label' => 'Contact Us',               'icon' => 'mail',  'collections' => ['contact_cards']],
        'city_scholarship' => ['label' => 'City Scholarship',         'icon' => 'star',  'collections' => ['sdp_types', 'faqs']],
        'hk_scholarship'   => ['label' => 'HK Scholarship',           'icon' => 'award', 'collections' => ['hk_features', 'hk_prices']],
        'enrollment'       => ['label' => 'Enrollment Process',       'icon' => 'edit',  'collections' => ['enrollment_steps']],
        'announcements'    => ['label' => 'Announcements',            'icon' => 'bell',  'collections' => ['announcements']],
        'events'           => ['label' => 'Events & Stories',         'icon' => 'calendar', 'collections' => ['events']],
        'calendar'         => ['label' => 'Calendar',                 'icon' => 'calendar'],
        'awards'           => ['label' => 'Awards & Recognition',      'icon' => 'award', 'collections' => ['awardees']],
    ];
}

/** Convert stored HTML / rich text into readable plain text. */
function html_to_text(?string $html): string
{
    if ($html === null || $html === '') {
        return '';
    }
    $html = preg_replace('/<\/(p|div|li|h[1-6]|tr|br)>/i', "\n", $html);
    $html = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $html = preg_replace('/<\/li>/i', "\n", $html);
    $html = preg_replace('/<[^>]+>/', '', $html);
    $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $html = preg_replace('/[ \t]+/', ' ', $html);
    $html = preg_replace("/\n{3,}/", "\n\n", $html);
    return trim($html);
}

/** All stored block values, grouped page_key => block_key => value.
 *  One query for the whole table — instead of one query per page. */
function all_blocks(bool $refresh = false): array
{
    static $cache = null;
    if ($refresh) {
        $cache = null;
    }
    if ($cache !== null) {
        return $cache;
    }
    $cache = [];
    foreach (db_all('SELECT page_key, block_key, value FROM content_blocks') as $row) {
        $cache[(string) $row['page_key']][(string) $row['block_key']] = (string) $row['value'];
    }
    return $cache;
}

/** All editable blocks for a page, merged with defaults. */
function page_blocks(string $page): array
{
    $defaults = csap_block_defaults()[$page] ?? [];
    $stored = all_blocks()[$page] ?? [];
    $out = [];
    foreach ($defaults as $key => $def) {
        $val = array_key_exists($key, $stored) ? $stored[$key] : (string) $def['value'];
        if (($def['type'] === 'textarea' || $def['type'] === 'html') && $val !== '') {
            $val = html_to_text($val);
        }
        $out[$key] = [
            'key'   => $key,
            'label' => $def['label'],
            'type'  => $def['type'],
            'value' => $val,
        ];
    }
    return $out;
}

function block(string $page, string $key, string $default = ''): string
{
    static $cache = [];
    if (!isset($cache[$page])) {
        $cache[$page] = page_blocks($page);
    }
    return $cache[$page][$key]['value'] ?? $default;
}

/** Persist a set of block values for a page. */
function save_blocks(string $page, array $values): void
{
    $allowed = array_keys(csap_block_defaults()[$page] ?? []);
    $i = 0;
    foreach ($values as $key => $value) {
        if (!in_array($key, $allowed, true)) {
            continue;
        }
        $i++;
        db_exec(
            'INSERT INTO content_blocks (page_key, block_key, value, sort_order) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [$page, $key, (string) $value, $i]
        );
    }
    all_blocks(true); // drop the memoised read so later reads see the new values
}

/* ------------------------------------------------------------------ calendar */

/** The whitelisted calendar kinds, in display order. */
function csap_calendar_kinds(): array
{
    return [
        'holiday'      => 'Public holiday',
        'school_event' => 'School event',
        'csap_event'   => 'CSAP activity',
        'deadline'     => 'Deadline',
        'other'        => 'Other',
    ];
}

/**
 * Every published calendar entry, oldest first. `date_end` is normalised to
 * the start date so a single-day entry is always safe to render.
 */
function calendar_public_items(): array
{
    if (!db_ok() || !db_table_exists('calendar_entries')) {
        return csap_collection_defaults('calendar_entries');
    }
    $scope = db_column_exists('calendar_entries', 'archived_at') ? ' WHERE archived_at IS NULL' : '';
    $rows = db_all('SELECT * FROM calendar_entries' . $scope . ' ORDER BY date_start ASC, sort_order ASC, id ASC LIMIT ' . COLLECTION_MAX_UNBOUNDED);
    if (!$rows) {
        return [];
    }
    foreach ($rows as &$r) {
        $r['id']           = (int) $r['id'];
        $r['all_day']      = (int) ($r['all_day'] ?? 1);
        $r['is_highlight'] = (int) ($r['is_highlight'] ?? 0);
        $r['date_end']     = ($r['date_end'] ?? '') !== '' ? (string) $r['date_end'] : (string) $r['date_start'];
        $r['time_from']    = (string) ($r['time_from'] ?? '');
        $r['time_to']      = (string) ($r['time_to'] ?? '');
        $r['location']     = (string) ($r['location'] ?? '');
        $r['description']  = html_to_text((string) ($r['description'] ?? ''));
        $r['kind']         = (string) ($r['kind'] ?? 'other');
        $r['title']        = html_to_text((string) $r['title']);
    }
    unset($r);
    return $rows;
}

/** Date column a table uses, preferring the published date. */
function calendar_date_column(string $table): string
{
    if (db_column_exists($table, 'published_at')) return 'published_at';
    if (db_column_exists($table, 'created_at'))  return 'created_at';
    return '';
}

/** " AND archived_at IS NULL" when the table has archive storage. */
function calendar_live_scope(string $table): string
{
    return db_column_exists($table, 'archived_at') ? ' AND archived_at IS NULL' : '';
}

/**
 * Dated records that already live somewhere else on the site and can therefore
 * be pulled into the calendar ("add all existing / choose sources"). Each item
 * carries the `source` + `source_ref` pair it would be stored with, so an
 * import that runs twice never duplicates anything.
 */
function calendar_source_items(): array
{
    $out = [];
    if (!db_ok()) {
        return $out;
    }
    $evDate = calendar_date_column('events');
    if (db_table_exists('events') && $evDate) {
        foreach (db_all('SELECT id, title, kind, ' . $evDate . ' AS d, link_url FROM events WHERE ' . $evDate . ' IS NOT NULL' . calendar_live_scope('events') . ' ORDER BY ' . $evDate . ' DESC LIMIT 200') as $r) {
            if ((string) $r['d'] === '') {
                continue;
            }
            $out[] = [
                'source'      => 'events',
                'source_ref'  => 'events:' . (int) $r['id'],
                'title'       => html_to_text((string) $r['title']),
                'date'        => (string) $r['d'],
                'kind'        => ((string) ($r['kind'] ?? '') === 'story') ? 'other' : 'csap_event',
                'link'        => (string) ($r['link_url'] ?? ''),
                'description' => 'Pulled in from Events & Stories.',
            ];
        }
    }
    $anDate = calendar_date_column('announcements');
    if (db_table_exists('announcements') && $anDate) {
        foreach (db_all('SELECT id, title, category, ' . $anDate . ' AS d, document_url FROM announcements WHERE ' . $anDate . ' IS NOT NULL' . calendar_live_scope('announcements') . ' ORDER BY ' . $anDate . ' DESC LIMIT 200') as $r) {
            if ((string) $r['d'] === '') {
                continue;
            }
            $out[] = [
                'source'      => 'announcements',
                'source_ref'  => 'announcements:' . (int) $r['id'],
                'title'       => html_to_text((string) $r['title']),
                'date'        => (string) $r['d'],
                'kind'        => 'deadline',
                'link'        => (string) ($r['document_url'] ?? ''),
                'description' => 'Pulled in from Announcements' . ((string) ($r['category'] ?? '') !== '' ? ' — ' . html_to_text((string) $r['category']) : '') . '.',
            ];
        }
    }
    return $out;
}

/**
 * Copy existing records into the calendar. Entries that are already there
 * (same `source_ref`) are skipped, so "Add all existing" is safe to repeat.
 * Returns ['added' => n, 'skipped' => n].
 */
function calendar_import_sources(array $rows): array
{
    if (!db_ok() || !db_table_exists('calendar_entries')) {
        return ['added' => 0, 'skipped' => 0, 'error' => 'Calendar table is not ready yet.'];
    }
    $existing = [];
    foreach (db_all("SELECT source_ref FROM calendar_entries WHERE source_ref IS NOT NULL AND source_ref <> ''") as $r) {
        $existing[(string) $r['source_ref']] = true;
    }
    $added = $skipped = 0;
    foreach ($rows as $row) {
        $ref   = trim((string) ($row['source_ref'] ?? ''));
        $title = trim((string) ($row['title'] ?? ''));
        $date  = trim((string) ($row['date'] ?? ''));
        if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $skipped++;
            continue;
        }
        if ($ref !== '' && isset($existing[$ref])) {
            $skipped++;
            continue;
        }
        $kind = (string) ($row['kind'] ?? 'other');
        if (!isset(csap_calendar_kinds()[$kind])) {
            $kind = 'other';
        }
        $sort  = (int) db_val('SELECT MAX(sort_order) FROM calendar_entries', [], 0) + 1;
        $saved = db_exec(
            'INSERT INTO calendar_entries
                (title, kind, source, source_ref, date_start, date_end, all_day, time_from, time_to,
                 location, description, is_highlight, sort_order)
             VALUES (?, ?, ?, ?, ?, NULL, 1, NULL, NULL, ?, ?, ?, ?)',
            [
                $title, $kind, (string) ($row['source'] ?? 'manual'), ($ref !== '' ? $ref : null),
                $date, (string) ($row['location'] ?? ''), (string) ($row['description'] ?? ''),
                ((int) ($row['is_highlight'] ?? 0)) ? 1 : 0, $sort,
            ]
        );
        if ($saved > 0) {
            $added++;
            if ($ref !== '') {
                $existing[$ref] = true;
            }
        } else {
            $skipped++;
        }
    }
    return ['added' => $added, 'skipped' => $skipped];
}

/* ----------------------------------------------------------------- Navigaion */
function nav_tree(): array
{
    $rows = db_all('SELECT id, label, href, parent_id, is_cta, sort_order FROM nav_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    if (!$rows) {
        // build from seed defaults
        $tree = [];
        foreach (csap_collection_defaults('nav_items') as $i => $item) {
            $children = [];
            foreach ($item['children'] as $j => $ch) {
                $children[] = ['id' => 0, 'label' => $ch['label'], 'href' => $ch['href'], 'is_cta' => 0, 'children' => []];
            }
            $tree[] = ['id' => 0, 'label' => $item['label'], 'href' => $item['href'], 'is_cta' => $item['is_cta'], 'children' => $children];
        }
        return $tree;
    }
    $byId = [];
    $tree = [];
    foreach ($rows as $r) {
        $r['children'] = [];
        $byId[(int) $r['id']] = $r;
    }
    foreach ($byId as $id => $r) {
        if ($r['parent_id'] && isset($byId[(int) $r['parent_id']])) {
            $byId[(int) $r['parent_id']]['children'][] = &$byId[$id];
        }
    }
    foreach ($byId as $id => $r) {
        if (!$r['parent_id']) {
            $tree[] = $r;
        }
    }
    return $tree;
}

/* ------------------------------------------------------- Front-page payload */
function content_payload(): array
{
    $blockPages = array_keys(csap_block_defaults());
    // One query resolves every table/column check used below.
    db_schema_warm(array_map(static fn($m) => $m['table'], csap_collections()));
    $blocks = [];
    foreach ($blockPages as $page) {
        foreach (page_blocks($page) as $key => $def) {
            $blocks[$page][$key] = $def['value'];
        }
    }

    $collections = [];
    foreach (['leaders', 'officers', 'announcements', 'events', 'awardees', 'faqs', 'contact_cards', 'history_pillars', 'sdp_types', 'hk_features', 'hk_prices', 'enrollment_steps'] as $key) {
        $rows = db_table_exists(collection_meta($key)['table']) ? collection_list($key) : csap_collection_defaults($key);
        $collections[$key] = $rows ?: csap_collection_defaults($key);
    }
    // The calendar drives both the public calendar grid and the header marquee.
    $collections['calendar_entries'] = calendar_public_items();

    return [
        'settings'    => all_settings(),
        'blocks'      => $blocks,
        'nav'         => nav_tree(),
        'collections' => $collections,
        'kinds'       => csap_calendar_kinds(),
    ];
}

/* ----------------------------------------------------------------- dashboard */
function dashboard_stats(): array
{
    // Prime the schema cache for every table in ONE query (instead of ~32).
    $warm = ['admins'];
    foreach (csap_collections() as $meta) {
        $warm[] = $meta['table'];
    }
    db_schema_warm($warm);

    $stats = [];
    foreach (csap_collections() as $key => $meta) {
        if ($key === 'officer_options') {
            continue; // managed from Officer Options, not a content list
        }
        $scope = (db_table_exists($meta['table']) && db_column_exists($meta['table'], 'archived_at'))
            ? ' WHERE archived_at IS NULL' : '';
        $stats[] = [
            'key'   => $key,
            'label' => $meta['label'],
            'count' => (int) db_val('SELECT COUNT(*) FROM ' . $meta['table'] . $scope, [], 0),
        ];
    }
    return $stats;
}