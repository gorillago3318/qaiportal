-- ============================================================
-- QuantifyAI Portal — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CUSTOM TYPES / ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin', 'admin', 'agency_manager',
  'unit_manager', 'senior_agent', 'agent'
);

CREATE TYPE loan_type AS ENUM ('refinance', 'subsale', 'developer');

CREATE TYPE case_status AS ENUM (
  'draft', 'submitted', 'bank_processing', 'kiv',
  'approved', 'declined', 'accepted', 'rejected',
  'payment_pending', 'paid'
);

CREATE TYPE commission_type AS ENUM ('bank', 'lawyer');

CREATE TYPE commission_status AS ENUM (
  'pending', 'calculated', 'payment_pending', 'paid'
);

CREATE TYPE lawyer_case_type AS ENUM ('la', 'spa', 'mot');

CREATE TYPE gender AS ENUM ('male', 'female');

CREATE TYPE marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');

CREATE TYPE residency_status AS ENUM ('citizen', 'pr', 'temp', 'foreigner');

CREATE TYPE loan_tenure_type AS ENUM ('term', 'flexi', 'semi_flexi');

CREATE TYPE property_title AS ENUM ('individual', 'strata');

CREATE TYPE property_tenure AS ENUM ('freehold', 'leasehold');

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLES
-- ============================================================

-- ── PROFILES ──────────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'agent',
  agent_code    TEXT UNIQUE,
  upline_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_upline_id ON profiles(upline_id);
