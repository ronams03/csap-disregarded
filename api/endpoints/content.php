<?php
declare(strict_types=1);

/** resource=content — public payload consumed by assets/js/cms.js */
function csap_endpoint_content(): void
{
    json_ok(content_payload());
}