<?php
/* ==========================================================================
   CSAP-COC  |  Import the CSAP scholar masterlist (system-data/CSAP.xlsx)
   into the `students` table.

   Usage (CLI):
     php api/import-students.php [options] [path-to-xlsx]

   Options:
     --school-year=YYYY-YYYY   School year for the imported records
                               (default: current school year, Aug-Jul cutoff)
     --dry-run                 Parse and validate only; write nothing

   The spreadsheet layout (single sheet):
     B = NAME OF SCHOLAR  ("LASTNAME, FIRSTNAME MI. EXT")
     C = YEAR             (year level as a number, e.g. 2)
     D = COURSE           (program code, e.g. BSIT)
     E = SCHOOL           (ignored)

   Safe to re-run: a row already in the database (same name + school year) is
   skipped — rows sitting in Archive storage count as imported too — so
   nothing is ever duplicated.
   ========================================================================== */
declare(strict_types=1);

require __DIR__ . '/config/database.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This importer runs from the command line only.\n");
    exit(1);
}

/* -- Arguments ------------------------------------------------------------ */
$dryRun = false;
$sy     = null;
$path   = null;
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--dry-run') {
        $dryRun = true;
    } elseif (strpos($arg, '--school-year=') === 0) {
        $sy = substr($arg, 14);
    } elseif ($arg !== '' && $arg[0] !== '-') {
        $path = $arg;
    } else {
        fwrite(STDERR, "Unknown option: $arg\n");
        exit(1);
    }
}
if ($sy === null) {
    $syStart = (int) date('n') >= 8 ? (int) date('Y') : (int) date('Y') - 1;
    $sy = $syStart . '-' . ($syStart + 1);
}
if (!preg_match('/^\d{4}-\d{4}$/', $sy)) {
    fwrite(STDERR, "Invalid --school-year: $sy (expected e.g. 2026-2027)\n");
    exit(1);
}
if ($path === null) {
    $path = __DIR__ . '/../system-data/CSAP.xlsx';
}
if (!is_file($path)) {
    fwrite(STDERR, "File not found: $path\n");
    exit(1);
}

/* -- Program -> department mapping (PHINMA COC colleges) ------------------ */
$programDepartment = [
    // CMA — College of Management and Accountancy
    'BSBA' => 'CMA', 'BSBA-FM' => 'CMA', 'BSBA-MM' => 'CMA', 'BSA' => 'CMA', 'BSMA' => 'CMA',
    'BSHM' => 'CMA', 'BSHRM' => 'CMA', 'BSTM' => 'CMA',
    // COED — College of Education
    'BEED' => 'COED', 'BECED' => 'COED', 'BSED' => 'COED',
    'BSED-ENG' => 'COED', 'BSED-FIL' => 'COED', 'BSED-MATH' => 'COED',
    // SCCJ — School of Criminology and Criminal Justice
    'BSCRIM' => 'SCCJ',
    // CAHS — College of Allied Health and Sciences
    'BSN' => 'CAHS', 'BS PHARM' => 'CAHS', 'BS MED TECH' => 'CAHS', 'BS PSYCH' => 'CAHS',
    // CITE — College of Information Technology
    'BSIT' => 'CITE',
    // CEA — College of Engineering and Architecture
    'BSCE' => 'CEA', 'BSCPE' => 'CEA', 'BSEE' => 'CEA', 'BSME' => 'CEA', 'BS ARCH' => 'CEA',
];

$ordinalYear = [1 => '1st Year', 2 => '2nd Year', 3 => '3rd Year', 4 => '4th Year', 5 => '5th Year'];

