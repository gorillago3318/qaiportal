-- ============================================================
-- Migration 011: Enhanced Lawyer Commission Workflow
-- Date: 2026-04-13
-- Purpose: 
-- 1. Add special_arrangement_discount field for panel lawyer commission adjustments
-- 2. Ensure lawyer_bank_associations table exists (from migration 010)
-- 3. Add case amendment tracking for financial fields
-- ============================================================

-- Step 1: Add special arrangement discount field to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS special_arrangement_discount NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN cases.special_arrangement_discount IS 'Discount amount given by panel lawyer to client. Only applicable when lawyer is panel. Used to adjust commission calculation.';

-- Step 2: Verify lawyer_bank_associations table exists (create if migration 010 not run)
CREATE TABLE IF NOT EXISTS lawyer_bank_associations (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
  bank_id   UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  is_panel  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lawyer_id, bank_id)
);

CREATE INDEX IF NOT EXISTS idx_lawyer_bank_lawyer_id ON lawyer_bank_associations(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_bank_bank_id ON lawyer_bank_associations(bank_id);

COMMENT ON TABLE lawyer_bank_associations IS 'Junction table linking lawyers to banks they are panel for';
COMMENT ON COLUMN lawyer_bank_associations.is_panel IS 'Whether this lawyer is panel for this specific bank';

-- Step 3: Add second valuer fields (if not already added by migration 010)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_firm TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_contact TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_email TEXT;

COMMENT ON COLUMN cases.valuer_2_name IS 'Second valuer name (most banks require 2 verbal valuations)';

-- Step 4: Ensure lawyer_professional_fee exists
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_professional_fee NUMERIC(12,2);

COMMENT ON COLUMN cases.lawyer_professional_fee IS 'Quoted professional fee from lawyer quotation - used for commission calculation (before any special arrangement discount)';

-- Step 5: Create case_amendment_log table for tracking financial field changes
CREATE TABLE IF NOT EXISTS case_amendment_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  amended_by      UUID NOT NULL REFERENCES profiles(id),
  field_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_amendment_case_id ON case_amendment_log(case_id);
CREATE INDEX idx_case_amendment_created_at ON case_amendment_log(created_at DESC);

COMMENT ON TABLE case_amendment_log IS 'Tracks amendments to financial fields (lawyer fees, discounts, etc.) made by admin after case acceptance';
COMMENT ON COLUMN case_amendment_log.field_name IS 'Name of the field that was changed (e.g., lawyer_professional_fee, special_arrangement_discount)';
COMMENT ON COLUMN case_amendment_log.reason IS 'Optional reason for the amendment';

-- Step 6: Create function to auto-log amendments to financial fields
CREATE OR REPLACE FUNCTION log_financial_amendments()
RETURNS TRIGGER AS $$
BEGIN
  -- Log lawyer_professional_fee changes
  IF OLD.lawyer_professional_fee IS DISTINCT FROM NEW.lawyer_professional_fee THEN
    INSERT INTO case_amendment_log (case_id, amended_by, field_name, old_value, new_value, reason)
    VALUES (NEW.id, auth.uid(), 'lawyer_professional_fee', 
            COALESCE(OLD.lawyer_professional_fee::TEXT, 'NULL'), 
            COALESCE(NEW.lawyer_professional_fee::TEXT, 'NULL'),
            'Admin adjustment');
  END IF;
  
  -- Log special_arrangement_discount changes
  IF OLD.special_arrangement_discount IS DISTINCT FROM NEW.special_arrangement_discount THEN
    INSERT INTO case_amendment_log (case_id, amended_by, field_name, old_value, new_value, reason)
    VALUES (NEW.id, auth.uid(), 'special_arrangement_discount', 
            COALESCE(OLD.special_arrangement_discount::TEXT, '0'), 
            COALESCE(NEW.special_arrangement_discount::TEXT, '0'),
            'Admin adjustment');
  END IF;
  
  -- Log has_lawyer_discount changes
  IF OLD.has_lawyer_discount IS DISTINCT FROM NEW.has_lawyer_discount THEN
    INSERT INTO case_amendment_log (case_id, amended_by, field_name, old_value, new_value, reason)
    VALUES (NEW.id, auth.uid(), 'has_lawyer_discount', 
            COALESCE(OLD.has_lawyer_discount::TEXT, 'false'), 
            COALESCE(NEW.has_lawyer_discount::TEXT, 'false'),
            'Admin adjustment');
  END IF;
  
  -- Log lawyer_discount_amount changes
  IF OLD.lawyer_discount_amount IS DISTINCT FROM NEW.lawyer_discount_amount THEN
    INSERT INTO case_amendment_log (case_id, amended_by, field_name, old_value, new_value, reason)
    VALUES (NEW.id, auth.uid(), 'lawyer_discount_amount', 
            COALESCE(OLD.lawyer_discount_amount::TEXT, '0'), 
            COALESCE(NEW.lawyer_discount_amount::TEXT, '0'),
            'Admin adjustment');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger on cases table
DROP TRIGGER IF EXISTS trg_log_financial_amendments ON cases;
CREATE TRIGGER trg_log_financial_amendments
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION log_financial_amendments();

-- Step 8: Insert sample panel lawyers with bank associations (if migration 010 not run)
DO $$
DECLARE
  lwz_id UUID;
  yr_id UUID;
  hlb_id UUID;
  ocbc_id UUID;
BEGIN
  -- Get or create LWZ lawyer
  INSERT INTO lawyers (name, firm, email, phone, is_panel, is_active)
  VALUES ('Lee Wei Zhen', 'LWZ & Associates', 'contact@lwzlaw.com', '+60123456789', TRUE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING id INTO lwz_id;
  
  IF lwz_id IS NULL THEN
    SELECT id INTO lwz_id FROM lawyers WHERE firm = 'LWZ & Associates' LIMIT 1;
  END IF;
  
  -- Get or create Y&R lawyer
  INSERT INTO lawyers (name, firm, email, phone, is_panel, is_active)
  VALUES ('Yusof & Rahman', 'Y&R Legal Chambers', 'info@yrlaw.com', '+60198765432', TRUE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING id INTO yr_id;
  
  IF yr_id IS NULL THEN
    SELECT id INTO yr_id FROM lawyers WHERE firm = 'Y&R Legal Chambers' LIMIT 1;
  END IF;
  
  -- Get bank IDs
  SELECT id INTO hlb_id FROM banks WHERE name ILIKE '%hong leong%' LIMIT 1;
  SELECT id INTO ocbc_id FROM banks WHERE name ILIKE '%ocbc%' LIMIT 1;
  
  -- Associate LWZ with HLB and OCBC
  IF lwz_id IS NOT NULL AND hlb_id IS NOT NULL THEN
    INSERT INTO lawyer_bank_associations (lawyer_id, bank_id, is_panel)
    VALUES (lwz_id, hlb_id, TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF lwz_id IS NOT NULL AND ocbc_id IS NOT NULL THEN
    INSERT INTO lawyer_bank_associations (lawyer_id, bank_id, is_panel)
    VALUES (lwz_id, ocbc_id, TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Associate Y&R with HLB and OCBC
  IF yr_id IS NOT NULL AND hlb_id IS NOT NULL THEN
    INSERT INTO lawyer_bank_associations (lawyer_id, bank_id, is_panel)
    VALUES (yr_id, hlb_id, TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF yr_id IS NOT NULL AND ocbc_id IS NOT NULL THEN
    INSERT INTO lawyer_bank_associations (lawyer_id, bank_id, is_panel)
    VALUES (yr_id, ocbc_id, TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Sample panel lawyers verified: LWZ & Associates, Y&R Legal Chambers';
END $$;

-- Verification
DO $$
DECLARE
  lawyer_count INTEGER;
  assoc_count INTEGER;
  amendment_table_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO lawyer_count FROM lawyers WHERE is_panel = TRUE;
  SELECT COUNT(*) INTO assoc_count FROM lawyer_bank_associations;
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'case_amendment_log'
  ) INTO amendment_table_exists;
  
  RAISE NOTICE 'Migration 011 completed!';
  RAISE NOTICE 'Panel lawyers: %', lawyer_count;
  RAISE NOTICE 'Bank associations: %', assoc_count;
  RAISE NOTICE 'Amendment log table: %', CASE WHEN amendment_table_exists THEN 'Created' ELSE 'Missing' END;
END $$;
