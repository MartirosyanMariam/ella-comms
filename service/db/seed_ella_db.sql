-- Seed script for the mock Ella DB.
-- Creates a read-only role, users table, user_events table, and user_content table,
-- then populates them with realistic sample data.

-- Read-only role used by the notification service
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ella_readonly') THEN
    CREATE ROLE ella_readonly;
  END IF;
END$$;

GRANT CONNECT ON DATABASE ella_db TO ella_readonly;
GRANT USAGE ON SCHEMA public TO ella_readonly;

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            TEXT UNIQUE NOT NULL,
    first_name       TEXT NOT NULL,
    last_name        TEXT NOT NULL,
    target_language  TEXT NOT NULL,
    native_language  TEXT NOT NULL,
    country          TEXT NOT NULL,
    app_version      TEXT NOT NULL DEFAULT '1.0.0',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name  TEXT NOT NULL,
    user_id     UUID REFERENCES users(id),
    device_id   TEXT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    page_name   TEXT,
    button_name TEXT,
    action      TEXT,
    session_id  TEXT
);

CREATE TABLE IF NOT EXISTS user_content (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id),
    title        TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'article',
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Grant read-only access ────────────────────────────────────────────────────

GRANT SELECT ON ALL TABLES IN SCHEMA public TO ella_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ella_readonly;

-- Grant login for readonly user (the real DB user is ella_user with full perms for seeding)
GRANT ella_readonly TO ella_user;

-- ── Sample data ───────────────────────────────────────────────────────────────

INSERT INTO users (id, email, first_name, last_name, target_language, native_language, country, app_version, created_at, last_seen_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'alice@example.com',  'Alice',   'Martin',   'French',   'English',  'US',  '2.1.0', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
  ('a1000000-0000-0000-0000-000000000002', 'bob@example.com',    'Bob',     'Smith',    'Spanish',  'English',  'UK',  '2.0.0', NOW() - INTERVAL '5 days',  NOW() - INTERVAL '6 days'),
  ('a1000000-0000-0000-0000-000000000003', 'carla@example.com',  'Carla',   'Rossi',    'English',  'Italian',  'IT',  '2.1.0', NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days'),
  ('a1000000-0000-0000-0000-000000000004', 'diana@example.com',  'Diana',   'Müller',   'Japanese', 'German',   'DE',  '1.9.0', NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days'),
  ('a1000000-0000-0000-0000-000000000005', 'erik@example.com',   'Erik',    'Larsson',  'German',   'Swedish',  'SE',  '2.1.0', NOW() - INTERVAL '1 day',   NOW()),
  ('a1000000-0000-0000-0000-000000000006', 'fatima@example.com', 'Fatima',  'Al-Said',  'English',  'Arabic',   'AE',  '2.0.5', NOW() - INTERVAL '7 days',  NOW() - INTERVAL '3 days'),
  ('a1000000-0000-0000-0000-000000000007', 'george@example.com', 'George',  'Papadopoulos', 'French', 'Greek', 'GR', '2.1.0', NOW() - INTERVAL '3 days',  NOW() - INTERVAL '1 hour'),
  ('a1000000-0000-0000-0000-000000000008', 'hannah@example.com', 'Hannah',  'Lee',      'Korean',   'English',  'US',  '2.1.0', NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days')
ON CONFLICT DO NOTHING;

-- User events (sign-ups, library views, button clicks)
INSERT INTO user_events (event_name, user_id, timestamp, page_name, button_name, action, session_id) VALUES
  -- Alice: signed up, viewed library, added content
  ('app_started',    'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days', NULL, NULL, NULL, 'sess-001'),
  ('page_view',      'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '10 days', 'Library', NULL, NULL, 'sess-001'),
  ('button_click',   'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '9 days',  NULL, 'Send to Ella', 'add_content', 'sess-002'),
  ('button_click',   'a1000000-0000-0000-0000-000000000001', NOW() - INTERVAL '8 days',  NULL, 'Start Learning', 'start', 'sess-003'),
  -- Bob: signed up but inactive
  ('app_started',    'a1000000-0000-0000-0000-000000000002', NOW() - INTERVAL '5 days',  NULL, NULL, NULL, 'sess-004'),
  -- Carla: recent sign-up, active
  ('app_started',    'a1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '2 days',  NULL, NULL, NULL, 'sess-005'),
  ('page_view',      'a1000000-0000-0000-0000-000000000003', NOW() - INTERVAL '2 days',  'Library', NULL, NULL, 'sess-005'),
  -- Diana: long inactive
  ('app_started',    'a1000000-0000-0000-0000-000000000004', NOW() - INTERVAL '20 days', NULL, NULL, NULL, 'sess-006'),
  -- Erik: brand new sign-up today
  ('app_started',    'a1000000-0000-0000-0000-000000000005', NOW() - INTERVAL '1 day',   NULL, NULL, NULL, 'sess-007'),
  -- Fatima: library view
  ('app_started',    'a1000000-0000-0000-0000-000000000006', NOW() - INTERVAL '7 days',  NULL, NULL, NULL, 'sess-008'),
  ('page_view',      'a1000000-0000-0000-0000-000000000006', NOW() - INTERVAL '7 days',  'Library', NULL, NULL, 'sess-008'),
  -- George: viewed Add Content page
  ('app_started',    'a1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '3 days',  NULL, NULL, NULL, 'sess-009'),
  ('page_view',      'a1000000-0000-0000-0000-000000000007', NOW() - INTERVAL '2 days',  'Add Content', NULL, NULL, 'sess-010'),
  -- Hannah: very inactive
  ('app_started',    'a1000000-0000-0000-0000-000000000008', NOW() - INTERVAL '30 days', NULL, NULL, NULL, 'sess-011')
ON CONFLICT DO NOTHING;

-- User content
INSERT INTO user_content (user_id, title, content_type, added_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Le Monde - Latest News', 'article',  NOW() - INTERVAL '9 days'),
  ('a1000000-0000-0000-0000-000000000001', 'French Grammar Guide',   'document', NOW() - INTERVAL '8 days'),
  ('a1000000-0000-0000-0000-000000000006', 'BBC Learning English',   'article',  NOW() - INTERVAL '6 days'),
  ('a1000000-0000-0000-0000-000000000007', 'FrenchPod101 Episode 1', 'audio',    NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;
