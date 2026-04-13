-- Quick Verification Script for Migration 008
-- Run this in Supabase SQL Editor to check if migration is needed

-- Check 1: Verify new enum values exist
SELECT 
    'Enum Values' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 9 THEN '✅ Migration Applied'
        ELSE '❌ Migration Needed - Missing enum values'
    END as status
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'case_status';

-- Expected: Should have at least 9 values (original + 4 new)

-- Check 2: Verify new columns exist
SELECT 
    'New Columns' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ Migration Applied'
        ELSE '❌ Migration Needed - Missing columns: ' || 
             STRING_AGG(
                 CASE 
                     WHEN col.column_name IS NULL THEN col.check_name
                     ELSE NULL
                 END, ', '
             )
    END as status
FROM (
    VALUES 
        ('bank_form_data'),
        ('has_lawyer'),
        ('has_valuer'),
        ('documents'),
        ('internal_notes')
) AS required_cols(check_name)
LEFT JOIN information_schema.columns AS col
    ON col.table_name = 'cases' 
    AND col.column_name = required_cols.check_name;

-- Expected: Should return count = 5

-- Check 3: List all current case_status enum values
SELECT 
    'Current Enum Values' as info,
    enumlabel as status_value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'case_status'
ORDER BY enumsortorder;

-- Expected: Should include draft, submitted, pending_signature, documents_uploaded, admin_review, bank_submission, etc.

-- Check 4: Show recent cases with their statuses
SELECT 
    id,
    case_code,
    status,
    agent_id,
    created_at,
    bank_form_data IS NOT NULL as has_bank_form_data
FROM cases
ORDER BY created_at DESC
LIMIT 10;

-- This shows if any cases are being created and what status they have
