# Troubleshooting Guide - Case Creation Issues

## Problem Summary
- ✅ "Save as Draft" appears to succeed (no error shown)
- ❌ Saved draft cases don't appear in the cases list
- ❌ Can't find the saved case afterward
- ⚠️ "Render to Form" fails (expected - needs migration)

## Root Cause Analysis

### Most Likely Issue: Missing Database Migration

The new case creation features require database schema changes that haven't been applied yet. When you try to save a case with the new fields (`bank_form_data`, `has_lawyer`, etc.), one of two things happens:

1. **Silent Failure**: Supabase ignores unknown columns and saves only the old fields
2. **Error**: The insert fails but the error isn't properly displayed

## Immediate Solution

### Step 1: Run the Database Migration

You MUST run migration 008 before the new features will work properly.

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of: `supabase/migrations/008_enhanced_case_workflow.sql`
4. Paste into the SQL editor
5. Click **Run**
6. Verify success message appears

**Option B: Via Supabase CLI**
```bash
cd qaiportal
supabase db push
```

**What the migration does:**
- Adds new status values to `case_status` enum (`pending_signature`, `documents_uploaded`, `admin_review`, `bank_submission`)
- Adds enhanced lawyer fields (`has_lawyer`, `lawyer_contact`, `lawyer_email`, `lawyer_address`, etc.)
- Adds enhanced valuer fields (`has_valuer`, `valuer_contact`, `valuer_email`, `valuation_fee_quoted`, etc.)
- Adds `documents` JSONB column for tracking uploaded files
- Adds `bank_form_data` JSONB column for storing dynamic form data
- Adds `internal_notes` TEXT column for admin comments

### Step 2: Verify Migration Success

After running the migration, verify the new columns exist:

```sql
-- Check if new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cases' 
AND column_name IN ('bank_form_data', 'has_lawyer', 'has_valuer', 'documents', 'internal_notes')
ORDER BY column_name;

-- Should return 5 rows if migration succeeded
```

### Step 3: Test Case Creation Again

1. Clear browser cache or do a hard refresh (Ctrl+Shift+R)
2. Try creating a new HLB case again
3. Fill in minimal information
4. Click "Save as Draft"
5. Open browser console (F12) and check for logs
6. You should see detailed logging showing what's being sent and received

## Debugging Steps

### Check Browser Console Logs

Open DevTools (F12) → Console tab, then try saving a draft. You should see:

```
=== SAVE AS DRAFT STARTED ===
Form data: { ... }
Selected bank: hong_leong_bank
Sending payload to API: { ... }
API Response status: 201
Case created successfully: { id: "...", case_code: "..." }
```

If you see errors, they will tell us exactly what's failing.

### Check Server-Side Logs

If you have access to server logs (Vercel/Netlify dashboard or local terminal), look for:

```
Creating case with status: draft
Agent ID: <uuid>
Client ID: <uuid>
Case created successfully: <case_id> <case_code>
```

Or errors like:
```
Database insert error: { ... }
Error details: { ... }
```

### Common Error Messages & Solutions

#### Error: "column 'bank_form_data' does not exist"
**Solution**: Migration hasn't been run. See Step 1 above.

#### Error: "invalid input value for enum case_status: 'pending_signature'"
**Solution**: Migration hasn't added the new enum values. See Step 1 above.

#### Error: "null value in column 'agency_id' violates not-null constraint"
**Solution**: Agent profile doesn't have an agency_id. Check the agent's profile in the database.

#### No error but case doesn't appear in list
**Possible causes**:
1. Case was saved with wrong `agent_id` (check if you're logged in as the same agent)
2. Case has a different status than expected (check all statuses in filter)
3. Database query is filtering it out somehow

**Debug query**:
```sql
-- Find ALL cases for your agent
SELECT id, case_code, status, agent_id, created_at 
FROM cases 
WHERE agent_id = '<your-agent-uuid>'
ORDER BY created_at DESC;

-- Replace <your-agent-uuid> with your actual agent UUID
```

## Verification Checklist

After running the migration:

- [ ] Migration ran without errors
- [ ] New columns exist in `cases` table
- [ ] New enum values exist in `case_status` type
- [ ] Browser console shows successful API response (status 201)
- [ ] Server logs show "Case created successfully"
- [ ] Redirected to case detail page after saving
- [ ] Case appears in cases list when filtering by "Draft"
- [ ] Can view case details on the detail page

## If Problems Persist

### Collect This Information:

1. **Browser Console Output**: Copy all logs from when you click "Save as Draft"
2. **Network Tab**: In DevTools → Network tab, find the POST request to `/api/cases`, click it, and copy:
   - Request Payload
   - Response Body
   - Status Code
3. **Database Check**: Run this query and share results:
   ```sql
   SELECT id, case_code, status, agent_id, created_at, bank_form_data IS NOT NULL as has_bank_data
   FROM cases 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

### Quick Fix Option

If you need to test immediately and can't run the migration right now, I can temporarily modify the API to skip the new fields. However, this is **NOT recommended** as it will break the enhanced functionality.

## Next Steps After Fix

Once cases are saving correctly:

1. ✅ Test "Save as Draft" - should save and redirect to case detail
2. ✅ Test "Submit Case" - should save with status 'submitted'
3. ⚠️ Test "Render to Form" - will work after migration, shows print view
4. 📝 Implement document upload feature
5. 📝 Add co-borrower dynamic UI
6. 📝 Build admin review interface

## Contact Support

If issues persist after running the migration and checking logs, provide:
- Browser console output
- Network request/response details
- Database query results
- Any error messages shown

This will help diagnose the exact issue quickly.
