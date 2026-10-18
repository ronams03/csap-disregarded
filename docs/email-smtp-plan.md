# CSAP-COC — Daily Bulk Student Email (End-to-End Plan)

Status: **Plan / not yet implemented**
Target: send to **3,000+ student addresses every day, at least once**, as `@phinmaed.com`, from the CSAP-COC admin system.

---

## 1. Goal & constraints

| Item | Value |
|---|---|
| Volume | **3,000+ recipients per day, every day** (recurring, not one-off) |
| Cadence | At least one send per student per 24h — a scheduled daily job, not a manual blast |
| Sender identity | An address on the `phinmaed.com` Google Workspace domain |
| Transport | **PHPMailer → `smtp-relay.gmail.com`** (decided) — *see §2b for the daily-volume caveat* |
| Recipient source | *Deferred* — will be a stored list + CSV import (Phase 5) |
| Runtime | XAMPP (PHP 8.1+) on Windows for dev; a real host for production |

**Deliverable of this plan:** a queue-backed, scheduler-driven mailer that pushes ~3k/day reliably, respects Google limits and policy, is resumable, and never double-sends.

**Critical question that changes the design:** are the students' mailboxes `@phinmaed.com` (same Workspace domain) or personal (Gmail/Yahoo/Outlook)? Read §2b before building — it decides whether relay is acceptable at this volume.

---

## 2. Why SMTP relay (and not Apps Script)

Google Apps Script `MailApp`/`GmailApp` exposes **no SMTP host/user/password** — a script always sends as the account running it, capped at **1,500 recipients/day** (2,000 within-domain) on Workspace. That cannot deliver 4k in one day from one account.

The **Gmail SMTP relay service** (`smtp-relay.gmail.com`) is a separate, Workspace-admin-enabled service with much higher limits:

| Limit | Value |
|---|---|
| Messages/day per user | 10,000 |
| Unique recipients/day per user | 10,000 |
| Recipients per SMTP transaction | **100** (exceeding = error; start a new connection/RSET) |
| Org-wide total | 4.6M / 24h |

**Quota-wise, 3k/day fits:** one authenticated `@phinmaed.com` account can push 10,000 messages / 10,000 unique recipients per rolling 24h, and the org ceiling is 4.6M recipients/24h. 3k is ~30% of the per-user cap, leaving headroom for a second send. 3k also means ~30 SMTP transactions at the 100-RCPT limit.

> A monthly one-off blast would be safe. **A 3k/day *recurring* pattern is categorically different** — see §2b.

---

## 2b. Daily volume: is the relay the right tool? (read this first)

Google's own guidance separates the two cases, and the answer depends on **where the student mailboxes live**:

### Case A — students are `@phinmaed.com` (same Workspace domain)
- Delivery is **intra-domain**, and Gmail's bulk-sender rules explicitly do **not** apply to "Google Workspace inbound and intra-domain messages."
- 3k/day intra-domain via relay is well within quota and normal for an organization mailing its own members.
- ✅ **Relay is acceptable.** Keep `smtp-relay.gmail.com`, send to internal addresses.
- **Cost: $0 extra** — the relay is part of the Workspace subscription and the sender is an existing seat.
- Alternative worth evaluating: a **Google Group** (e.g. `students@phinmaed.com`) that PHINMA IT auto-populates; posting to the group fans out to members. Less code to own, but group posting has its own limits and gives you no per-recipient queue/status. Only choose this if you don't need delivery tracking.

### Case B — students are personal addresses (Gmail/Yahoo/Outlook) or mixed
- Google states the relay is for "on-premise devices and applications" — **not bulk/marketing**. The Workspace AUP **prohibits unsolicited marketing**, and Google's SMTP relay spam policy monitors, rate-limits, then **suspends accounts** — a 3k/day pattern is exactly what trips it.
- Also: Gmail requires bulk senders (≈5k+/day to Gmail) to have SPF **and** DKIM aligned, DMARC, TLS, a spam rate < 0.3%, and **one-click unsubscribe**; enforcement has been ramping since Nov 2025.
- ⚠️ **Do not build a daily 3k blast on the relay.** You will lose the sending account (24h+ suspension, then flagged for faster re-suspension) and damage `phinmaed.com`'s reputation for normal staff mail.

**Recommended for Case B:** a dedicated ESP for the daily bulk, and keep Workspace for staff/internal mail. Yes, that's ~$9–35/mo — but the "free" relay path here is the one that gets the Workspace account suspended and degrades `phinmaed.com` mail for staff, so the ESP is cheap insurance, not an upsell.

