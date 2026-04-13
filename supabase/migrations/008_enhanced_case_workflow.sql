-- Migration 008: Enhanced case workflow with lawyer/valuer details and document tracking
-- Date: 2026-04-13
-- Purpose: Add fields for enhanced lawyer/valuer info, document tracking, and workflow status
-- IMPORTANT: This migration MUST be run before using the new case creation features

-- Step 1: Add new status values for workflow
-- Note: PostgreSQL requires adding enum values one at a time
DO $$ BEGIN
    -- Check if enum value exists before adding
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'case_status' AND e.enumlabel = 'pending_signature') THEN
        ALTER TYPE case_status ADD VALUE 'pending_signature';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'case_status' AND e.enumlabel = 'documents_uploaded') THEN
        ALTER TYPE case_status ADD VALUE 'documents_uploaded';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'case_status' AND e.enumlabel = 'admin_review') THEN
        ALTER TYPE case_status ADD VALUE 'admin_review';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'case_status' AND e.enumlabel = 'bank_submission') THEN
        ALTER TYPE case_status ADD VALUE 'bank_submission';
    END IF;
END $$;

-- Step 2: Add enhanced lawyer information fields
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_lawyer BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_panel_lawyer BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_contact TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_email TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_address TEXT;

-- Step 3: Add enhanced valuer information fields
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_valuer BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_contact TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuer_email TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuation_fee_quoted NUMERIC(12,2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS valuation_report_received BOOLEAN DEFAULT false;

-- Step 4: Add document tracking field (JSONB for flexibility)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}'::jsonb;
-- Example structure:
-- {
--   "income_documents": ["url1", "url2"],
--   "property_documents": ["url3"],
--   "signed_application_form": "url4",
--   "valuation_report": "url5",
--   "other_documents": ["url6", "url7"]
-- }

-- Step 5: Add bank-specific form data storage (JSONB for dynamic forms)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS bank_form_data JSONB;
-- This stores all the dynamic form field values from HLB/OCBC configs
-- Allows us to save any field without schema changes

-- Step 6: Add notes field for internal comments
ALTER TABLE cases ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Step 7: Add index for document queries
CREATE INDEX IF NOT EXISTS idx_cases_documents ON cases USING GIN (documents);

-- Step 8: Add helpful comments
COMMENT ON COLUMN cases.status IS 'Workflow status: draft → pending_signature → documents_uploaded → submitted → admin_review → bank_submission';
COMMENT ON COLUMN cases.documents IS 'JSONB storing uploaded document URLs by category';
COMMENT ON COLUMN cases.bank_form_data IS 'JSONB storing complete bank-specific form data from dynamic forms';
COMMENT ON COLUMN cases.internal_notes IS 'Internal notes for admin use';

-- Verification query (optional - remove in production)
DO $$ 
DECLARE
    col_exists boolean;
BEGIN
    -- Check if key columns exist
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'cases' AND column_name = 'bank_form_data'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE NOTICE 'Migration 008 completed successfully!';
    ELSE
        RAISE WARNING 'Migration 008 may have failed - bank_form_data column not found';
    END IF;
END $$;
