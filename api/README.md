# CSAP-COC &mdash; API (PHP)

The **only** server-side code in this project. The public website (`../index.html`)
and the admin panel (`../admin/`) are static HTML/CSS/JS apps that talk to this API
over `fetch()`. Nothing else renders HTML on the server.

## Layout

Every PHP file in the project lives under `api/` — the site (`index.html`) and the
admin panel (`../admin/`) are static and only consume this JSON API.

```
api/
├── index.php              # single JSON front controller (all resources)
├── install.php            # one-time installer (CLI or web)
├── import-students.php    # CLI: import system-data/CSAP.xlsx into `students`
├── config/
│   └── database.php       # PDO connection + query helpers (reads env / .env)
├── endpoints/
│   ├── auth.php           # login / logout / me
│   ├── content.php        # public payload for the front page
│   ├── dashboard.php      # admin statistics
│   ├── blocks.php         # editable content blocks per page
│   ├── collection.php     # generic CRUD for every list
│   ├── settings.php       # site settings
│   ├── profile.php        # signed-in admin profile
│   ├── users.php          # administrator management (superadmin)
│   ├── activity.php       # audit trail
│   └── upload.php         # image upload -> assets/images/uploads/
├── helpers/
│   ├── response.php       # JSON envelope + request helpers
│   ├── auth.php           # session auth + CSRF
│   ├── collections.php    # collection registry + CRUD engine
│   ├── content.php        # settings/blocks/nav readers
│   ├── activity.php       # activity log writer
│   └── install.php        # schema runner + seeding
└── seed.php               # default content (fallback + installer data)
```

## Calling the API

Everything goes through `api/index.php?r=<resource>`:

| Resource     | Method | Example                                                        |
|--------------|--------|----------------------------------------------------------------|
| `content`    | GET    | `?r=content`                                                    |
| `auth`       | POST   | `?r=auth&a=login` &middot; `?r=auth&a=logout` &middot; GET `?r=auth&a=me` |
| `dashboard`  | GET    | `?r=dashboard`                                                  |
| `blocks`     | GET/POST | `?r=blocks&page=hero`                                         |
| `collection` | GET/POST/PUT/DELETE | `?r=collection&name=leaders&id=1`                  |
| `settings`   | GET/POST | `?r=settings`                                                 |
| `profile`    | GET/POST | `?r=profile`                                                  |
| `users`      | GET/POST/PUT/DELETE | `?r=users&id=2` (superadmin only)                  |
| `upload`     | POST   | `?r=upload` (multipart `file`)                                  |
| `ping`       | GET    | `?r=ping`                                                       |

Send `X-HTTP-Method-Override` or `?_method=PUT` when a client cannot send `PUT`.
Mutating requests require the session cookie **and** the `X-CSRF-Token` header
returned by `auth&a=me` / `auth&a=login`.

## Lists, paging and Archive storage

Every list in the admin panel reads the same query contract, so paging, search
and the dropdown filters behave identically everywhere (Student Management,
Archive storage, the content-page lists, officer options, admin users):

| Parameter          | Meaning                                                              |
|--------------------|----------------------------------------------------------------------|
| `q`                | free-text search across the collection's fields                      |
| `f_<field>`        | exact-match filter on one field (dropdowns in the filter card)        |
| `archived=1`       | read Archive storage instead of the working list                     |
| `meta=1`           | return ONLY the collection's field definitions (used by Add forms, never pulls rows) |
| `limit` / `offset` | page size (max 500) and page start                                   |
| → `total`          | always returned: the full match count behind the current page        |

Unpaged reads are capped at `COLLECTION_MAX_UNBOUNDED` (2000) rows as a safety
net; list views always page, and the admin's search boxes/filters apply live
(debounced) so no "Search" click is required.

Bulk Archive-storage operations are `POST ?r=collection&name=<name>&a=archive|restore`
with `{"ids":[...]}`. Add `&all=1` (plus the same `q` / `f_*` / `archived`
parameters) to act on **every** record matching the current filters instead of
the selected ids — that is how the admin's “Restore all” button restores
thousands of records without loading them all into the browser.

## Conventions

* Always answers with JSON: `Content-Type: application/json; charset=utf-8`.
* Uses PDO prepared statements &mdash; never concatenates SQL, and only
  whitelisted collection names/tables are ever queried.
* Consistent envelope:
  ```json
  { "success": true, "data": [], "error": null }
  ```
* Keep credentials out of source control (`.env` + `.gitignore`).

## Database

The schema lives in `../database/schema.sql`. Import it, then seed the default
content and first administrator:

```bash
mysql -u root -p < ../database/schema.sql
php install.php            # or open http://localhost/csap-coc/api/install.php
```

You normally do not need to run anything by hand: the first API request
auto-installs the schema and seed data. The default account is **admin /
admin123** &mdash; change it from *Admin Panel &rarr; Profile* immediately.

Default local connection for XAMPP is `127.0.0.1` / user `root` / empty password.
Override with the `CSAP_DB_HOST`, `CSAP_DB_PORT`, `CSAP_DB_NAME`, `CSAP_DB_USER`
and `CSAP_DB_PASS` environment variables.