| Option | Free tier | Cost at 3k/day (~90k/mo) | Notes |
|---|---|---|---|
| **Amazon SES** | 3k msgs/mo (EC2-linked) | **~$9/mo** ($0.10/1k) | Cheapest at volume; needs production-access request (24–72h); you manage bounces/complaints; can DKIM-sign `phinmaed.com` |
| **Brevo** | 300/day | ~$25–35/mo | Marketing features built in (unsubscribe, templates) |
| **SendGrid / Mailgun / Postmark** | 100/day / trial / trial | ~$20–35/mo | Good tooling, higher price |

Either way the ESP must be added to `phinmaed.com`'s SPF/DKIM — PHINMA IT involvement required.

> **Decision to make before Phase 1:** Case A (relay, as already chosen) or Case B (ESP). Everything below works with either — the transport is isolated in `api/helpers/mailer.php`, so switching is a one-file change.

---

## 3. Architecture

```
admin/index.html  (Compose / Recipients / Campaigns page)
        │  fetch  ?r=mail&a=...
        ▼
api/index.php  ──router──▶  api/endpoints/mail.php
                                  │  require_superadmin() + csrf_verify()
                                  ├─ recipients CRUD / CSV import      (Phase 5)
                                  ├─ campaign + queue creation  ─────▶ email_queue
                                  ├─ daily schedule config       ─────▶ cron / Task Scheduler
                                  └─ dispatch kick (spawns worker or in-request batch)
        ▼
api/worker.php  (CLI, resumable)
        │  pulls pending batches (≤50/loop, ≤100 RCPT/transaction)
        ▼
api/helpers/mailer.php  ──▶  PHPMailer  ──▶  smtp-relay.gmail.com:587 (TLS)
                                  │            auth: user + App Password
                                  ▼
                        email_queue row updated: sent | failed | retry
                        email_campaigns counters updated
                        activity_logs entry written
```

Key property: **the HTTP request never sends the 3k emails.** It creates the queue and exits; a scheduler-driven worker drains it. This survives timeouts, is resumable, and is safe to re-run.

---

## 4. Prerequisites (Google Workspace — admin action, not code)

