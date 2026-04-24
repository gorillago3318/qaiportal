-- Migration 023: Drop case_amendment_log trigger
--
-- Root cause: the trigger calls auth.uid() to populate amended_by, but all case
-- updates go through the service-role client (getAdminClient) which bypasses RLS.
-- When running under the service role, auth.uid() returns NULL, violating the
-- NOT NULL constraint on case_amendment_log.amended_by.
--
-- Pattern: same fix applied to trg_cases_status_history in migration 022.
-- The case_amendment_log table is kept intact for future manual inserts.

DROP TRIGGER IF EXISTS trg_log_financial_amendments ON cases;
DROP FUNCTION IF EXISTS log_financial_amendments();
