-- Migration 014: Add contact_email to lawyers
-- Date: 2026-04-14
-- Purpose:
--   Lawyers have two email addresses:
--     general_email  — goes on official bank forms / correspondence (existing `email` column)
--     contact_email  — used for lawyer quotation request emails (new column)
--
--   Rename existing `email` column to `general_email` for clarity,
--   then add `contact_email`.

-- Step 1: Rename email → general_email (if email column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lawyers' AND column_name = 'email'
  ) THEN
    ALTER TABLE lawyers RENAME COLUMN email TO general_email;
  END IF;
END $$;

-- Step 2: Add general_email if neither email nor general_email exist
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS general_email TEXT;

-- Step 3: Add contact_email
ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN lawyers.general_email IS 'Official email address — printed on bank forms and formal correspondence';
COMMENT ON COLUMN lawyers.contact_email IS 'Working contact email — used for lawyer quotation request emails (LA/SPA/MOT)';