1. **Enable SMTP relay service** in Google Admin console → Apps → Gmail → Routing → SMTP relay service. Restrict by:
   - IP allowlist (production server's static outbound IP), **or**
   - SMTP AUTH (required for XAMPP/local dev, since local IP can't be allowlisted).
2. **Sender account**: a `@phinmaed.com` user (e.g. `noreply@phinmaed.com` or `csapcoc@phinmaed.com`).
3. **App Password**: enable 2-Step Verification on that sender account, then generate a 16-char App Password. (SMTP AUTH to the relay requires this; the account's normal password will not work.)
4. **DNS/deliverability**: ensure SPF includes Google, DKIM signing is enabled for the domain, and a DMARC policy exists. Get exact SPF/DKIM records from Admin console.
5. **Confirm available daily quota** for the sender account (trial Workspace accounts are lower).

Store on the CSAP-COC side (never in git):
```
CSAP_SMTP_HOST=smtp-relay.gmail.com
CSAP_SMTP_PORT=587
CSAP_SMTP_SECURE=tls
CSAP_SMTP_USER=noreply@phinmaed.com
CSAP_SMTP_PASS=<16-char app password>
CSAP_MAIL_FROM=noreply@phinmaed.com
CSAP_MAIL_FROM_NAME=CSAP-COC
CSAP_MAIL_BATCH=50            # recipients processed per loop
CSAP_MAIL_DAILY_CAP=9000      # safety margin under 10k
```

---

## 5. Dependencies

- **PHPMailer** — `composer require phpmailer/phpmailer`. Composer is **not** installed in this repo, so either:
  - install Composer and add `composer.json` + `vendor/` (recommended), or
  - vendor PHPMailer source into `api/vendor/phpmailer/` manually and `require` it.
- No other third-party libs needed; reuse existing PDO layer (`api/config/database.php`).

---

## 6. Database changes

Add to `database/schema.sql` **and** to `csap_migrate()` in `api/helpers/install.php` (idempotent, guarded by `db_table_exists`).

### `email_recipients` *(Phase 5)*
```
id, name VARCHAR(160), email VARCHAR(190) UNIQUE,
program VARCHAR(120), year_level VARCHAR(40),
is_subscribed TINYINT(1) DEFAULT 1, source VARCHAR(60),
created_at, archived_at
KEY idx_email (email), KEY idx_subscribed (is_subscribed)
```

### `email_campaigns`
```
id, subject VARCHAR(255), html_body LONGTEXT, text_body TEXT,
from_name VARCHAR(160), reply_to VARCHAR(190),
status ENUM('draft','queued','sending','paused','done','failed') DEFAULT 'draft',
total INT, sent INT, failed INT,
created_by INT UNSIGNED, created_at, started_at, finished_at
```

### `email_queue`
```
id, campaign_id INT UNSIGNED, recipient VARCHAR(190), name VARCHAR(160),
status ENUM('pending','sent','failed','skipped') DEFAULT 'pending',
attempts TINYINT DEFAULT 0, error VARCHAR(300), provider_id VARCHAR(120),
sent_at DATETIME,
KEY idx_queue_pending (campaign_id, status)
```

### `email_daily_log` — the daily guarantee
```
id, recipient VARCHAR(190), send_date DATE, campaign_id INT UNSIGNED,
created_at TIMESTAMP,
UNIQUE KEY uniq_recipient_day (recipient, send_date)
```

### `email_suppressions`
```
id, email VARCHAR(190) UNIQUE, reason ENUM('unsubscribe','hard_bounce','complaint'),
created_at
```

`campaigns.created_by` and activity rows link to `admins.id`. All five tables go in both `schema.sql` and `csap_migrate()`.

---

## 7. File-by-file work plan

| File | Action |
|---|---|
| `database/schema.sql` | Add the three tables above. |
| `api/helpers/install.php` | Add `csap_migrate()` blocks to create them on existing installs. |
| `api/helpers/settings.php` *(new or extend)* | Register SMTP/mail settings; support secrets. |
| `api/helpers/mailer.php` *(new)* | Wrap PHPMailer: `mailer_send_batch(array $recipients, array $msg): array`. Handles TLS, From, Reply-To, HTML+text, per-transaction ≤100, errors. |
| `api/helpers/mailqueue.php` *(new)* | Queue helpers: `mail_enqueue_campaign()`, `mail_claim_batch()`, `mail_mark_sent/failed`, `mail_campaign_counters()`. |
| `api/endpoints/mail.php` *(new)* | Resource `mail`. Actions below. |
| `api/index.php` | `require_once` mail.php; add `case 'mail': csap_endpoint_mail($action, $method); break;`. |
| `api/worker.php` *(new)* | CLI drain loop with pacing, retries, daily-cap check, `--daily` (enqueue the day's campaign), `--campaign=ID`, `--dry-run`. |
| `api/helpers/schedule.php` *(new)* | Daily job: pick template/audience, respect `email_daily_log`, enqueue the day's campaign. |
| `admin/index.html` + `admin/assets/admin.js` | New "Mailing" nav group + page: compose, audience filter, CSV import, campaign list, live progress. |
| `admin/assets/admin.css` | Styles for the mailing page. |
| `.env.example` *(new)* | Document the `CSAP_*` vars (never commit real ones). |
| `.gitignore` | Ensure `.env`, `vendor/` policy, and any credential files are ignored. |

---

## 8. Endpoint contract (`?r=mail`)

All mutating calls go through `csrf_verify()`; all calls require `require_superadmin()`.

| Method | Query | Body | Purpose |
|---|---|---|---|
| GET | `a=config` | — | Return non-secret mail config + `MailApp`-equivalent remaining quota estimate. |
| GET | `a=campaigns` | — | List campaigns with counters. |
| GET | `a=campaign&id=` | — | One campaign + sample queue rows. |
| GET | `a=queue&id=` | — | Progress (pending/sent/failed) for a campaign. |
| POST | `a=test` | `{to}` | Send a single test message; verifies SMTP auth before a real blast. |
| POST | `a=send` | `{subject, html, text?, audience|recipients:[...], reply_to?}` | Create campaign + queue rows; returns `campaign_id`. Does **not** send. |
| POST | `a=dispatch&id=` | `{dry_run?}` | Kick the worker for one campaign (spawn CLI in prod; inline-batch in dev). |
| POST | `a=pause\|resume&id=` | — | Toggle campaign status. |
| GET | `a=recipients` *(P5)* | — | List/browse stored recipients. |
| POST | `a=import` *(P5)* | CSV upload | Parse, validate, dedupe emails, upsert recipients. |
| GET | `a=schedule` | — | Read the daily send time + active template. |
| POST | `a=schedule` | `{enabled, send_time, template_id, audience}` | Configure the daily job. |
| POST | `a=unsubscribe` | `{email, token}` | *(public)* honor opt-out; writes `email_suppressions`. |

---

## 9. Sending flow (worker)

1. Worker claims a batch: `UPDATE ... SET status='sending' WHERE campaign_id=? AND status='pending' LIMIT :batch` (row-lock / `SELECT ... FOR UPDATE SKIP LOCKED` if MySQL 8+).
2. Group up to **100** recipients per SMTP transaction; reuse one SMTP connection, **RSET** between transactions (or open a new connection). Connection pooling/reuse is explicitly required by Google for relay volume.
3. On success: mark `sent`, increment `campaign.sent`.
4. On failure: increment `attempts`; exponential backoff (**required** — Google responds to rapid retries with 421 rate-limiting); after N attempts (e.g. 3) mark `failed`, store `error`.
5. After each batch: check the rolling-24h sent counter against `CSAP_MAIL_DAILY_CAP`; if reached, pause campaign and stop until the window frees.
6. Pace evenly rather than bursting (Google: "send at a consistent rate, avoid bursts"). ~3k over a couple of hours is safer than 3k in five minutes.
7. When no `pending` remain → `status='done'`, set `finished_at`, write `activity_log('send','email', ...)`.

**Idempotency:** queue rows have a terminal status, so re-running the worker never double-sends a `sent` row.

### 9b. Daily recurring job ("at least once per day")

- A **daily scheduler** (`api/worker.php --daily` on cron/Task Scheduler) builds one campaign per day from the active audience and drains it. The admin composes the *template*; the schedule sends it.
- **Never double-send a student in a day:** add `email_daily_log (recipient VARCHAR(190), send_date DATE, campaign_id, UNIQUE KEY uniq_recipient_day (recipient, send_date))`. The enqueue step inserts here first; a duplicate insert = already sent today = skip. This must exist even if a retry or a second campaign runs the same day.
- **Per-user, not per-list:** if a student appears twice in the source (typo/alias), the unique key collapses them before sending.
- Failure/retry semantics: a `failed` row may retry same-day; a `sent` row may not.
- The worker is the only thing that sends; the scheduler only enqueues. That keeps the daily guarantee in one place.

---

## 10. Admin UI sketch

- **Compose (daily template)**: Subject, rich/HTML body, plain-text fallback (auto-derived if blank), Reply-To, From preview. Saved once; the scheduler sends it daily with the day's content.
- **Schedule**: on/off, send time, audience, and a preview of "who gets it today" (after `email_daily_log` dedupe).
- **Audience**: *Deferred* — for now, paste/upload a list; later, filter stored `email_recipients` by program/year level and subscription, minus `email_suppressions`.
- **Preview & test**: "Send test to me" (uses `a=test`).
- **Send now (override)**: creates a campaign → progress bar polled from `a=queue&id=`.
- **Campaigns**: table of past daily sends with sent/failed counts, skipped-today count, and a per-campaign CSV of failures.

---

## 11. Security & privacy

- App Password stored **only** as an env var / secret setting, never echoed by `a=config`, never written to `activity_logs`.
- Superadmin-only; CSRF on every mutation (matches `users.php`).
- Rate-limit `a=test` to prevent using the relay as an open sender.
- **Data Privacy Act (RA 10173)**: store student emails only with a lawful basis; include an unsubscribe line + `List-Unsubscribe` header; honor `is_subscribed`; support deletion/archival. Log *counts*, not message bodies, in the audit trail.

---

## 12. Deliverability checklist (mandatory at 3k/day)

- [ ] SPF includes `_spf.google.com` (and the ESP's mechanism in Case B).
- [ ] DKIM enabled for `phinmaed.com`; `From` domain **aligned** with SPF or DKIM.
- [ ] DMARC published (`p=none` → monitor → `quarantine`).
- [ ] TLS on the SMTP connection (Google rejects bulk-over-plaintext).
- [ ] **One-click unsubscribe** — `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) headers and honored within 48h. Required for marketing/promotional mail; effectively mandatory for a daily student digest.
- [ ] Subscribe to **Google Postmaster Tools** for `phinmaed.com`; keep user-reported spam rate **< 0.1%** (0.3% = ineligible for mitigation).
- [ ] **Warm up:** don't start at 3k/day from a cold sender. Ramp over 2–4 weeks (e.g. 300 → 800 → 1,500 → 3,000) and watch Postmaster before each step.
- [ ] Bounce/complaint handling: capture SMTP errors into `email_queue.error`, maintain a **suppression list** (`email_suppressions`), never re-send to hard bounces or unsubscribes.
- [ ] Consistent daily rate, no bursts — the scheduler in §9b is what enforces this.
- [ ] `Reply-To` a monitored mailbox; include a `List-Unsubscribe` and a physical/org footer (AUP + PH marketing norms).

---

## 13. Testing plan

1. **Unit-ish**: mailer builds a correct message; queue transitions are correct; daily-cap math; the `email_daily_log` unique key actually blocks a second same-day send.
2. **Local dev without a real relay**: run a local catcher (MailHog / Papercut / `smtp4dev`) and point `CSAP_SMTP_HOST` at it — proves scheduler + queue + worker + UI end-to-end with zero real mail.
3. **Single test**: `a=test` to your own address → confirm auth, `From`, `List-Unsubscribe` headers.
4. **Small batch**: 10 real recipients → confirm counting and statuses.
5. **3k dry-run**: `worker.php --dry-run` → confirm pacing, no duplicate sends, cap enforcement, and that a second run the same day sends **zero**.
6. **3k real (warm-up step)**: start at the current warm-up tier; monitor Postmaster Tools + `a=queue` for 48h before increasing.
7. Manual XAMPP check: no PHP timeout during `a=send` (it only queues, so should be instant).

---

## 14. Scheduling / ops (daily)

- **Two Cron/Task Scheduler entries:**
  1. Enqueue the daily campaign at a fixed off-peak time (e.g. 06:00) — `php api/worker.php --daily`.
  2. Drain the queue every 1–5 min — `php api/worker.php` (exits immediately if nothing pending).
- Windows: Task Scheduler (`schtasks /create /tn "CSAP mail drain" /tr "php C:\xampp\htdocs\csap-coc\api\worker.php" /sc minute /mo 5`). Production: system cron.
- **Monitor daily:** campaigns table, pending/failed counts, the rolling-24h cap, and Google Postmaster spam rate. Alert if a campaign sits in `sending` > N minutes or if `failed/total` > 2%.
- **Ops runbook:** pause/resume a campaign (`a=pause|resume`); re-drive `pending` only; export `failed` CSV; add addresses to `email_suppressions` from bounce exports.
- Rotation/expiry: the App Password can be revoked without code changes (env var); document who rotates it and where the Workspace admin console lives.

---

## 15. Rollout phases

0. **Decide Case A vs Case B** (§2b) — in-domain = relay; external/mixed = ESP. This gates everything else.
1. **Foundation** — schema + migration (`email_recipients`, `email_campaigns`, `email_queue`, `email_daily_log`, `email_suppressions`), PHPMailer vendored, `mailer.php`, `a=test` (proves SMTP auth).
2. **Queue + worker** — campaigns/queue, `a=send`/`a=dispatch`, `api/worker.php` with pacing/backoff/cap, pause/resume.
3. **Daily scheduler** — `--daily` enqueue, cadence config, `email_daily_log` enforcement, cron/Task Scheduler setup.
4. **Admin UI** — Mailing page (compose template, audience, progress, campaigns, failure export).
5. **Recipients** — `email_recipients` table, CSV import, audience filters, unsubscribe flow + suppression list.
6. **Deliverability & go-live** — SPF/DKIM/DMARC, Postmaster Tools, warm-up ramp over 2–4 weeks, privacy sign-off.

---

## 16. Open questions

- **Case A or Case B?** Are the 3k student mailboxes `@phinmaed.com` or personal addresses? This decides relay vs ESP and is the top blocker.
- Exact sender address (`noreply@phinmaed.com` vs a CSAP mailbox) and whether the relay should be IP-allowlisted in production.
- Whether PHINMA IT will (a) enable the relay service + generate the App Password, and (b) add ESP SPF/DKIM records to `phinmaed.com` if Case B.
- Content type of the daily send — transactional announcement vs marketing digest? Determines one-click-unsubscribe and AUP exposure.
- Where students' emails come from (registrar export format + refresh cadence) — blocks Phase 5.
- Production host + static outbound IP (allowlist vs SMTP AUTH).
- Delivery window: is a fixed 06:00 batch acceptable, or is per-student local timing needed? (Affects nothing structurally, but affects the scheduler.)
