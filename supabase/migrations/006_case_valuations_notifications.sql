-- ============================================================
-- 006_case_valuations_notifications.sql
-- Add Valuers, Quotation URLs, and Dashboard Notifications
-- ============================================================

-- 1. VALUERS AND QUOTATION
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_1_firm TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_1_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_1_date DATE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_1_amount NUMERIC;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_firm TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_date DATE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_amount NUMERIC;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_quotation_url TEXT;


-- 2. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'system', -- 'system', 'case_update', 'campaign'
  case_id    UUID REFERENCES cases(id) ON DELETE CASCADE,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin'));