CREATE INDEX idx_profiles_agent_code ON profiles(agent_code);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── COMMISSION TIER CONFIG ─────────────────────────────────
CREATE TABLE commission_tier_config (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier        user_role NOT NULL UNIQUE,
  percentage  NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_commission_tier_config_updated_at
  BEFORE UPDATE ON commission_tier_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── BANKS ─────────────────────────────────────────────────
CREATE TABLE banks (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL UNIQUE,
  commission_rate  NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banks_is_active ON banks(is_active);

CREATE TRIGGER trg_banks_updated_at
  BEFORE UPDATE ON banks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── LAWYERS ───────────────────────────────────────────────
CREATE TABLE lawyers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  firm        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  la_fee      NUMERIC(12,2),
  spa_fee     NUMERIC(12,2),
  mot_fee     NUMERIC(12,2),
  is_panel    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lawyers_is_active ON lawyers(is_active);
CREATE INDEX idx_lawyers_is_panel ON lawyers(is_panel);

CREATE TRIGGER trg_lawyers_updated_at
  BEFORE UPDATE ON lawyers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CLIENTS ───────────────────────────────────────────────
CREATE TABLE clients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name         TEXT NOT NULL,
  ic_number         TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL,
  email             TEXT,
  date_of_birth     DATE,
  gender            gender,
  marital_status    marital_status,
  residency_status  residency_status DEFAULT 'citizen',
  address           TEXT,
  employer          TEXT,
  monthly_income    NUMERIC(12,2),
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_ic_number ON clients(ic_number);
CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_clients_full_name ON clients(full_name);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CALCULATIONS ──────────────────────────────────────────
CREATE TABLE calculations (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id                    UUID NOT NULL REFERENCES profiles(id),
  client_id                   UUID REFERENCES clients(id),
  client_name                 TEXT NOT NULL,
  client_ic                   TEXT,
  client_phone                TEXT,
  client_dob                  DATE,
  loan_type                   loan_type NOT NULL DEFAULT 'refinance',
  -- Existing loan
  current_bank                TEXT,
  current_loan_amount         NUMERIC(14,2),
  current_interest_rate       NUMERIC(6,4),
  current_monthly_instalment  NUMERIC(12,2),
  current_tenure_months       INTEGER,
  -- Proposed loan
  proposed_bank_id            UUID REFERENCES banks(id),
  proposed_loan_amount        NUMERIC(14,2),
  proposed_interest_rate      NUMERIC(6,4),
  proposed_tenure_months      INTEGER,
  -- Cash out
  has_cash_out                BOOLEAN NOT NULL DEFAULT FALSE,
  cash_out_amount             NUMERIC(12,2),
  cash_out_tenure_months      INTEGER,
  -- Fees
  finance_legal_fees          BOOLEAN NOT NULL DEFAULT FALSE,
  legal_fee_amount            NUMERIC(12,2),
  valuation_fee_amount        NUMERIC(12,2),
  stamp_duty_amount           NUMERIC(12,2),
  -- Results
  results                     JSONB,
  report_token                TEXT UNIQUE,
  report_url                  TEXT,
  referral_code               TEXT,
  converted_to_case_id        UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calculations_agent_id ON calculations(agent_id);
CREATE INDEX idx_calculations_client_id ON calculations(client_id);
CREATE INDEX idx_calculations_loan_type ON calculations(loan_type);
CREATE INDEX idx_calculations_created_at ON calculations(created_at DESC);

CREATE TRIGGER trg_calculations_updated_at
  BEFORE UPDATE ON calculations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CASES ─────────────────────────────────────────────────
CREATE TABLE cases (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_code                   TEXT NOT NULL UNIQUE,
  calculation_id              UUID REFERENCES calculations(id),
  agent_id                    UUID NOT NULL REFERENCES profiles(id),
  client_id                   UUID NOT NULL REFERENCES clients(id),
  loan_type                   loan_type NOT NULL,
  status                      case_status NOT NULL DEFAULT 'draft',
  -- Current loan
  current_bank                TEXT,
  current_loan_amount         NUMERIC(14,2),
  current_interest_rate       NUMERIC(6,4),
  current_monthly_instalment  NUMERIC(12,2),
  current_tenure_months       INTEGER,
  loan_type_detail            loan_tenure_type,
  is_islamic                  BOOLEAN NOT NULL DEFAULT FALSE,
  has_lock_in                 BOOLEAN NOT NULL DEFAULT FALSE,
  -- Property
  property_address            TEXT,
  property_type               TEXT,
  property_title              property_title,
  property_tenure             property_tenure,
  property_value              NUMERIC(14,2),
  property_size_land          NUMERIC(10,2),
  property_size_buildup       NUMERIC(10,2),
  -- Proposed loan
  proposed_bank_id            UUID REFERENCES banks(id),
  proposed_loan_amount        NUMERIC(14,2),
  proposed_interest_rate      NUMERIC(6,4),
  proposed_tenure_months      INTEGER,
  has_cash_out                BOOLEAN NOT NULL DEFAULT FALSE,
  cash_out_amount             NUMERIC(12,2),
  cash_out_tenure_months      INTEGER,
  -- Lawyer
  lawyer_id                   UUID REFERENCES lawyers(id),
  lawyer_name_other           TEXT,
  lawyer_firm_other           TEXT,
  lawyer_case_types           lawyer_case_type[] NOT NULL DEFAULT '{}',
  lawyer_professional_fee     NUMERIC(12,2),
  lawyer_discount             NUMERIC(12,2),
  -- Valuer
  valuer_name                 TEXT,
  valuer_firm                 TEXT,
  -- Fees
  finance_legal_fees          BOOLEAN NOT NULL DEFAULT FALSE,
  legal_fee_amount            NUMERIC(12,2),
  valuation_fee_amount        NUMERIC(12,2),
  stamp_duty_amount           NUMERIC(12,2),
  -- Co-broke
  has_co_broke                BOOLEAN NOT NULL DEFAULT FALSE,
  -- Admin
  admin_remarks               TEXT,
  verified_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_agent_id ON cases(agent_id);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_loan_type ON cases(loan_type);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_cases_case_code ON cases(case_code);

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CO-BORROWERS ──────────────────────────────────────────
CREATE TABLE co_borrowers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  ic_number     TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('co_borrower', 'guarantor', 'charger')),
  relationship  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_co_borrowers_case_id ON co_borrowers(case_id);

-- ── CASE CO-BROKE ─────────────────────────────────────────
CREATE TABLE case_co_broke (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id            UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  referrer_agent_id  UUID NOT NULL REFERENCES profiles(id),
  doer_agent_id      UUID NOT NULL REFERENCES profiles(id),
  referrer_share     NUMERIC(5,2) NOT NULL DEFAULT 30,
  doer_share         NUMERIC(5,2) NOT NULL DEFAULT 70,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_co_broke_shares CHECK (referrer_share + doer_share = 100)
);

CREATE INDEX idx_case_co_broke_case_id ON case_co_broke(case_id);
CREATE INDEX idx_case_co_broke_referrer ON case_co_broke(referrer_agent_id);
CREATE INDEX idx_case_co_broke_doer ON case_co_broke(doer_agent_id);

-- ── CASE STATUS HISTORY ───────────────────────────────────
CREATE TABLE case_status_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  from_status  case_status,
  to_status    case_status NOT NULL,
  changed_by   UUID NOT NULL REFERENCES profiles(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_status_history_case_id ON case_status_history(case_id);
CREATE INDEX idx_case_status_history_created_at ON case_status_history(created_at DESC);

-- ── CASE COMMENTS ─────────────────────────────────────────
CREATE TABLE case_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id),
  content     TEXT NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_comments_case_id ON case_comments(case_id);
CREATE INDEX idx_case_comments_created_at ON case_comments(created_at DESC);

CREATE TRIGGER trg_case_comments_updated_at
  BEFORE UPDATE ON case_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── CASE DOCUMENTS ────────────────────────────────────────
CREATE TABLE case_documents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  file_url       TEXT NOT NULL,
  file_size      BIGINT,
  uploaded_by    UUID NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_documents_case_id ON case_documents(case_id);

-- ── COMMISSIONS ───────────────────────────────────────────
CREATE TABLE commissions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id            UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type               commission_type NOT NULL,
  gross_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  company_cut        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_distributable  NUMERIC(14,2) NOT NULL DEFAULT 0,
  tier_breakdown     JSONB NOT NULL DEFAULT '{}',
  status             commission_status NOT NULL DEFAULT 'pending',
  paid_amount        NUMERIC(14,2),
  paid_at            TIMESTAMPTZ,
  payment_reference  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commissions_case_id ON commissions(case_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_type ON commissions(type);

CREATE TRIGGER trg_commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- Auto-generate case_code: QAI-YYYY-NNNN
CREATE OR REPLACE FUNCTION generate_case_code()
RETURNS TRIGGER AS $$
DECLARE
  v_year TEXT;
  v_seq  INTEGER;
  v_code TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_seq
  FROM cases
  WHERE case_code LIKE 'QAI-' || v_year || '-%';
  v_code := 'QAI-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  NEW.case_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cases_generate_code
  BEFORE INSERT ON cases
  FOR EACH ROW
  WHEN (NEW.case_code IS NULL OR NEW.case_code = '')
  EXECUTE FUNCTION generate_case_code();

-- Auto-generate agent_code: QAI#### (only for agent-level roles)
CREATE OR REPLACE FUNCTION generate_agent_code()
RETURNS TRIGGER AS $$
DECLARE
  v_seq  INTEGER;
  v_code TEXT;
BEGIN
  IF NEW.role IN ('agent', 'senior_agent', 'unit_manager', 'agency_manager') THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM profiles WHERE agent_code IS NOT NULL;
    v_code := 'QAI' || LPAD(v_seq::TEXT, 4, '0');
    NEW.agent_code := v_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_generate_agent_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.agent_code IS NULL)
  EXECUTE FUNCTION generate_agent_code();

-- Auto-create status history entry on case status change
CREATE OR REPLACE FUNCTION log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO case_status_history (case_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_cases_status_history
  AFTER UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION log_case_status_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_co_broke ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin/super_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── PROFILES POLICIES ─────────────────────────────────────
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin());

-- ── COMMISSION TIER CONFIG ─────────────────────────────────
CREATE POLICY "tier_config_read_authenticated" ON commission_tier_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tier_config_admin_write" ON commission_tier_config
  FOR ALL USING (is_admin());

-- ── BANKS ─────────────────────────────────────────────────
CREATE POLICY "banks_read_authenticated" ON banks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "banks_admin_write" ON banks
  FOR ALL USING (is_admin());

-- ── LAWYERS ───────────────────────────────────────────────
CREATE POLICY "lawyers_read_authenticated" ON lawyers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "lawyers_admin_write" ON lawyers
  FOR ALL USING (is_admin());

-- ── CLIENTS ───────────────────────────────────────────────
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (
    created_by = auth.uid() OR is_admin() OR
    EXISTS (SELECT 1 FROM cases WHERE cases.client_id = clients.id AND cases.agent_id = auth.uid())
  );

CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (created_by = auth.uid() OR is_admin());

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (created_by = auth.uid() OR is_admin());

-- ── CALCULATIONS ──────────────────────────────────────────
CREATE POLICY "calculations_select" ON calculations
  FOR SELECT USING (agent_id = auth.uid() OR is_admin());

CREATE POLICY "calculations_insert" ON calculations
  FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());

CREATE POLICY "calculations_update" ON calculations
  FOR UPDATE USING (agent_id = auth.uid() OR is_admin());

CREATE POLICY "calculations_delete" ON calculations
  FOR DELETE USING (agent_id = auth.uid() OR is_admin());

-- ── CASES ─────────────────────────────────────────────────
CREATE POLICY "cases_select" ON cases
  FOR SELECT USING (
    agent_id = auth.uid() OR is_admin() OR
    EXISTS (
      SELECT 1 FROM case_co_broke
      WHERE case_id = cases.id
      AND (referrer_agent_id = auth.uid() OR doer_agent_id = auth.uid())
    )
  );

CREATE POLICY "cases_insert" ON cases
  FOR INSERT WITH CHECK (agent_id = auth.uid() OR is_admin());

CREATE POLICY "cases_update" ON cases
  FOR UPDATE USING (
    (agent_id = auth.uid() AND status = 'draft') OR is_admin()
  );

-- ── CO-BORROWERS ──────────────────────────────────────────
CREATE POLICY "co_borrowers_select" ON co_borrowers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE id = co_borrowers.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "co_borrowers_write" ON co_borrowers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cases WHERE id = co_borrowers.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

-- ── CASE CO-BROKE ─────────────────────────────────────────
CREATE POLICY "case_co_broke_select" ON case_co_broke
  FOR SELECT USING (
    referrer_agent_id = auth.uid() OR
    doer_agent_id = auth.uid() OR
    is_admin()
  );

CREATE POLICY "case_co_broke_insert" ON case_co_broke
  FOR INSERT WITH CHECK (doer_agent_id = auth.uid() OR is_admin());

-- ── CASE STATUS HISTORY ───────────────────────────────────
CREATE POLICY "case_status_history_select" ON case_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE id = case_status_history.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

-- ── CASE COMMENTS ─────────────────────────────────────────
CREATE POLICY "case_comments_select" ON case_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE id = case_comments.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "case_comments_insert" ON case_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (SELECT 1 FROM cases WHERE id = case_comments.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "case_comments_update_own" ON case_comments
  FOR UPDATE USING (author_id = auth.uid() OR is_admin());

-- ── CASE DOCUMENTS ────────────────────────────────────────
CREATE POLICY "case_documents_select" ON case_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE id = case_documents.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "case_documents_insert" ON case_documents
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (SELECT 1 FROM cases WHERE id = case_documents.case_id AND (agent_id = auth.uid() OR is_admin()))
  );

CREATE POLICY "case_documents_admin_delete" ON case_documents
  FOR DELETE USING (uploaded_by = auth.uid() OR is_admin());

-- ── COMMISSIONS ───────────────────────────────────────────
CREATE POLICY "commissions_select" ON commissions
  FOR SELECT USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM cases
      WHERE id = commissions.case_id AND (
        agent_id = auth.uid() OR
        EXISTS (SELECT 1 FROM case_co_broke WHERE case_id = cases.id AND (referrer_agent_id = auth.uid() OR doer_agent_id = auth.uid()))
      )
    )
  );

