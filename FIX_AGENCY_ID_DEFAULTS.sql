-- ============================================================
-- Fix: Add DEFAULT agency_id to all tables missing it
-- Purpose: Prevent "null value in column agency_id" errors
-- Date: 2026-04-13
-- Run this in Supabase SQL Editor
-- ============================================================

-- QAI Agency ID (the default/first agency)
-- This is the UUID from migration 002
DO $$ 
DECLARE
  qai_agency_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Add DEFAULT to tables that are missing it
  -- This allows inserts without explicitly providing agency_id
  
  ALTER TABLE cases 
    ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  ALTER TABLE calculations 
    ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  ALTER TABLE commissions 
    ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  ALTER TABLE banks 
    ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  ALTER TABLE commission_tier_config 
    ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  -- Note: lawyers and profiles should already have been fixed
  -- If not, uncomment these lines:
  -- ALTER TABLE lawyers 
  --   ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  -- ALTER TABLE profiles 
  --   ALTER COLUMN agency_id SET DEFAULT qai_agency_id;
  
  RAISE NOTICE '✅ Successfully added DEFAULT agency_id to all affected tables';
  RAISE NOTICE '📋 Tables updated: cases, calculations, commissions, banks, commission_tier_config';
  RAISE NOTICE '💡 New records will default to QAI agency if agency_id is not provided';
END $$;

-- Add helpful comments to document this change
COMMENT ON COLUMN cases.agency_id IS 'Agency this case belongs to (defaults to QAI agency)';
COMMENT ON COLUMN calculations.agency_id IS 'Agency this calculation belongs to (defaults to QAI agency)';
COMMENT ON COLUMN commissions.agency_id IS 'Agency this commission belongs to (defaults to QAI agency)';
COMMENT ON COLUMN banks.agency_id IS 'Agency this bank config belongs to (defaults to QAI agency)';
COMMENT ON COLUMN commission_tier_config.agency_id IS 'Agency this tier config belongs to (defaults to QAI agency)';

-- Verify the changes
SELECT 
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'agency_id'
  AND table_name IN ('cases', 'calculations', 'commissions', 'banks', 'commission_tier_config', 'lawyers', 'profiles')
ORDER BY table_name;
