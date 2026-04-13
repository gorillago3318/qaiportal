-- ============================================================
-- QuantifyAI Portal — Multi-Agency Migration
-- Migration: 002_multi_agency.sql
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 0. PREREQUISITES ─────────────────────────────────────────
-- Ensure the updated_at trigger function exists (defined in 001 but may not have been run)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. AGENCIES TABLE ────────────────────────────────────────

CREATE TABLE agencies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  code_prefix     TEXT NOT NULL UNIQUE,
  custom_domain   TEXT UNIQUE,
  logo_url        TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#0A1628',
  accent_color    TEXT NOT NULL DEFAULT '#C9A84C',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Seed QAI as the first agency
INSERT INTO agencies (id, name, slug, code_prefix, primary_color, accent_color)
VALUES ('00000000-0000-0000-0000-000000000001', 'QuantifyAI', 'qai', 'QAI', '#0A1628', '#C9A84C');

-- ── 2. ADD agency_id + NEW COLUMNS TO profiles ───────────────

ALTER TABLE profiles
  ADD COLUMN agency_id UUID REFERENCES agencies(id),
  ADD COLUMN username TEXT UNIQUE,
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN agreement_signed_at TIMESTAMPTZ;

-- Default all existing profiles to QAI
UPDATE profiles SET agency_id = '00000000-0000-0000-0000-000000000001' WHERE agency_id IS NULL;

ALTER TABLE profiles ALTER COLUMN agency_id SET NOT NULL;

CREATE INDEX idx_profiles_agency_id ON profiles(agency_id);

-- ── 3. ADD agency_id TO ALL OTHER TABLES ─────────────────────

ALTER TABLE cases
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

ALTER TABLE calculations
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

ALTER TABLE commissions
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

ALTER TABLE banks
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

ALTER TABLE lawyers
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

ALTER TABLE commission_tier_config
  ADD COLUMN agency_id UUID REFERENCES agencies(id) DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

-- Update existing rows to QAI
UPDATE cases SET agency_id = '00000000-0000-0000-0000-000000000001';
UPDATE calculations SET agency_id = '00000000-0000-0000-0000-000000000001';
UPDATE commissions SET agency_id = '00000000-0000-0000-0000-000000000001';
UPDATE banks SET agency_id = '00000000-0000-0000-0000-000000000001';
UPDATE lawyers SET agency_id = '00000000-0000-0000-0000-000000000001';
UPDATE commission_tier_config SET agency_id = '00000000-0000-0000-0000-000000000001';

-- Remove defaults now that data is migrated
ALTER TABLE cases ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE calculations ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE commissions ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE banks ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE lawyers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE commission_tier_config ALTER COLUMN agency_id DROP DEFAULT;

CREATE INDEX idx_cases_agency_id ON cases(agency_id);
CREATE INDEX idx_calculations_agency_id ON calculations(agency_id);
CREATE INDEX idx_commissions_agency_id ON commissions(agency_id);
CREATE INDEX idx_banks_agency_id ON banks(agency_id);
CREATE INDEX idx_lawyers_agency_id ON lawyers(agency_id);
CREATE INDEX idx_commission_tier_config_agency_id ON commission_tier_config(agency_id);

-- ── 4. FIX commission_tier_config UNIQUE CONSTRAINT ──────────

-- Drop old unique constraint on tier alone
ALTER TABLE commission_tier_config DROP CONSTRAINT IF EXISTS commission_tier_config_tier_key;

-- New unique: one tier config per agency
ALTER TABLE commission_tier_config
  ADD CONSTRAINT commission_tier_config_agency_tier_unique UNIQUE (agency_id, tier);

-- ── 5. HELPER FUNCTIONS ───────────────────────────────────────

CREATE OR REPLACE FUNCTION my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update is_admin to only mean admin within their agency
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 6. AGENCIES RLS POLICIES ──────────────────────────────────

CREATE POLICY "agencies_super_admin_all" ON agencies
  FOR ALL USING (is_super_admin());

CREATE POLICY "agencies_members_read" ON agencies
  FOR SELECT USING (id = my_agency_id());

-- ── 7. UPDATE ALL RLS POLICIES FOR AGENCY ISOLATION ──────────

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    is_super_admin() OR
    (agency_id = my_agency_id() AND (id = auth.uid() OR is_admin()))
  );

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

-- COMMISSION TIER CONFIG
DROP POLICY IF EXISTS "tier_config_read_authenticated" ON commission_tier_config;
DROP POLICY IF EXISTS "tier_config_admin_write" ON commission_tier_config;

CREATE POLICY "tier_config_select" ON commission_tier_config
  FOR SELECT USING (
    is_super_admin() OR agency_id = my_agency_id()
  );

CREATE POLICY "tier_config_write" ON commission_tier_config
  FOR ALL USING (is_admin() AND (is_super_admin() OR agency_id = my_agency_id()));

-- BANKS
DROP POLICY IF EXISTS "banks_read_authenticated" ON banks;
DROP POLICY IF EXISTS "banks_admin_write" ON banks;

CREATE POLICY "banks_select" ON banks
  FOR SELECT USING (
    is_super_admin() OR agency_id = my_agency_id()
  );