CREATE POLICY "commissions_admin_write" ON commissions
  FOR ALL USING (is_admin());

-- ── NOTIFICATIONS ─────────────────────────────────────────
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_admin_insert" ON notifications
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() IS NOT NULL);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Banks
INSERT INTO banks (name, commission_rate) VALUES
  ('OCBC Bank', 0.003),
  ('Hong Leong Bank (HLBB)', 0.0025),
  ('RHB Bank', 0.002),
  ('Standard Chartered (SCB)', 0.002),
  ('Al-Rajhi Bank', 0),
  ('AFFIN Bank (ALB)', 0),
  ('AIA', 0),
  ('Maybank', 0.0025),
  ('CIMB Bank', 0.0025),
  ('Public Bank', 0.0025),
  ('AmBank', 0.002),
  ('Bank Islam', 0.002),
  ('Bank Muamalat', 0.002),
  ('BSN', 0.0015),
  ('Affin Bank', 0.002),
  ('Alliance Bank', 0.002),
  ('Hong Leong Islamic Bank', 0.0025)
ON CONFLICT (name) DO NOTHING;

-- Commission Tier Config
INSERT INTO commission_tier_config (tier, percentage) VALUES
  ('super_admin', 10),
  ('agency_manager', 92.5),
  ('unit_manager', 87.5),
  ('senior_agent', 80),
  ('agent', 70)
ON CONFLICT (tier) DO UPDATE SET percentage = EXCLUDED.percentage;

-- Admin account placeholder (password set via Supabase dashboard)
-- Note: The actual auth.users record must be created via Supabase Auth dashboard
-- This insert will succeed once the auth user is created with the same UUID
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'admin@quantifyai.me', 'QuantifyAI Admin', 'super_admin');

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or separate script)
-- ============================================================
-- Create these buckets in Supabase Storage:
-- 1. "case-documents" — private, for case-related documents
-- 2. "reports" — public, for generated PDF reports
-- 3. "avatars" — public, for profile pictures
