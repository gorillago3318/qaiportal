-- Migration 009: Enhanced Case Creation Improvements
-- Purpose: Add constraints, validation rules, and improve data integrity
-- Date: 2026-04-13

-- 1. Add check constraint for co-borrowers (max 1 per case)
-- Note: This is enforced at application level, but we can add a trigger for safety
CREATE OR REPLACE FUNCTION check_co_borrower_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Count existing co-borrowers for this case
  IF (SELECT COUNT(*) FROM case_co_borrowers WHERE case_id = NEW.case_id) >= 1 THEN
    RAISE EXCEPTION 'Maximum 1 co-borrower allowed per case';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_co_borrower_limit ON case_co_borrowers;
CREATE TRIGGER trg_check_co_borrower_limit
  BEFORE INSERT ON case_co_borrowers
  FOR EACH ROW
  EXECUTE FUNCTION check_co_borrower_limit();

-- 2. Add check constraints for numeric fields in cases table
ALTER TABLE cases
  ADD CONSTRAINT chk_facility_amount_positive CHECK (facility_amount > 0),
  ADD CONSTRAINT chk_loan_tenure_positive CHECK (loan_tenure > 0),
  ADD CONSTRAINT chk_interest_rate_valid CHECK (interest_rate >= 0 AND interest_rate <= 100),
  ADD CONSTRAINT chk_purchase_price_positive CHECK (purchase_price > 0);

-- 3. Add check constraints for dates
ALTER TABLE cases
  ADD CONSTRAINT chk_spa_date_valid CHECK (spa_date IS NULL OR spa_date <= CURRENT_DATE),
  ADD CONSTRAINT chk_passport_expiry_future CHECK (passport_expiry_date IS NULL OR passport_expiry_date > CURRENT_DATE);

-- 4. Add enum type for insurance options including 'none'
DO $$ BEGIN
  CREATE TYPE insurance_type_enum AS ENUM ('mlta', 'mltt', 'hlt', 'none');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE cases 
  ALTER COLUMN insurance_type TYPE insurance_type_enum 
  USING insurance_type::insurance_type_enum;

-- 5. Add index for faster queries on common filters
CREATE INDEX IF NOT EXISTS idx_cases_agent_id ON cases(agent_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_selected_bank ON cases(selected_bank);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);

-- 6. Add comments for documentation
COMMENT ON COLUMN cases.facility_amount IS 'Loan/facility amount in RM (must be positive)';
COMMENT ON COLUMN cases.loan_tenure IS 'Loan tenure in years (must be positive)';
COMMENT ON COLUMN cases.insurance_type IS 'Type of insurance: mlta, mltt, hlt, or none';
COMMENT ON COLUMN cases.legal_cost_amount IS 'Legal cost quotation amount (required if finance_legal_cost=true)';
COMMENT ON COLUMN cases.valuation_cost_amount IS 'Valuation cost quotation amount (required if finance_valuation_cost=true)';

-- 7. Create view for cases with calculated fields
CREATE OR REPLACE VIEW cases_summary AS
SELECT 
  c.*,
  a.name as agent_name,
  a.email as agent_email,
  ag.name as agency_name,
  CASE 
    WHEN c.co_borrowers IS NOT NULL AND jsonb_array_length(c.co_borrowers) > 0 THEN true
    ELSE false
  END as has_co_borrower,
  CASE 
    WHEN c.insurance_type = 'none' THEN false
    ELSE true
  END as requires_insurance
FROM cases c
LEFT JOIN agents a ON c.agent_id = a.id
LEFT JOIN agencies ag ON a.agency_id = ag.id;

-- 8. Add function to validate case completeness
CREATE OR REPLACE FUNCTION validate_case_completeness(case_id UUID)
RETURNS TABLE(is_complete BOOLEAN, missing_fields TEXT[]) AS $$
DECLARE
  case_record RECORD;
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO case_record FROM cases WHERE id = case_id;
  
  IF NOT FOUND THEN
    is_complete := FALSE;
    missing_fields := ARRAY['Case not found'];
    RETURN;
  END IF;
  
  -- Check required fields
  IF case_record.client_name IS NULL OR case_record.client_name = '' THEN
    missing := array_append(missing, 'client_name');
  END IF;
  
  IF case_record.client_ic IS NULL OR case_record.client_ic = '' THEN
    missing := array_append(missing, 'client_ic');
  END IF;
  
  IF case_record.facility_amount IS NULL OR case_record.facility_amount <= 0 THEN
    missing := array_append(missing, 'facility_amount');
  END IF;
  
  IF case_record.selected_bank IS NULL OR case_record.selected_bank = '' THEN
    missing := array_append(missing, 'selected_bank');
  END IF;
  
  is_complete := (array_length(missing, 1) IS NULL);
  missing_fields := missing;
END;
$$ LANGUAGE plpgsql;

-- 9. Grant permissions
GRANT SELECT ON cases_summary TO authenticated;
GRANT EXECUTE ON FUNCTION validate_case_completeness(UUID) TO authenticated;

-- 10. Add RLS policies for co-borrowers
ALTER TABLE case_co_borrowers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their case co-borrowers"
  ON case_co_borrowers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_co_borrowers.case_id
      AND c.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can insert co-borrowers for their cases"
  ON case_co_borrowers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_co_borrowers.case_id
      AND c.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can update co-borrowers for their cases"
  ON case_co_borrowers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_co_borrowers.case_id
      AND c.agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can delete co-borrowers for their cases"
  ON case_co_borrowers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_co_borrowers.case_id
      AND c.agent_id = auth.uid()
    )
  );