/* -- Minimal zip reader (xlsx is a zip; ext-zip is not required) ---------- */
function xlsx_zip_read(string $path, string $want): ?string
{
    $data = file_get_contents($path);
    if ($data === false) {
        return null;
    }
    $eocd = strrpos($data, "PK\x05\x06");
    if ($eocd === false) {
        return null;
    }
    $cdOffset = unpack('V', substr($data, $eocd + 16, 4))[1];
    $entries  = unpack('v', substr($data, $eocd + 10, 2))[1];
    $p = $cdOffset;
    for ($i = 0; $i < $entries; $i++) {
        if (substr($data, $p, 4) !== "PK\x01\x02") {
            return null;
        }
        $method     = unpack('v', substr($data, $p + 10, 2))[1];
        $compSize   = unpack('V', substr($data, $p + 20, 4))[1];
        $nameLen    = unpack('v', substr($data, $p + 28, 2))[1];
        $extraLen   = unpack('v', substr($data, $p + 30, 2))[1];
        $commentLen = unpack('v', substr($data, $p + 32, 2))[1];
        $localOff   = unpack('V', substr($data, $p + 42, 4))[1];
        $name       = substr($data, $p + 46, $nameLen);
        if ($name === $want) {
            if (substr($data, $localOff, 4) !== "PK\x03\x04") {
                return null;
            }
            $lNameLen  = unpack('v', substr($data, $localOff + 26, 2))[1];
            $lExtraLen = unpack('v', substr($data, $localOff + 28, 2))[1];
            $start     = $localOff + 30 + $lNameLen + $lExtraLen;
            $raw       = substr($data, $start, $compSize);
            if ($method === 8) {
                return gzinflate($raw) ?: null;
            }
            if ($method === 0) {
                return $raw;
            }
            return null;
        }
        $p += 46 + $nameLen + $extraLen + $commentLen;
    }
    return null;
}

/* -- Parse the spreadsheet ------------------------------------------------ */
$sharedXml = xlsx_zip_read($path, 'xl/sharedStrings.xml');
$sheetXml  = xlsx_zip_read($path, 'xl/worksheets/sheet1.xml');
if ($sheetXml === null) {
    fwrite(STDERR, "Could not read the worksheet from $path\n");
    exit(1);
}

$shared = [];
if ($sharedXml !== null) {
    $ss = simplexml_load_string($sharedXml);
    if ($ss === false) {
        fwrite(STDERR, "Could not parse sharedStrings.xml\n");
        exit(1);
    }
    foreach ($ss->si as $si) {
        $txt = '';
        if (isset($si->t)) {
            $txt = (string) $si->t;
        } else {
            foreach ($si->r as $r) {
                $txt .= (string) $r->t;
            }
        }
        $shared[] = $txt;
    }
}

$sheet = simplexml_load_string($sheetXml);
if ($sheet === false) {
    fwrite(STDERR, "Could not parse the worksheet XML\n");
    exit(1);
}

$rows = [];
foreach ($sheet->sheetData->row as $row) {
    $cells = [];
    foreach ($row->c as $c) {
        preg_match('/^([A-Z]+)/', (string) $c['r'], $m);
        if (!$m) {
            continue;
        }
        $type = (string) $c['t'];
        $v    = isset($c->v) ? (string) $c->v : '';
        if ($type === 's') {
            $v = $shared[(int) $v] ?? '';
        } elseif ($type === 'inlineStr' && isset($c->is->t)) {
            $v = (string) $c->is->t;
        }
        $cells[$m[1]] = trim($v);
    }
    $rows[] = $cells;
}

/* -- Build the records ---------------------------------------------------- */
$records  = [];
$skipped  = [];      // row => reason
$warnings = [];
$extensions = ['JR', 'SR', 'II', 'III', 'IV'];

foreach ($rows as $idx => $cells) {
    $rowNo = $idx + 1;
    $name  = $cells['B'] ?? '';
    if ($name === '' || stripos($name, 'NAME OF SCHOLAR') !== false) {
        continue;
    }

    if (strpos($name, ',') === false) {
        $skipped[] = "row $rowNo: no comma in name \"$name\"";
        continue;
    }
    [$last, $rest] = explode(',', $name, 2);
    $last  = trim(preg_replace('/\s+/', ' ', $last));
    $parts = preg_split('/\s+/', trim($rest)) ?: [];
    if ($last === '' || !$parts) {
        $skipped[] = "row $rowNo: empty name part in \"$name\"";
        continue;
    }

    $ext = '';
    $lastTok = strtoupper(rtrim((string) end($parts), '.'));
    if (in_array($lastTok, $extensions, true)) {
        $ext = (string) array_pop($parts);
    }

    $middle = '';
    if (count($parts) > 1 && preg_match('/^[A-Z]\.$/', (string) end($parts))) {
        $middle = (string) array_pop($parts);
    }
    $first = trim(preg_replace('/\s+/', ' ', implode(' ', $parts)));
    if ($first === '') {
        $skipped[] = "row $rowNo: empty first name in \"$name\"";
        continue;
    }

    $yearRaw = $cells['C'] ?? '';
    $yearNum = (int) floatval($yearRaw);
    if (!isset($ordinalYear[$yearNum])) {
        $warnings[] = "row $rowNo: unknown year \"$yearRaw\" ($name)";
    }

    $program = $cells['D'] ?? '';
    if ($program === '') {
        $warnings[] = "row $rowNo: missing course ($name)";
    } elseif (!isset($programDepartment[$program])) {
        $warnings[] = "row $rowNo: unmapped course \"$program\" ($name)";
    }

    $records[] = [
        'last_name'  => $last,
        'first_name' => $first,
        'middle_name' => $middle !== '' ? $middle : null,
        'name_ext'   => $ext !== '' ? $ext : null,
        'department' => $programDepartment[$program] ?? null,
        'program'    => $program !== '' ? $program : null,
        'year_level' => $ordinalYear[$yearNum] ?? null,
        'school_year' => $sy,
        'enrollment_status' => 'Enrolled',
    ];
}

