-- ============================================================
-- 007_commissions_workflow.sql
-- Add bank details, lawyer discounts, and storage buckets
-- ============================================================

-- 1. AGENT BANK DETAILS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

-- 2. LAWYER DISCOUNTS
ALTER TABLE cases ADD COLUMN IF NOT EXISTS has_lawyer_discount BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lawyer_discount_amount NUMERIC(12,2) DEFAULT 0;

-- 3. COMMISSION NOTES
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_notes TEXT;

-- 4. STORAGE BUCKET FOR CASE DOCUMENTS
-- Note: This requires the storage schema to exist. In standard Supabase, it does.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'case-documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
    VALUES ('case-documents', 'case-documents', false, 20971520, '{image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping bucket creation, please ensure the case-documents bucket is created manually in the Supabase Dashboard.';
END $$;

-- Add RLS rules for the storage bucket so agents can upload
DO $$
BEGIN
  CREATE POLICY "Agent can upload case documents" ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'case-documents' AND auth.role() = 'authenticated' );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Agents and Admins can view case documents" ON storage.objects FOR SELECT
    USING ( bucket_id = 'case-documents' AND auth.role() = 'authenticated' );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Admins can delete case documents" ON storage.objects FOR DELETE
    USING ( bucket_id = 'case-documents' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
