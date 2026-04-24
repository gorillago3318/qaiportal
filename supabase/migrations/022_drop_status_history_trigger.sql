-- Drop the trigger that fires auth.uid() on service-role updates.
-- The API layer (POST /api/cases and PATCH /api/cases/[id]) inserts
-- case_status_history explicitly with the authenticated user's ID.
-- The trigger fires auth.uid() = NULL when the admin service-role client
-- updates the cases table, violating the changed_by NOT NULL constraint.
DROP TRIGGER IF EXISTS trg_cases_status_history ON cases;
DROP FUNCTION IF EXISTS log_case_status_change();