CREATE POLICY "banks_write" ON banks
  FOR ALL USING (is_admin() AND (is_super_admin() OR agency_id = my_agency_id()));

-- LAWYERS
DROP POLICY IF EXISTS "lawyers_read_authenticated" ON lawyers;
DROP POLICY IF EXISTS "lawyers_admin_write" ON lawyers;

CREATE POLICY "lawyers_select" ON lawyers
  FOR SELECT USING (
    is_super_admin() OR agency_id = my_agency_id()
  );

CREATE POLICY "lawyers_write" ON lawyers
  FOR ALL USING (is_admin() AND (is_super_admin() OR agency_id = my_agency_id()));

-- CLIENTS (scoped by who created them)
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_insert" ON clients;
DROP POLICY IF EXISTS "clients_update" ON clients;

CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (
    is_super_admin() OR
    created_by = auth.uid() OR
    is_admin() OR
    EXISTS (SELECT 1 FROM cases WHERE cases.client_id = clients.id AND cases.agent_id = auth.uid())
  );

CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

-- CALCULATIONS
DROP POLICY IF EXISTS "calculations_select" ON calculations;
DROP POLICY IF EXISTS "calculations_insert" ON calculations;
DROP POLICY IF EXISTS "calculations_update" ON calculations;
DROP POLICY IF EXISTS "calculations_delete" ON calculations;

CREATE POLICY "calculations_select" ON calculations
  FOR SELECT USING (
    is_super_admin() OR
    (agency_id = my_agency_id() AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "calculations_insert" ON calculations
  FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());

CREATE POLICY "calculations_update" ON calculations
  FOR UPDATE USING (agent_id = auth.uid() OR is_admin());

CREATE POLICY "calculations_delete" ON calculations
  FOR DELETE USING (agent_id = auth.uid() OR is_admin());

-- CASES
DROP POLICY IF EXISTS "cases_select" ON cases;
DROP POLICY IF EXISTS "cases_insert" ON cases;
DROP POLICY IF EXISTS "cases_update" ON cases;

CREATE POLICY "cases_select" ON cases
  FOR SELECT USING (
    is_super_admin() OR
    (agency_id = my_agency_id() AND (
      agent_id = auth.uid() OR is_admin() OR
      EXISTS (SELECT 1 FROM case_co_broke WHERE case_id = cases.id AND (referrer_agent_id = auth.uid() OR doer_agent_id = auth.uid()))
    ))
  );

CREATE POLICY "cases_insert" ON cases
  FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());

CREATE POLICY "cases_update" ON cases
  FOR UPDATE USING (
    (agent_id = auth.uid() AND status = 'draft') OR is_admin()
  );

-- COMMISSIONS
DROP POLICY IF EXISTS "commissions_select" ON commissions;
DROP POLICY IF EXISTS "commissions_admin_write" ON commissions;

CREATE POLICY "commissions_select" ON commissions
  FOR SELECT USING (
    is_super_admin() OR
    (agency_id = my_agency_id() AND (
      is_admin() OR
      EXISTS (SELECT 1 FROM cases WHERE id = commissions.case_id AND (
        agent_id = auth.uid() OR
        EXISTS (SELECT 1 FROM case_co_broke WHERE case_id = cases.id AND (referrer_agent_id = auth.uid() OR doer_agent_id = auth.uid()))
      ))
    ))
  );

CREATE POLICY "commissions_write" ON commissions
  FOR ALL USING (is_admin());

-- CO-BORROWERS, CASE CO-BROKE, STATUS HISTORY, COMMENTS, DOCUMENTS — keep existing, they inherit via cases

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_admin_insert" ON notifications;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() IS NOT NULL);

-- ── 8. UPDATE TRIGGER: generate_agent_code ───────────────────

CREATE OR REPLACE FUNCTION generate_agent_code()
RETURNS TRIGGER AS $$
DECLARE
  v_seq    INTEGER;
  v_prefix TEXT;
  v_code   TEXT;
BEGIN
  IF NEW.role IN ('agent', 'senior_agent', 'unit_manager', 'agency_manager', 'admin') THEN
    SELECT code_prefix INTO v_prefix FROM agencies WHERE id = NEW.agency_id;
    IF v_prefix IS NULL THEN v_prefix := 'QAI'; END IF;
    SELECT COUNT(*) + 1 INTO v_seq
    FROM profiles
    WHERE agent_code LIKE v_prefix || '%' AND agency_id = NEW.agency_id;
    v_code := v_prefix || LPAD(v_seq::TEXT, 4, '0');
    NEW.agent_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 9. UPDATE TRIGGER: generate_case_code ────────────────────

CREATE OR REPLACE FUNCTION generate_case_code()
RETURNS TRIGGER AS $$
DECLARE
  v_year   TEXT;
  v_seq    INTEGER;
  v_prefix TEXT;
  v_code   TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT code_prefix INTO v_prefix FROM agencies WHERE id = NEW.agency_id;
  IF v_prefix IS NULL THEN v_prefix := 'QAI'; END IF;
  SELECT COUNT(*) + 1 INTO v_seq
  FROM cases
  WHERE case_code LIKE v_prefix || '-' || v_year || '-%'
  AND agency_id = NEW.agency_id;
  v_code := v_prefix || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  NEW.case_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
