<?php
declare(strict_types=1);

/** resource=upload — stores an image under assets/images/uploads/ */
function csap_endpoint_upload(): void
{
    require_auth();
    csrf_verify();

    if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
        json_fail('No file was uploaded.', 422);
    }
    $f = $_FILES['file'];
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_fail('Upload failed (code ' . (int) $f['error'] . ').', 422);
    }
    if (($f['size'] ?? 0) > 5 * 1024 * 1024) {
        json_fail('File is too large (maximum 5 MB).', 422);
    }

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $mime = '';
    if (function_exists('getimagesize')) {
        $info = @getimagesize($f['tmp_name']);
        $mime = is_array($info) ? (string) ($info['mime'] ?? '') : '';
    }
    if (!isset($allowed[$mime]) && function_exists('mime_content_type')) {
        $mime = (string) @mime_content_type($f['tmp_name']);
    }
    if (!isset($allowed[$mime])) {
        json_fail('Only JPG, PNG, WEBP or GIF images are allowed.', 422);
    }

    $dir = dirname(__DIR__, 2) . '/assets/images/uploads';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
        json_fail('Could not create the uploads folder.', 500);
    }
    $name = 'img-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
    if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        json_fail('Could not store the uploaded file.', 500);
    }

    $path = 'assets/images/uploads/' . $name;
    activity_log('upload', 'media', $path);
    json_ok(['path' => $path]);
}