-- ============================================================================
--  CSAP-COC  |  MySQL schema (full content model)
--  City Scholars' Association in PHINMA Cagayan de Oro College
--
--  Import once with:   mysql -u root -p < database/schema.sql
--  Tables are created here; the default content + first admin account are
--  seeded by:          php api/install.php
--  (or open http://localhost/csap-coc/api/install.php in a browser)
--  Scholar masterlist: php api/import-students.php [--dry-run]
--
--  NOTE: this folder holds SQL only — every PHP file lives under api/.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS csap_coc
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE csap_coc;

-- ---------------------------------------------------------------------------
-- 1. Admin users (accounts + profile details)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(160) NOT NULL,
  username      VARCHAR(60)  NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('superadmin','editor') NOT NULL DEFAULT 'editor',
  phone         VARCHAR(60)  NULL,
  bio           VARCHAR(500) NULL,
  avatar        VARCHAR(255) NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login    DATETIME     NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_admin_username (username),
  UNIQUE KEY uniq_admin_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. Site settings (key/value, grouped, used by the Settings page)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  skey       VARCHAR(80)  NOT NULL,
  svalue     TEXT         NULL,
  label      VARCHAR(120) NOT NULL DEFAULT '',
  sgroup     VARCHAR(60)  NOT NULL DEFAULT 'general',
  stype      VARCHAR(20)  NOT NULL DEFAULT 'text',   -- text|textarea|image|url|color|lx
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_setting_key (skey)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. Content blocks (single-instance editable fields, grouped by page)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_blocks (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  page_key   VARCHAR(60)  NOT NULL,
  block_key  VARCHAR(80)  NOT NULL,
  value      LONGTEXT     NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_block (page_key, block_key)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. Navigation (front-page menu incl. dropdown children)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label      VARCHAR(120) NOT NULL,
  href       VARCHAR(190) NOT NULL DEFAULT '#',
  parent_id  INT UNSIGNED NULL,
  is_cta     TINYINT(1)   NOT NULL DEFAULT 0,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id),
  KEY idx_nav_parent (parent_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. Leadership lineage (past & present presidents)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leaders (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NOT NULL,
  position   VARCHAR(120) NOT NULL DEFAULT 'President',
  term       VARCHAR(60)  NOT NULL,
  is_current TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. Officers (executives, directors, representatives, committees)
--    NOTE (officers): one full set of officers belongs to ONE school year
--    (e.g. "2025-2026"), because the roster changes every school year.
--    The public site groups/filters by `school_year` and defaults to the
--    latest year. `sort_order` is assigned automatically by the API on
--    create (see collection_save()), so admins never type it manually.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS officers (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  category   VARCHAR(80)  NOT NULL,
  department VARCHAR(60)  NULL,
  year_level VARCHAR(40)  NULL,
  role       VARCHAR(120) NOT NULL,
  name       VARCHAR(160) NOT NULL,
  comment    TEXT         NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id),
  KEY idx_officers_category (category),
  KEY idx_officers_school_year (school_year)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6b. Officer option lists (dropdown values for the Officers form)
--     One list per school year, grouped by `field_key`:
--     school_year | category | department | year_level | role.
--     Managed from the admin "Officer Options" sidebar group.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS officer_options (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  school_year VARCHAR(20)  NOT NULL DEFAULT '',
  field_key   VARCHAR(30)  NOT NULL,
  value       VARCHAR(160) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  archived_at DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_officer_option (field_key, school_year, value),
  KEY idx_officer_options (field_key, school_year)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6c. Students (CSAP scholar masterlist)
--     Complete PHINMA COC student profile: personal details, academic record,
--     scholarship information and CSAP membership status. Managed from the
--     admin "Student Management" section (filters / search / create / list).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_no         VARCHAR(40)  NULL,               -- PHINMA COC student number
  last_name          VARCHAR(80)  NOT NULL,
  first_name         VARCHAR(80)  NOT NULL,
  middle_name        VARCHAR(80)  NULL,
  name_ext           VARCHAR(20)  NULL,               -- Jr., Sr., III
  sex                VARCHAR(10)  NULL,
  birth_date         DATE         NULL,
  email              VARCHAR(190) NULL,
  mobile             VARCHAR(40)  NULL,
  address            VARCHAR(255) NULL,               -- street / purok
  barangay           VARCHAR(120) NULL,
  city               VARCHAR(120) NULL,
  guardian_name      VARCHAR(160) NULL,               -- parent / guardian
  guardian_contact   VARCHAR(40)  NULL,
  campus             VARCHAR(20)  NULL,               -- Carmen | Puerto
  department         VARCHAR(120) NULL,               -- CMA, COED, SCCJ, CAHS, CITE, CEA
  program            VARCHAR(40)  NULL,               -- course code, e.g. BSIT
  year_level         VARCHAR(20)  NULL,
  section            VARCHAR(60)  NULL,
  school_year        VARCHAR(20)  NULL,               -- e.g. 2025-2026
  enrollment_status  VARCHAR(30)  NULL,               -- Enrolled | LOA | Dropped | Graduated | Transferred
  gwa                VARCHAR(10)  NULL,               -- general weighted average, e.g. 1.75
  scholarship_type   VARCHAR(40)  NULL,               -- City Scholar | HK Scholarship | City + HK | None
  csr_no             VARCHAR(60)  NULL,               -- City Scholar CSR number
  hk_grant           VARCHAR(20)  NULL,               -- HK5.5 | HK7.5 | HK10 | HK12.5
  scholarship_status VARCHAR(30)  NULL,               -- Active | On Probation | Untagged
  sdp_hours          INT          NULL,               -- Scholar Development Program hours rendered
  duty_hours         INT          NULL,               -- HK duty hours rendered
  membership_status  VARCHAR(30)  NULL,               -- Active member | Inactive | Alumni
  position           VARCHAR(120) NULL,               -- CSAP position / role, if any
  photo              VARCHAR(255) NULL,
  notes              TEXT         NULL,
  archived_at        DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_students_name (last_name, first_name),
  KEY idx_students_school_year (school_year),
  KEY idx_students_department (department),
  KEY idx_students_program (program),
  KEY idx_students_year_level (year_level)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. Announcements / organizational memorandums
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  document_url VARCHAR(500) NULL,
  image        VARCHAR(255) NULL,
  category     VARCHAR(80)  NOT NULL DEFAULT 'Memorandum',
  published_at DATE         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  archived_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 8. Events & stories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(220) NOT NULL,
  kind         ENUM('event','story') NOT NULL DEFAULT 'event',
  image        VARCHAR(255) NULL,
  link_url     VARCHAR(500) NULL,
  published_at DATE         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  archived_at  DATETIME     NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 9. Kinanao awardees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS awardees (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(180) NOT NULL,
  award      VARCHAR(220) NOT NULL,
  year       SMALLINT     NULL,
  image      VARCHAR(255) NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 10. Scholarship FAQs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category   VARCHAR(60)  NOT NULL,
  question   VARCHAR(300) NOT NULL,
  answer     TEXT         NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 11. Contact cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_cards (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label      VARCHAR(120) NOT NULL,
  value      VARCHAR(190) NOT NULL,
  url        VARCHAR(500) NULL,
  image      VARCHAR(255) NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 12. History pillars
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history_pillars (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title      VARCHAR(120) NOT NULL,
  body       VARCHAR(300) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 13. Scholar Development Program types
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sdp_types (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title      VARCHAR(160) NOT NULL,
  body       TEXT         NULL,
  items      TEXT         NULL,   -- one bullet per line
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 14. HK scholarship feature cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hk_features (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title      VARCHAR(120) NOT NULL,
  body       VARCHAR(300) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 15. HK scholarship price cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hk_prices (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(40)  NOT NULL,
  price      VARCHAR(120) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 16. Enrollment steps (walk-in / online)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_steps (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  mode       ENUM('walkin','online') NOT NULL DEFAULT 'walkin',
  title      VARCHAR(200) NOT NULL,
  body       VARCHAR(300) NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  archived_at DATETIME    NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 17. Calendar entries (public calendar: holidays, school events, CSAP
--     activities, deadlines). One row per entry; multi-day entries use
--     date_start + date_end. `source` records where an entry came from
--     (manual typing, or imported from an existing list) and `source_ref`
--     keeps the origin ("events:12") so imports stay idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_entries (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(220) NOT NULL,
  kind         ENUM('holiday','school_event','csap_event','deadline','other') NOT NULL DEFAULT 'other',
  source       VARCHAR(40)  NOT NULL DEFAULT 'manual',
  source_ref   VARCHAR(60)  NULL,
  date_start   DATE         NOT NULL,
  date_end     DATE         NULL,
  all_day      TINYINT(1)   NOT NULL DEFAULT 1,
  time_from    VARCHAR(20)  NULL,
  time_to      VARCHAR(20)  NULL,
  location     VARCHAR(200) NULL,
  description  TEXT         NULL,
  is_highlight TINYINT(1)   NOT NULL DEFAULT 0,   -- highlighted on the calendar (school events)
  sort_order   INT          NOT NULL DEFAULT 0,
  archived_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_cal_date (date_start),
  KEY idx_cal_kind (kind)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 18. Activity log (admin audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id    INT UNSIGNED NULL,
  admin_name  VARCHAR(160) NOT NULL DEFAULT '',
  action      VARCHAR(20)  NOT NULL,
  resource    VARCHAR(120) NOT NULL,
  detail      VARCHAR(300) NULL,
  ip          VARCHAR(45)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_act_created (created_at),
  KEY idx_act_action (action),
  KEY idx_act_resource (resource)
) ENGINE=InnoDB;