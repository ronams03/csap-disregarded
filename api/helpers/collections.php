<?php
/* ==========================================================================
   CSAP-COC  |  Generic collections registry + CRUD engine
   Every list on the front page maps to one whitelisted collection here,
   which powers both the API and the admin panel forms.
   ========================================================================== */
declare(strict_types=1);

/** Field shorthand. */
function cf(string $key, string $label, string $type = 'text', array $extra = []): array
{
    return array_merge(['key' => $key, 'label' => $label, 'type' => $type], $extra);
}

/** The full collection registry. */
function csap_collections(): array
{
    static $c = null;
    if ($c !== null) {
        return $c;
    }

    // School years for the Students form/filters, generated automatically so
    // the list never goes stale (current school year uses the Aug–Jul cutoff).
    $syOptions = [];
    $syStart = (int) date('n') >= 8 ? (int) date('Y') : (int) date('Y') - 1;
    for ($y = 2019; $y <= $syStart + 1; $y++) {
        $syOptions[$y . '-' . ($y + 1)] = $y . '-' . ($y + 1);
    }
    $syOptions = array_reverse($syOptions, true);
    $currentSy = $syStart . '-' . ($syStart + 1);

    $c = [
        'nav_items' => [
            'label' => 'Navigation', 'table' => 'nav_items', 'title' => 'label', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('label', 'Label', 'text', ['required' => true]),
                cf('href', 'Link / anchor', 'text'),
                cf('parent_id', 'Parent item', 'select', ['options_from' => 'nav_items', 'nullable' => true]),
                cf('is_cta', 'Call-to-action button', 'checkbox'),
                // `list_only` fields never appear in the create/edit form: a new
                // record is active by default and the flag is flipped from the
                // list row itself (see admin.js wireListToggles).
                cf('is_active', 'Visible', 'checkbox', ['default' => 1, 'list_only' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'leaders' => [
            'label' => 'Lineage of Leadership', 'table' => 'leaders', 'title' => 'name', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('name', 'Name', 'text', ['required' => true]),
                cf('position', 'Position', 'text'),
                cf('term', 'Term', 'text'),
                cf('is_current', 'Current president', 'checkbox'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        // -- OFFICERS -------------------------------------------------------
        // One roster per school year: `school_year` (e.g. "2025-2026") decides
        // which set is shown. The site defaults to the newest school_year.
        // `sort_order` is AUTO-assigned by collection_save() on create, so the
        // admin form hides it when adding (see admin.js openCreateModal).
        'officers' => [
            'label' => 'Officers', 'table' => 'officers', 'title' => 'name', 'order' => 'school_year DESC, category ASC, sort_order ASC, id ASC',
            'fields' => [
                cf('school_year', 'School year', 'select', ['required' => true, 'officer_option' => 'school_year', 'hint' => 'Managed in Officer Options → School Years']),
                cf('category', 'Category / Block', 'select', ['required' => true, 'officer_option' => 'category', 'hint' => 'Managed in Officer Options → Category / Block']),
                cf('department', 'Department', 'select', ['nullable' => true, 'officer_option' => 'department', 'hint' => 'Managed in Officer Options → Department']),
                cf('year_level', 'Year level', 'select', ['nullable' => true, 'officer_option' => 'year_level', 'hint' => 'Managed in Officer Options → Year Level']),
                cf('role', 'Role / Position', 'select', ['required' => true, 'officer_option' => 'role']),
                cf('name', 'Name', 'text', ['required' => true]),
                cf('comment', 'Comment / Note', 'textarea', ['hint' => 'Optional note shown under this officer on the website.']),
                cf('sort_order', 'Order', 'number', ['auto' => true, 'hint' => 'Auto-assigned on add — no need to type this.']),
            ],
        ],
        // Dropdown option lists for the Officers form, scoped per school year.
        // field_key is one of: school_year | category | department | year_level | role.
        'officer_options' => [
            'label' => 'Officer options', 'table' => 'officer_options', 'title' => 'value', 'order' => 'field_key ASC, school_year ASC, sort_order ASC, id ASC',
            'fields' => [
                cf('school_year', 'School year', 'text', ['required' => true, 'hint' => 'The school year this option belongs to']),
                cf('field_key', 'Field', 'select', ['required' => true, 'options' => [
                    'school_year' => 'School year',
                    'category' => 'Category / Block',
                    'department' => 'Department',
                    'year_level' => 'Year level',
                    'role' => 'Role / Position',
                ]]),
                cf('value', 'Value', 'text', ['required' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        // -- STUDENTS -------------------------------------------------------
        // The CSAP scholar masterlist: the complete PHINMA COC student profile
        // (personal details, academic record, scholarship information and CSAP
        // membership) shown in the admin "Student Management" section.
        // `filter` => true marks the fields that get a dropdown filter on the
        // Student Management page.
        'students' => [
            'label' => 'Students', 'table' => 'students', 'title' => 'last_name',
            'order' => 'last_name ASC, first_name ASC, id ASC',
            'fields' => [
                // Personal information
                cf('student_no', 'Student number', 'text', ['hint' => 'PHINMA COC student number, e.g. 23-12345', 'placeholder' => '23-12345']),
                cf('last_name', 'Last name', 'text', ['required' => true]),
                cf('first_name', 'First name', 'text', ['required' => true]),
                cf('middle_name', 'Middle name', 'text'),
                cf('name_ext', 'Name extension', 'text', ['hint' => 'Suffix if any — Jr., Sr., III']),
                cf('sex', 'Sex', 'select', ['nullable' => true, 'options' => ['Female' => 'Female', 'Male' => 'Male']]),
                cf('birth_date', 'Birth date', 'date'),
                cf('email', 'Email address', 'text', ['placeholder' => 'name@phinmaed.com']),
                cf('mobile', 'Mobile number', 'text', ['hint' => 'e.g. 09XX XXX XXXX']),
                cf('address', 'Street / Purok', 'text'),
                cf('barangay', 'Barangay', 'text'),
                cf('city', 'City / Municipality', 'text', ['default' => 'Cagayan de Oro City']),
                cf('guardian_name', 'Parent / Guardian', 'text'),
                cf('guardian_contact', 'Guardian contact', 'text'),
                // Academic record
                cf('campus', 'Campus', 'select', ['nullable' => true, 'options' => [
                    'Carmen' => 'Carmen Campus',
                    'Puerto' => 'Puerto Campus',
                ]]),
                cf('department', 'Department', 'select', ['nullable' => true, 'filter' => true, 'options' => [
                    'CMA' => 'CMA — College of Management and Accountancy',
                    'COED' => 'COED — College of Education',
                    'SCCJ' => 'SCCJ — School of Criminology and Criminal Justice',
                    'CAHS' => 'CAHS — College of Allied Health and Sciences',
                    'CITE' => 'CITE — College of Information Technology',
                    'CEA' => 'CEA — College of Engineering and Architecture',
                ]]),
                cf('program', 'Program / Course', 'select', ['nullable' => true, 'filter' => true, 'options' => [
                    'BEED' => 'BEED — Bachelor of Elementary Education',
                    'BECED' => 'BECED — Bachelor of Early Childhood Education',
                    'BSED' => 'BSED — Bachelor of Secondary Education',
                    'BSED-ENG' => 'BSED-ENG — Major in English',
                    'BSED-FIL' => 'BSED-FIL — Major in Filipino',
                    'BSED-MATH' => 'BSED-MATH — Major in Mathematics',
                    'BSBA' => 'BSBA — Business Administration',
                    'BSBA-FM' => 'BSBA-FM — Financial Management',
                    'BSBA-MM' => 'BSBA-MM — Marketing Management',
                    'BSA' => 'BSA — Accountancy',
                    'BSMA' => 'BSMA — Management Accounting',
                    'BSCRIM' => 'BSCRIM — Criminology',
                    'BSIT' => 'BSIT — Information Technology',
                    'BSCE' => 'BSCE — Civil Engineering',
                    'BSCPE' => 'BSCPE — Computer Engineering',
                    'BSEE' => 'BSEE — Electrical Engineering',
                    'BSME' => 'BSME — Mechanical Engineering',
                    'BS ARCH' => 'BS ARCH — Architecture',
                    'BSHM' => 'BSHM — Hospitality Management',
                    'BSHRM' => 'BSHRM — Hotel and Restaurant Management',
                    'BSTM' => 'BSTM — Tourism Management',
                    'BSN' => 'BSN — Nursing',
                    'BS PHARM' => 'BS PHARM — Pharmacy',
                    'BS MED TECH' => 'BS MED TECH — Medical Technology',
                    'BS PSYCH' => 'BS PSYCH — Psychology',
                ]]),
                cf('year_level', 'Year level', 'select', ['nullable' => true, 'filter' => true, 'options' => [
                    '1st Year' => '1st Year', '2nd Year' => '2nd Year', '3rd Year' => '3rd Year',
                    '4th Year' => '4th Year', '5th Year' => '5th Year',
                ]]),
                cf('section', 'Section / Block', 'text'),
                cf('school_year', 'School year', 'select', ['required' => true, 'filter' => true,
                    'options' => $syOptions, 'default' => $currentSy,
                    'hint' => 'The school year this record belongs to.']),
                cf('enrollment_status', 'Enrollment status', 'select', ['filter' => true, 'default' => 'Enrolled', 'options' => [
                    'Enrolled' => 'Enrolled', 'Leave of Absence' => 'Leave of Absence',
                    'Dropped' => 'Dropped', 'Graduated' => 'Graduated', 'Transferred' => 'Transferred',
                ]]),
                cf('gwa', 'GWA', 'text', ['hint' => 'General weighted average, e.g. 1.75']),
                // Scholarship information
                cf('scholarship_type', 'Scholarship', 'select', ['nullable' => true, 'filter' => true, 'options' => [
                    'City Scholar' => 'City Scholar (CEDO)',
                    'HK Scholarship' => 'HK Scholarship (PHINMA)',
                    'City + HK' => 'City Scholar + HK (both)',
                    'None' => 'None / Regular student',
                ]]),
                cf('csr_no', 'CSR number', 'text', ['hint' => 'City Scholar CSR / scholar ID.']),
                cf('hk_grant', 'HK grant', 'select', ['nullable' => true, 'options' => [
                    'HK5.5' => 'HK5.5', 'HK7.5' => 'HK7.5', 'HK10' => 'HK10', 'HK12.5' => 'HK12.5',
                ]]),
                cf('scholarship_status', 'Scholarship status', 'select', ['nullable' => true, 'options' => [
                    'Active' => 'Active', 'On Probation' => 'On Probation', 'Untagged' => 'Untagged',
                ]]),
                cf('sdp_hours', 'SDP hours rendered', 'number', ['hint' => 'Scholar Development Program hours per semester.']),
                cf('duty_hours', 'HK duty hours rendered', 'number'),
                // CSAP organization
                cf('membership_status', 'CSAP membership', 'select', ['nullable' => true, 'filter' => true, 'options' => [
                    'Active member' => 'Active member', 'Inactive' => 'Inactive', 'Alumni' => 'Alumni',
                ]]),
                cf('position', 'CSAP position / role', 'text', ['hint' => 'Leave blank if not an officer.']),
                cf('photo', 'Photo', 'image'),
                cf('notes', 'Notes', 'textarea'),
            ],
        ],
        'announcements' => [
            'label' => 'Announcements', 'table' => 'announcements', 'title' => 'title', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true]),
                cf('category', 'Category', 'text'),
                cf('document_url', 'Document link', 'url'),
                cf('image', 'Cover image', 'image'),
                cf('published_at', 'Published date', 'date'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'events' => [
            'label' => 'Events & Stories', 'table' => 'events', 'title' => 'title', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true]),
                cf('kind', 'Type', 'select', ['options' => ['event' => 'Event card', 'story' => 'Story link']]),
                cf('image', 'Image', 'image'),
                cf('link_url', 'Link URL', 'url'),
                cf('published_at', 'Published date', 'date'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'awardees' => [
            'label' => 'Awardees', 'table' => 'awardees', 'title' => 'name', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('name', 'Awardee', 'text', ['required' => true]),
                cf('award', 'Award title', 'text', ['required' => true]),
                cf('year', 'Year', 'number'),
                cf('image', 'Photo', 'image'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'faqs' => [
            'label' => 'FAQs', 'table' => 'faqs', 'title' => 'question', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('category', 'Category', 'text', ['required' => true, 'hint' => 'SDP, GC, Scholarship']),
                cf('question', 'Question', 'textarea', ['required' => true]),
                cf('answer', 'Answer', 'textarea', ['required' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'contact_cards' => [
            'label' => 'Contact cards', 'table' => 'contact_cards', 'title' => 'label', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('label', 'Label', 'text', ['required' => true]),
                cf('value', 'Value', 'text', ['required' => true]),
                cf('url', 'URL', 'text', ['hint' => 'https://… or mailto:…']),
                cf('image', 'Icon image', 'image'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'history_pillars' => [
            'label' => 'History pillars', 'table' => 'history_pillars', 'title' => 'title', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true]),
                cf('body', 'Body', 'textarea', ['required' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'sdp_types' => [
            'label' => 'SDP types', 'table' => 'sdp_types', 'title' => 'title', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true]),
                cf('body', 'Body', 'textarea'),
                cf('items', 'Examples (one per line)', 'lines'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'hk_features' => [
            'label' => 'HK benefits', 'table' => 'hk_features', 'title' => 'title', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true]),
                cf('body', 'Body', 'textarea', ['required' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'hk_prices' => [
            'label' => 'HK price cards', 'table' => 'hk_prices', 'title' => 'code', 'order' => 'sort_order ASC, id ASC',
            'fields' => [
                cf('code', 'Code', 'text', ['required' => true, 'hint' => 'e.g. HK5.5']),
                cf('price', 'Price text', 'text', ['required' => true]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        'enrollment_steps' => [
            'label' => 'Enrollment steps', 'table' => 'enrollment_steps', 'title' => 'title', 'order' => 'mode ASC, sort_order ASC, id ASC',
            'fields' => [
                cf('mode', 'Mode', 'select', ['options' => ['walkin' => 'Walk-in', 'online' => 'Online']]),
                cf('title', 'Step title', 'text', ['required' => true]),
                cf('body', 'Step detail', 'textarea'),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
        // -- CALENDAR ---------------------------------------------------------
        // The public calendar. Every row is a day marker that the website
        // renders on a real month grid; `kind` decides the colour and
        // `is_highlight` gives a school event its highlight treatment.
        'calendar_entries' => [
            'label' => 'Calendar entries', 'table' => 'calendar_entries', 'title' => 'title',
            'order' => 'date_start ASC, sort_order ASC, id ASC',
            'fields' => [
                cf('title', 'Title', 'text', ['required' => true, 'placeholder' => 'e.g. Independence Day']),
                cf('kind', 'Type', 'select', ['required' => true, 'filter' => true, 'options' => [
                    'holiday'      => 'Public holiday',
                    'school_event' => 'School event (highlighted)',
                    'csap_event'   => 'CSAP activity',
                    'deadline'     => 'Deadline',
                    'other'        => 'Other',
                ]]),
                cf('date_start', 'Start date', 'date', ['required' => true]),
                cf('date_end', 'End date', 'date', ['hint' => 'Leave blank for a single-day entry.']),
                cf('all_day', 'All day', 'checkbox', ['default' => 1]),
                cf('time_from', 'Start time', 'text', ['hint' => 'Optional, e.g. 8:00 AM']),
                cf('time_to', 'End time', 'text', ['hint' => 'Optional, e.g. 5:00 PM']),
                cf('location', 'Location / venue', 'text', ['placeholder' => 'e.g. COC Covered Court']),
                cf('description', 'Details', 'textarea', ['hint' => 'Shown in the popup when a day is clicked on the website.']),
                cf('is_highlight', 'Highlight on the calendar', 'checkbox', ['hint' => 'Gives the entry a strong highlight (use for school events).']),
                cf('source', 'Source', 'select', ['options' => [
                    'manual'       => 'Added manually',
                    'school'       => 'School calendar',
                    'events'       => 'Events & Stories',
                    'announcements' => 'Announcements',
                ]]),
                cf('sort_order', 'Order', 'number'),
            ],
        ],
    ];

    return $c;
}

function collection_meta(string $key): ?array
{
    $all = csap_collections();
    return $all[$key] ?? null;
}

/** Split a "lines" textarea into a clean array. */
function lines_to_array(?string $text): array
{
    if ($text === null || $text === '') {
        return [];
    }
    $parts = preg_split('/\r\n|\r|\n/', $text) ?: [];
    return array_values(array_filter(array_map('trim', $parts), static fn($v) => $v !== ''));
}

/** Cast raw input into the column's storage type. */
function collection_cast(string $type, $value)
{
    switch ($type) {
        case 'number':
            return ($value === '' || $value === null) ? null : (int) $value;
        case 'checkbox':
            return in_array((string) $value, ['1', 'true', 'on', 'yes'], true) ? 1 : 0;
        case 'select':
            $v = $value === null ? '' : trim((string) $value);
            return $v === '' ? null : $v;
        case 'date':
            $v = trim((string) $value);
            return $v === '' ? null : $v;
        default:
            return trim((string) $value);
    }
}

/**
 * Shared WHERE builder for list/count queries: archive scope, free-text
 * search across every field, and exact-match column filters (only real
 * collection fields are allowed through).
 * Returns [whereSql, params].
 */
function collection_where(array $meta, string $q, bool $archived, array $filters = []): array
{
    $params = [];
    $where = [];
    // Archive storage: archived rows live apart from the working list.
    if (collection_has_archive($meta['table'])) {
        $where[] = $archived ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
    }
    if ($q !== '') {
        $cols = array_map(static fn($f) => $f['key'], $meta['fields']);
        $like = [];
        foreach ($cols as $i => $col) {
            $like[] = "$col LIKE :q$i";
            $params["q$i"] = '%' . $q . '%';
        }
        if ($like) {
            $where[] = '(' . implode(' OR ', $like) . ')';
        }
    }
    $fieldKeys = array_map(static fn($f) => (string) $f['key'], $meta['fields']);
    foreach ($filters as $col => $val) {
        if ($val === '' || $val === null || !in_array((string) $col, $fieldKeys, true)) {
            continue;
        }
        $where[] = "$col = :f_$col";
        $params["f_$col"] = (string) $val;
    }
    return [$where ? ' WHERE ' . implode(' AND ', $where) : '', $params];
}

/**
 * Hard ceiling for reads that do not ask for a page (the public front-page
 * payload, embedded admin cards…). Paged lists always pass an explicit
 * `limit`, so this only stops a runaway table from being pulled in full.
 */
const COLLECTION_MAX_UNBOUNDED = 2000;

function collection_list(string $key, string $q = '', bool $archived = false, array $filters = [], ?int $limit = null, int $offset = 0): array
{
    $meta = collection_meta($key);
    if (!$meta) {
        return [];
    }
    list($whereSql, $params) = collection_where($meta, $q, $archived, $filters);
    $sql = 'SELECT * FROM ' . $meta['table'] . $whereSql;
    $order = $meta['order'];
    // Backward compat: databases created before the school_year column
    // existed cannot ORDER BY it — drop that fragment instead of failing.
    if (strpos($order, 'school_year') !== false && function_exists('db_column_exists') && !db_column_exists($meta['table'], 'school_year')) {
        $order = trim(preg_replace('/school_year\s+(ASC|DESC)\s*,?\s*/i', '', $order), " ,");
    }
    // Archive storage reads newest-archived first.
    if ($archived && collection_has_archive($meta['table'])) {
        $order = 'archived_at DESC, id DESC';
    }
    $sql .= ' ORDER BY ' . $order;
    if ($limit !== null) {
        // Native prepares (ATTR_EMULATE_PREPARES = false): LIMIT/OFFSET are
        // interpolated as guaranteed integers, never bound as strings.
        $sql .= ' LIMIT ' . max(1, $limit) . ' OFFSET ' . max(0, $offset);
    } else {
        // Safety net for unbounded reads (front-page payload, embedded cards).
        $sql .= ' LIMIT ' . COLLECTION_MAX_UNBOUNDED;
    }
    $rows = db_all($sql, $params);
    if ($rows) {
        $types = [];
        foreach ($meta['fields'] as $f) {
            $types[$f['key']] = $f['type'];
        }
        foreach ($rows as &$row) {
            foreach (array_keys($row) as $k) {
                if (($types[$k] ?? '') === 'textarea' || ($types[$k] ?? '') === 'html') {
                    $row[$k] = html_to_text((string) $row[$k]);
                }
            }
        }
        unset($row);
    }
    return $rows;
}

/**
 * Total row count matching the same scope/search/filters as collection_list —
 * powers "Load more" and the result counter without fetching every row.
 */
function collection_count(string $key, string $q = '', bool $archived = false, array $filters = []): int
{
    $meta = collection_meta($key);
    if (!$meta) {
        return 0;
    }
    list($whereSql, $params) = collection_where($meta, $q, $archived, $filters);
    $sql = 'SELECT COUNT(*) FROM ' . $meta['table'] . $whereSql;
    return (int) db_val($sql, $params, 0);
}

/**
 * Every id matching the same scope/search/filters as collection_list().
 * Powers "Restore all" / "Archive all" without loading whole tables.
 */
function collection_ids(string $key, string $q = '', bool $archived = false, array $filters = []): array
{
    $meta = collection_meta($key);
    if (!$meta) {
        return [];
    }
    list($whereSql, $params) = collection_where($meta, $q, $archived, $filters);
    $rows = db_all('SELECT id FROM ' . $meta['table'] . $whereSql, $params);
    return array_map(static fn($r) => (int) $r['id'], $rows);
}

function collection_get(string $key, int $id): ?array
{
    $meta = collection_meta($key);
    if (!$meta) {
        return null;
    }
    return db_one('SELECT * FROM ' . $meta['table'] . ' WHERE id = ? LIMIT 1', [$id]);
}

// Next display order for a new record.
//
// Officers are scoped per school year: each school year's roster starts at
// 1 again (e.g. S.Y. 2026-2027 does NOT continue the numbering of 2025-2026).
// Every other collection uses the table-wide MAX(sort_order) + 1.
function collection_next_sort(string $key, array $data = []): int
{
    $meta = collection_meta($key);
    if (!$meta) {
        return 1;
    }
    // Officers: restart numbering per school_year when we know it.
    if ($key === 'officers' && isset($data['school_year']) && trim((string) $data['school_year']) !== '') {
        // Guard for databases created before the school_year column existed.
        if (function_exists('db_column_exists') && !db_column_exists($meta['table'], 'school_year')) {
            $max = db_val('SELECT MAX(sort_order) FROM ' . $meta['table']);
            return ((int) ($max ?? 0)) + 1;
        }
        $max = db_val(
            'SELECT MAX(sort_order) FROM ' . $meta['table'] . ' WHERE school_year = ?',
            [trim((string) $data['school_year'])],
            0
        );
        return ((int) ($max ?? 0)) + 1;
    }
    $max = db_val('SELECT MAX(sort_order) FROM ' . $meta['table']);
    return ((int) ($max ?? 0)) + 1;
}

/** Insert (id null) or update a record. Returns the record id, or 0 on failure. */
function collection_save(string $key, array $data, ?int $id = null): int
{
    $meta = collection_meta($key);
    if (!$meta) {
        return 0;
    }

    $cols = [];
    $vals = [];
    // OFFICERS: never allow a blank school_year on create — default to the
    // current school year (Aug–Jul cutoff) so the roster always lands in a year.
    if ($key === 'officers' && $id === null && trim((string) ($data['school_year'] ?? '')) === '') {
        $m = (int) date('n');
        $y = (int) date('Y');
        $data['school_year'] = ($m >= 8 ? $y : $y - 1) . '-' . ($m >= 8 ? $y + 1 : $y);
    }
    // Pre-compute the auto order ONCE per insert so every new record gets
    // MAX(sort_order) + 1 without the admin typing anything.
    $autoSort = ($id === null) ? collection_next_sort($key, $data) : null;
    // Remember the slot this record should take after the write so the rest of
    // the list can be renumbered around it: add appends it (null), edit moves
    // it to the chosen number.
    $wantsOrder = false;
    $orderPos = null;
    foreach ($meta['fields'] as $field) {
        $k = $field['key'];
        if (!array_key_exists($k, $data) && $id !== null) {
            continue; // partial update: keep existing value
        }
        // Officers on old databases: skip school_year when the column is missing.
        if ($k === 'school_year' && function_exists('db_column_exists') && !db_column_exists($meta['table'], 'school_year')) {
            continue;
        }
        $v = collection_cast($field['type'], $data[$k] ?? null);
        if ($k === 'sort_order') {
            // AUTO ORDER: on add, always use MAX + 1 (ignore whatever the
            // user sent, even if the form still posts an empty value); the
            // reindex below then slots it into place. On edit, keep the stored
            // order unless a non-zero value is given.
            if ($id === null) {
                $v = $autoSort;
                $wantsOrder = true;
            } elseif ($v === null || $v === 0) {
                continue; // edit without an order change: leave untouched
            } else {
                $orderPos = max(1, (int) $v);
                $v = $orderPos;
                $wantsOrder = true;
            }
        }
        if ($k === 'parent_id' && $id !== null && (int) $v === $id) {
            $v = null; // never parent itself
        }
        $cols[] = $k;
        $vals[$k] = $v;
    }
    if (!$cols) {
        return 0;
    }

    if ($id === null) {
        $place = array_map(static fn($c) => ':' . $c, $cols);
        db_exec('INSERT INTO ' . $meta['table'] . ' (' . implode(', ', $cols) . ') VALUES (' . implode(', ', $place) . ')', $vals);
        $savedId = db_last_id();
        if ($wantsOrder && $savedId > 0) {
            collection_reindex_sort($key, $savedId, $orderPos);
        }
        return $savedId;
    }

    $set = implode(', ', array_map(static fn($c) => "$c = :$c", $cols));
    $vals['id'] = $id;
    db_exec('UPDATE ' . $meta['table'] . ' SET ' . $set . ' WHERE id = :id', $vals);
    if ($wantsOrder) {
        collection_reindex_sort($key, $id, $orderPos);
    }
    return $id;
}

/**
 * Renumber `sort_order` into a dense 1..N sequence inside a scope, placing the
 * just-saved record at $position (or at the very end when null). This is what
 * makes Order behave the way admins expect across the whole site: set a row to
 * 1 and every other row slides down to 2, 3, … with no gaps or duplicates left
 * behind.
 *
 * Scope mirrors collection_next_sort(): officers are numbered per school_year,
 * every other collection over its whole (non-archived) table. Rows keep their
 * relative order (sort_order then id) while the numbers are tightened, and only
 * rows whose number actually changes are written back — all inside one
 * transaction so the list is never left half-renumbered.
 */
function collection_reindex_sort(string $key, int $recordId, ?int $position): void
{
    if ($recordId <= 0) {
        return;
    }
    $meta = collection_meta($key);
    if (!$meta) {
        return;
    }
    // Only collections that actually carry an Order column take part — the
    // Students masterlist, for instance, orders by name and has no sort_order.
    $hasSort = false;
    foreach ($meta['fields'] as $f) {
        if (($f['key'] ?? '') === 'sort_order') {
            $hasSort = true;
            break;
        }
    }
    if (!$hasSort) {
        return;
    }
    $table = $meta['table'];
    if (function_exists('db_column_exists') && !db_column_exists($table, 'sort_order')) {
        return; // a pre-migration database that never had the column
    }

    // Scope (officers reset per school year) + keep archived rows out of it.
    $params = [];
    $where = [];
    if ($key === 'officers') {
        $sy = trim((string) db_val('SELECT school_year FROM ' . $table . ' WHERE id = :id', [':id' => $recordId], ''));
        if ($sy === '') {
            return; // no year yet — nothing sensible to renumber against
        }
        $where[] = 'school_year = :sy';
        $params[':sy'] = $sy;
    }
    if (function_exists('collection_has_archive') && collection_has_archive($table)) {
        $where[] = 'archived_at IS NULL';
    }
    $whereSql = $where ? (' WHERE ' . implode(' AND ', $where)) : '';

    // Current visible order, so we only touch the numbers that actually move.
    $rows = db_all('SELECT id, sort_order FROM ' . $table . $whereSql . ' ORDER BY sort_order ASC, id ASC', $params);
    $current = [];
    $others = [];
    foreach ($rows as $r) {
        $rid = (int) $r['id'];
        $current[$rid] = (int) $r['sort_order'];
        if ($rid !== $recordId) {
            $others[] = $rid;
        }
    }

    // Final 1-based ordering with the record dropped into $position.
    $final = $others;
    if ($position === null) {
        $final[] = $recordId;                                   // add: append
    } else {
        $pos = max(1, min((int) $position, count($others) + 1));
        array_splice($final, $pos - 1, 0, [$recordId]);         // insert at slot
    }

    // Diff now; skip the transaction entirely when nothing changes (an edit
    // that did not actually move the row).
    $changes = [];
    $n = count($final);
    for ($i = 0; $i < $n; $i++) {
        $num = $i + 1;
        if (($current[$final[$i]] ?? -1) !== $num) {
            $changes[$final[$i]] = $num;
        }
    }
    if (!$changes) {
        return;
    }
    $pdo = db();
    $ownTx = $pdo && !$pdo->inTransaction();
    try {
        if ($ownTx) {
            $pdo->beginTransaction();
        }
        foreach ($changes as $cid => $num) {
            if (db_exec('UPDATE ' . $table . ' SET sort_order = :so WHERE id = :id', [':so' => $num, ':id' => $cid]) < 0) {
                throw new RuntimeException('reindex update failed');
            }
        }
        if ($ownTx) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($ownTx && $pdo && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }
}

function collection_delete(string $key, int $id): bool
{
    // Soft delete everywhere: rows move to Archive storage, never vanish.
    return collection_archive($key, $id);
}

/** True when a table supports Archive storage. */
function collection_has_archive(string $table): bool
{
    static $cache = [];
    if (!array_key_exists($table, $cache)) {
        $cache[$table] = db_table_exists($table) && db_column_exists($table, 'archived_at');
    }
    return $cache[$table];
}

/** Move a record to Archive storage. */
function collection_archive(string $key, int $id): bool
{
    $meta = collection_meta($key);
    if (!$meta || !collection_has_archive($meta['table'])) {
        return false;
    }
    return db_exec(
        'UPDATE ' . $meta['table'] . ' SET archived_at = NOW() WHERE id = ? AND archived_at IS NULL',
        [$id]
    ) >= 0;
}

/** Bring a record back from Archive storage. */
function collection_restore(string $key, int $id): bool
{
    $meta = collection_meta($key);
    if (!$meta || !collection_has_archive($meta['table'])) {
        return false;
    }
    return db_exec(
        'UPDATE ' . $meta['table'] . ' SET archived_at = NULL WHERE id = ? AND archived_at IS NOT NULL',
        [$id]
    ) >= 0;
}

/** Permanently erase a record (Archive storage only). */
function collection_purge(string $key, int $id): bool
{
    $meta = collection_meta($key);
    if (!$meta) {
        return false;
    }
    return db_exec('DELETE FROM ' . $meta['table'] . ' WHERE id = ?', [$id]) >= 0;
}

/** True when a "YYYY-YYYY" school year is already in the past (before the
 *  current one, Aug–Jul cutoff). A past year can never be a move target. */
function csap_is_past_school_year(string $schoolYear): bool
{
    $schoolYear = trim($schoolYear);
    if ($schoolYear === '') {
        return false;
    }
    $m = (int) date('n');
    $y = (int) date('Y');
    $current = ($m >= 8 ? $y : $y - 1) . '-' . ($m >= 8 ? $y + 1 : $y);
    return strnatcmp($schoolYear, $current) < 0;
}

/** Move officers into another school year. `$from` scopes the source roster
 *  ('' moves every officer). Returns the number of rows actually moved. */
function officers_move_school_year(string $from, string $to): int
{
    if (!db_ok() || !db_table_exists('officers')) {
        return 0;
    }
    if (function_exists('db_column_exists') && !db_column_exists('officers', 'school_year')) {
        return 0;
    }
    $to = trim($to);
    $from = trim($from);
    if ($to === '') {
        return 0;
    }
    if ($from === '') {
        // Every officer, whatever year they are on now, except those already there.
        return db_exec(
            'UPDATE officers SET school_year = ? WHERE archived_at IS NULL AND school_year <> ?',
            [$to, $to]
        );
    }
    return db_exec(
        'UPDATE officers SET school_year = ? WHERE archived_at IS NULL AND school_year = ?',
        [$to, $from]
    );
}

/** Officer option lists grouped as field_key => school_year => [values…]. */
function officer_options_map(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $map = [];
    if (db_ok() && db_table_exists('officer_options')) {
        // Alphabetical: no manual ordering — the lists are plain A–Z values.
        // Archived options stay out of the Officers form dropdowns.
        $scope = db_column_exists('officer_options', 'archived_at') ? ' WHERE archived_at IS NULL' : '';
        $rows = db_all('SELECT field_key, school_year, value FROM officer_options' . $scope . ' ORDER BY value ASC');
        foreach ($rows as $r) {
            $map[(string) $r['field_key']][(string) $r['school_year']][] = (string) $r['value'];
        }
    }
    $cache = $map;
    return $map;
}

/** Collection meta shaped for the admin panel (labels, resolved select options). */
function collection_admin_meta(string $key): ?array
{
    $meta = collection_meta($key);
    if (!$meta) {
        return null;
    }
    $officerOpts = ($key === 'officers') ? officer_options_map() : null;
    $fields = [];
    foreach ($meta['fields'] as $f) {
        $f = $f + ['required' => false, 'type' => 'text'];
        // Officers: dropdown values are managed in Officer Options, per school year.
        if ($officerOpts !== null && !empty($f['officer_option'])) {
            $fk = (string) $f['officer_option'];
            $byYear = $officerOpts[$fk] ?? [];
            if ($fk === 'school_year') {
                $years = array_keys($byYear);
                rsort($years, SORT_NATURAL);
                $f['options'] = array_map(static fn($y) => ['value' => (string) $y, 'label' => (string) $y], $years);
                $f['options_by_year'] = [];
            } else {
                $optByYear = [];
                $flat = [];
                foreach ($byYear as $year => $vals) {
                    $optByYear[(string) $year] = array_map(static fn($v) => ['value' => (string) $v, 'label' => (string) $v], $vals);
                    foreach ($vals as $v) {
                        $flat[(string) $v] = true;
                    }
                }
                $f['options'] = array_map(static fn($v) => ['value' => (string) $v, 'label' => (string) $v], array_keys($flat));
                $f['options_by_year'] = $optByYear;
            }
            $fields[] = $f;
            continue;
        }
        if (($f['type'] ?? '') === 'select') {
            $options = [];
            if (!empty($f['options'])) {
                foreach ($f['options'] as $val => $lab) {
                    $options[] = ['value' => (string) $val, 'label' => $lab];
                }
            } elseif (!empty($f['options_from'])) {
                $src = collection_meta($f['options_from']);
                if ($src) {
                    foreach (db_all('SELECT id, ' . $src['title'] . ' AS label FROM ' . $src['table'] . ' ORDER BY ' . $src['order']) as $row) {
                        $options[] = ['value' => (string) $row['id'], 'label' => (string) $row['label']];
                    }
                }
            }
            $f['options'] = $options;
        }
        $fields[] = $f;
    }
    return [
        'key'     => $key,
        'label'   => $meta['label'],
        'title'   => $meta['title'],
        'fields'  => $fields,
    ];
}