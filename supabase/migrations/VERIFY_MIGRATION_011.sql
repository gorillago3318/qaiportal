-- ============================================================
-- Verification Script for Migration 011
-- Run this AFTER running migration 011 to verify everything is set up correctly
-- ============================================================

-- 1. Check if special_arrangement_discount column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'cases' AND column_name = 'special_arrangement_discount'
    ) THEN '✅ special_arrangement_discount column exists'
    ELSE '❌ MISSING: special_arrangement_discount column'
  END AS check_result;

-- 2. Check lawyer_bank_associations table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'lawyer_bank_associations'
    ) THEN '✅ lawyer_bank_associations table exists'
    ELSE '❌ MISSING: lawyer_bank_associations table'
  END AS check_result;

-- 3. Check case_amendment_log table
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'case_amendment_log'
    ) THEN '✅ case_amendment_log table exists'
    ELSE '❌ MISSING: case_amendment_log table'
  END AS check_result;

-- 4. Check trigger exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM pg_trigger 
      WHERE tgname = 'trg_log_financial_amendments'
    ) THEN '✅ Financial amendment trigger exists'
    ELSE '❌ MISSING: Financial amendment trigger'
  END AS check_result;

-- 5. List panel lawyers and their bank associations
SELECT 
  l.name AS lawyer_name,
  l.firm AS law_firm,
  b.name AS bank_name,
  lba.is_panel,
  l.is_active
FROM lawyer_bank_associations lba
JOIN lawyers l ON lba.lawyer_id = l.id
JOIN banks b ON lba.bank_id = b.id
ORDER BY l.name, b.name;

-- 6. Show sample data in cases table (financial fields)
SELECT 
  id,
  case_code,
  lawyer_professional_fee,
  special_arrangement_discount,
  has_lawyer_discount,
  lawyer_discount_amount,
  status
FROM cases
WHERE lawyer_professional_fee IS NOT NULL OR special_arrangement_discount > 0
ORDER BY created_at DESC
LIMIT 5;

-- 7. Verify amendment log is working (if any amendments exist)
SELECT 
  cal.id,
  c.case_code,
  cal.field_name,
  cal.old_value,
  cal.new_value,
  cal.reason,
  p.full_name AS amended_by,
  cal.created_at
FROM case_amendment_log cal
JOIN cases c ON cal.case_id = c.id
JOIN profiles p ON cal.amended_by = p.id
ORDER BY cal.created_at DESC
LIMIT 10;

-- 8. Summary report
SELECT 
  '=== MIGRATION 011 VERIFICATION SUMMARY ===' AS report;

SELECT 
  COUNT(*) FILTER (WHERE is_panel = TRUE) AS total_panel_lawyers,
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active_lawyers
FROM lawyers;

SELECT COUNT(*) AS total_bank_associations FROM lawyer_bank_associations;

SELECT 
  COUNT(*) FILTER (WHERE special_arrangement_discount > 0) AS cases_with_special_arrangement,
  COUNT(*) FILTER (WHERE lawyer_professional_fee IS NOT NULL) AS cases_with_lawyer_fee
FROM cases;
