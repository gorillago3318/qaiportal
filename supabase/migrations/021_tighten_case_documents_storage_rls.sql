-- ============================================================
-- 021_tighten_case_documents_storage_rls.sql
-- Date: 2026-04-20
-- Purpose:
--   Migration 007 created the `case-documents` storage bucket with
--   overly permissive RLS (any authenticated user can upload/read any
--   case's documents). This replaces those policies with case-level
--   ownership checks using the path convention:
--
--     <case_id>/<document_type>_<timestamp>.<ext>
--
--   The first path segment IS the case_id — we extract it and check
--   that the caller is either:
--     (a) the agent assigned to the case, OR
--     (b) an admin / super_admin
--
--   Safe to re-run: guards drop old policies before recreating.
-- ============================================================

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS "Agent can upload case documents"        ON storage.objects;
DROP POLICY IF EXISTS "Agents and Admins can view case documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete case documents"       ON storage.objects;

-- Helper: caller is admin / super_admin
CREATE OR REPLACE FUNCTION public.is_privileged_role()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- Helper: caller owns the given case (agent_id match)
CREATE OR REPLACE FUNCTION public.can_access_case_docs(case_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cases
    WHERE id = case_uuid
      AND agent_id = auth.uid()
  );
$$;

-- INSERT: only the case's agent, or admin/super_admin
CREATE POLICY "case_docs_insert_owner_or_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-documents'
    AND auth.role() = 'authenticated'
    AND (
      public.is_privileged_role()
      OR public.can_access_case_docs(
           NULLIF(split_part(name, '/', 1), '')::uuid
         )
    )
  );

-- SELECT: same check
CREATE POLICY "case_docs_select_owner_or_admin"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-documents'
    AND auth.role() = 'authenticated'
    AND (
      public.is_privileged_role()
      OR public.can_access_case_docs(
           NULLIF(split_part(name, '/', 1), '')::uuid
         )
    )
  );

-- UPDATE: admins only (e.g. admin replaces a corrupt upload)
CREATE POLICY "case_docs_update_admin_only"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'case-documents' AND public.is_privileged_role() );

-- DELETE: admins only
CREATE POLICY "case_docs_delete_admin_only"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'case-documents' AND public.is_privileged_role() );

COMMENT ON FUNCTION public.is_privileged_role IS
  'Returns true if the calling user is admin or super_admin. Used by case-documents storage RLS.';
COMMENT ON FUNCTION public.can_access_case_docs IS
  'Returns true if auth.uid() is the agent assigned to the given case. Used by case-documents storage RLS.';
