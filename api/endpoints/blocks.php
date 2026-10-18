<?php
declare(strict_types=1);

/** resource=blocks&page=hero */
function csap_endpoint_blocks(string $method): void
{
    require_auth();
    $page = (string) ($_GET['page'] ?? '');
    if (!isset(csap_block_pages()[$page])) {
        json_fail('Unknown page.', 404);
    }
    $meta = csap_block_pages()[$page];

    if ($method === 'GET') {
        json_ok([
            'page'   => $page,
            'label'  => $meta['label'],
            'blocks' => array_values(page_blocks($page)),
        ]);
    }

    csrf_verify();
    $body = request_body();
    $values = isset($body['blocks']) && is_array($body['blocks']) ? $body['blocks'] : $body;
    save_blocks($page, is_array($values) ? $values : []);
    activity_log('save', 'block:' . $page, count((array) $values) . ' field(s) updated');

    json_ok([
        'page'   => $page,
        'label'  => $meta['label'],
        'blocks' => array_values(page_blocks($page)),
    ]);
}