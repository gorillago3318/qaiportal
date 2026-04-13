-- Migration 010: Lawyer-Bank Associations and Enhanced Case Workflow
-- Date: 2026-04-13
-- Purpose: 
-- 1. Add lawyer-bank panel associations (which banks each lawyer is panel for)
-- 2. Add professional_fee field tracking in cases for commission calculation
-- 3. Add valuer_2 fields for second valuer (most banks require 2 verbal valuations)
-- 4. Add case_code generation trigger for automatic case numbering

-- Step 1: Create lawyer_bank_associations junction table
CREATE TABLE IF NOT EXISTS lawyer_bank_associations (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
  bank_id   UUID NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  is_panel  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lawyer_id, bank_id)
);

CREATE INDEX idx_lawyer_bank_lawyer_id ON lawyer_bank_associations(lawyer_id);
CREATE INDEX idx_lawyer_bank_bank_id ON lawyer_bank_associations(bank_id);

COMMENT ON TABLE lawyer_bank_associations IS 'Junction table linking lawyers to banks they are panel for';
COMMENT ON COLUMN lawyer_bank_associations.is_panel IS 'Whether this lawyer is panel for this specific bank';

-- Step 2: Ensure cases table has all necessary fields (migration 008 added most)
-- Verify lawyer_professional_fee exists (should be in original schema)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_professional_fee NUMERIC(12,2);

-- Step 3: Add second valuer fields (banks typically require 2 verbal valuations)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_name TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_firm TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_contact TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_2_email TEXT;

COMMENT ON COLUMN cases.valuer_2_name IS 'Second valuer name (most banks require 2 verbal valuations)';
COMMENT ON COLUMN cases.lawyer_professional_fee IS 'Quoted professional fee from lawyer - used for commission calculation';

-- Step 4: Add case_code auto-generation trigger
CREATE OR REPLACE FUNCTION generate_case_code()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  sequence_num INTEGER;
  new_code TEXT;
BEGIN
  -- Generate format: CASE-YYYY-XXXXX (e.g., CASE-2026-00001)
  year_prefix := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(case_code FROM 10) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM cases
  WHERE case_code LIKE 'CASE-' || year_prefix || '-%';
  
  -- Format with leading zeros (5 digits)
  new_code := 'CASE-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');
  
  NEW.case_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_generate_case_code ON cases;

-- Create trigger to auto-generate case_code before insert
CREATE TRIGGER trg_generate_case_code
  BEFORE INSERT ON cases
  FOR EACH ROW
  WHEN (NEW.case_code IS NULL OR NEW.case_code = '')
  EXECUTE FUNCTION generate_case_code();

COMMENT ON FUNCTION generate_case_code() IS 'Automatically generates unique case codes in format CASE-YYYY-XXXXX';

-- Step 5: Insert sample panel lawyers (LWZ and Y&R) with bank associations
-- Only insert if they don't already exist
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
  
  -- If LWZ already exists, get their ID
  IF lwz_id IS NULL THEN
    SELECT id INTO lwz_id FROM lawyers WHERE firm = 'LWZ & Associates' LIMIT 1;
  END IF;
  
  -- Get or create Y&R lawyer
  INSERT INTO lawyers (name, firm, email, phone, is_panel, is_active)
  VALUES ('Yusof & Rahman', 'Y&R Legal Chambers', 'info@yrlaw.com', '+60198765432', TRUE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING id INTO yr_id;
  
  -- If Y&R already exists, get their ID
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
  
  RAISE NOTICE 'Sample panel lawyers created/verified: LWZ & Associates, Y&R Legal Chambers';
END $$;

-- Verification
DO $$
DECLARE
  lawyer_count INTEGER;
  assoc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO lawyer_count FROM lawyers WHERE is_panel = TRUE;
  SELECT COUNT(*) INTO assoc_count FROM lawyer_bank_associations;
  
  RAISE NOTICE 'Migration 010 completed! Panel lawyers: %, Bank associations: %', lawyer_count, assoc_count;
END $$;