/* -- Deduplicate against what is already in the database ------------------ */
$pdo = db();
if (!$pdo) {
    fwrite(STDERR, "Cannot connect to the database.\n");
    exit(1);
}

/* Every row already stored counts as imported — including the ones sitting in
   Archive storage, so re-running the import never duplicates a student who
   was archived (restore those from the admin Archive page instead). */
$existing = [];
$archivedKeys = [];
$keyOf = static fn(array $r): string => strtoupper(
    $r['last_name'] . '|' . $r['first_name'] . '|' . ($r['middle_name'] ?? '') . '|' . $r['school_year']
);
foreach (db_all('SELECT last_name, first_name, COALESCE(middle_name, "") AS middle_name, school_year, archived_at FROM students') as $r) {
    if ($r['archived_at'] !== null) {
        $archivedKeys[$keyOf($r)] = true;
    } else {
        $existing[$keyOf($r)] = true;
    }
}

$toInsert = [];
$dupes    = 0;
$archived = 0;
foreach ($records as $rec) {
    $key = strtoupper($rec['last_name'] . '|' . $rec['first_name'] . '|' . ($rec['middle_name'] ?? '') . '|' . $sy);
    if (isset($existing[$key])) {
        $dupes++;
        continue;
    }
    if (isset($archivedKeys[$key])) {
        $archived++;
        continue;
    }
    $toInsert[] = $rec;
}

/* -- Report --------------------------------------------------------------- */
echo "CSAP students import\n";
echo "  source      : $path\n";
echo "  school year : $sy\n";
echo "  mode        : " . ($dryRun ? 'DRY RUN (nothing written)' : 'import') . "\n\n";
echo 'Parsed spreadsheet rows : ' . count($records) . "\n";
echo "Skipped (bad rows)      : " . count($skipped) . "\n";
echo "Already in database     : $dupes\n";
echo "In Archive storage      : $archived" . ($archived ? ' (restore from the admin Archive page if needed)' : '') . "\n";
echo 'To insert               : ' . count($toInsert) . "\n";
if ($warnings) {
    echo "\nWarnings:\n";
    foreach (array_slice($warnings, 0, 20) as $w) {
        echo "  - $w\n";
    }
    if (count($warnings) > 20) {
        echo '  ... and ' . (count($warnings) - 20) . " more\n";
    }
}
if ($skipped) {
    echo "\nSkipped rows:\n";
    foreach (array_slice($skipped, 0, 20) as $s) {
        echo "  - $s\n";
    }
}

if ($dryRun || !$toInsert) {
    echo "\nDone" . ($dryRun ? ' (dry run).' : '.') . "\n";
    exit(0);
}

/* -- Insert --------------------------------------------------------------- */
$stmt = $pdo->prepare(
    'INSERT INTO students
        (last_name, first_name, middle_name, name_ext, department, program, year_level, school_year, enrollment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$pdo->beginTransaction();
try {
    foreach ($toInsert as $rec) {
        $stmt->execute([
            $rec['last_name'], $rec['first_name'], $rec['middle_name'], $rec['name_ext'],
            $rec['department'], $rec['program'], $rec['year_level'], $rec['school_year'],
            $rec['enrollment_status'],
        ]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, 'Import failed, rolled back: ' . $e->getMessage() . "\n");
    exit(1);
}

echo "\nInserted " . count($toInsert) . " student(s).\n";
echo 'Students in database (active): ' . (int) db_val('SELECT COUNT(*) FROM students WHERE archived_at IS NULL') . "\n";
