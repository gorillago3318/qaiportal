# 🔍 Comprehensive Database Audit Report

**Date:** 2026-04-13  
**Trigger:** Error when adding lawyer via admin panel: `null value in column "agency_id" of relation "lawyers" violates not-null constraint`

---

## 🚨 CRITICAL ISSUES FOUND

### **Issue #1: Lawyers Table - Missing agency_id in INSERT**

**Problem:**
- Migration 002 added `agency_id UUID NOT NULL` to `lawyers` table
- When inserting a new lawyer, `agency_id` must be provided
- Admin panel or manual insert is not providing this required field

**Current Schema (from migration 002):**
```sql
ALTER TABLE lawyers
  ADD COLUMN agency_id UUID REFERENCES agencies(id) 
  DEFAULT '00000000-0000-0000-0000-000000000001' NOT NULL;

-- Later removed default:
ALTER TABLE lawyers ALTER COLUMN agency_id DROP DEFAULT;
```

**Impact:** Any INSERT into `lawyers` without `agency_id` will fail.

**Solution Options:**
1. **Add DEFAULT back** (if all lawyers belong to QAI by default):
   ```sql
   ALTER TABLE lawyers ALTER COLUMN agency_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
   ```

2. **Update admin UI** to always include `agency_id` from current user's agency

3. **Make agency_id nullable** (NOT recommended for multi-agency isolation):
   ```sql
   ALTER TABLE lawyers ALTER COLUMN agency_id DROP NOT NULL;
   ```

**Recommended:** Option 2 - Update the code to always provide agency_id

---

## 📊 Complete Schema Audit

### **Tables with agency_id (Multi-Agency Isolation)**

From migration 002, these tables have `agency_id NOT NULL`:

1. ✅ `profiles` - Users/agents
2. ✅ `cases` - Loan cases
3. ✅ `calculations` - Calculations
4. ✅ `commissions` - Commission records
5. ✅ `banks` - Bank configurations
6. ✅ `lawyers` - Lawyer records ⚠️ **ISSUE HERE**
7. ✅ `commission_tier_config` - Commission tiers

### **Tables WITHOUT agency_id (Global/Shared)**

These tables are shared across all agencies:

1. `agencies` - Agency definitions
2. `clients` - Client information (linked via cases)
3. `co_borrowers` - Co-borrower details (linked via case_co_broke)
4. `case_co_broke` - Junction table
5. `case_status_history` - Status tracking
6. `case_comments` - Comments
7. `case_documents` - Documents
8. `notifications` - Notifications

---

## 🔍 Potential Issues to Check

### **1. RLS Policies**

All tables with `agency_id` should have RLS policies that enforce:
- Users can only see data from their own agency
- Super admins can see all data

**Check if these policies exist:**
```sql
-- Example for lawyers table
SELECT * FROM pg_policies WHERE tablename = 'lawyers';
```

**Expected policies:**
- `lawyers_select_own_agency` - SELECT where agency_id = my_agency_id()
- `lawyers_insert_own_agency` - INSERT with agency_id = my_agency_id()
- `lawyers_update_own_agency` - UPDATE where agency_id = my_agency_id()
- `lawyers_delete_own_agency` - DELETE where agency_id = my_agency_id()
- `lawyers_super_admin_all` - ALL for super_admin role

### **2. Helper Functions**

Migration 002 created these functions:
- ✅ `my_agency_id()` - Returns current user's agency_id
- ✅ `is_super_admin()` - Checks if user is super admin
- ✅ `is_admin()` - Checks if user is admin/super_admin

**Verify they exist:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('my_agency_id', 'is_super_admin', 'is_admin');
```

### **3. Foreign Key Constraints**

All `agency_id` columns reference `agencies(id)`. Verify referential integrity:

```sql
-- Check for orphaned records
SELECT 'lawyers' as table_name, COUNT(*) as orphaned_count
FROM lawyers l
LEFT JOIN agencies a ON l.agency_id = a.id
WHERE a.id IS NULL;

-- Repeat for each table with agency_id
```

### **4. Indexes**

Migration 002 added indexes on all `agency_id` columns for performance:
- ✅ `idx_profiles_agency_id`
- ✅ `idx_cases_agency_id`
- ✅ `idx_calculations_agency_id`
- ✅ `idx_commissions_agency_id`
- ✅ `idx_banks_agency_id`
- ✅ `idx_lawyers_agency_id`
- ✅ `idx_commission_tier_config_agency_id`

---

## 🛠️ Immediate Fixes Required

### **Fix #1: Lawyers Insert Issue**

**Option A: Add DEFAULT back (Quick Fix)**
```sql
-- Run in Supabase SQL Editor
ALTER TABLE lawyers 
  ALTER COLUMN agency_id 
  SET DEFAULT '00000000-0000-0000-0000-000000000001';
```

**Option B: Update Application Code (Proper Fix)**

Find where lawyers are inserted and ensure `agency_id` is included:

```typescript
// Example fix in API route or component
const { data: user } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('agency_id')
  .eq('id', user.id)
  .single();

await supabase.from('lawyers').insert({
  name: lawyerData.name,
  firm: lawyerData.firm,
  // ... other fields
  agency_id: profile.agency_id  // ← MUST INCLUDE THIS
});
```

### **Fix #2: Verify All Tables Have Proper RLS**

Run this query to check which tables might be missing RLS policies:

```sql
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
  'profiles', 'cases', 'calculations', 'commissions',
  'banks', 'lawyers', 'commission_tier_config',
  'clients', 'co_borrowers', 'case_co_broke',
  'case_status_history', 'case_comments', 'case_documents',
  'notifications'
)
ORDER BY tablename;
```

All should have `rls_enabled = true`.

### **Fix #3: Check for Orphaned Records**

After migration 002, some tables might have invalid `agency_id` values:

```sql
-- Check each table
SELECT 'cases' as table_name, COUNT(*) as count
FROM cases c
LEFT JOIN agencies a ON c.agency_id = a.id
WHERE a.id IS NULL;

SELECT 'calculations' as table_name, COUNT(*) as count
FROM calculations c
LEFT JOIN agencies a ON c.agency_id = a.id
WHERE a.id IS NULL;

-- Repeat for commissions, banks, lawyers, commission_tier_config
```

If any return count > 0, those records need to be fixed:

```sql
-- Fix orphaned records
UPDATE cases SET agency_id = '00000000-0000-0000-0000-000000000001'
WHERE agency_id NOT IN (SELECT id FROM agencies);

-- Repeat for other tables
```

---

## 📋 Action Items Checklist

### **Immediate (Do Now)**

- [ ] **Fix lawyers insert** - Either add DEFAULT or update code
- [ ] **Test lawyer creation** - Try adding a lawyer again after fix
- [ ] **Verify RLS policies** - Ensure all tables have proper policies
- [ ] **Check helper functions** - Confirm my_agency_id(), is_super_admin() exist

### **Short-term (This Week)**

- [ ] **Audit all INSERT operations** - Ensure agency_id is always provided
- [ ] **Test multi-agency isolation** - Create test users in different agencies
- [ ] **Verify foreign keys** - Check for orphaned records
- [ ] **Add database constraints** - Ensure data integrity

### **Long-term (Future)**

- [ ] **Add audit logging** - Track who changes what
- [ ] **Implement soft deletes** - Don't hard delete records
- [ ] **Add data archival** - Archive old cases/calculations
- [ ] **Performance monitoring** - Monitor slow queries

---

## 🔧 Diagnostic Queries

Run these in Supabase SQL Editor to diagnose issues:

### **1. Check Lawyers Table Structure**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'lawyers'
ORDER BY ordinal_position;
```

### **2. Check RLS Policies on Lawyers**
```sql
SELECT polname, polcmd, polroles, polqual
FROM pg_policy
WHERE polrelid = 'lawyers'::regclass;
```

### **3. Test my_agency_id() Function**
```sql
-- Must be run as authenticated user, not superuser
SELECT my_agency_id();
```

### **4. Check for Missing Indexes**
```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('lawyers', 'cases', 'calculations')
AND indexname LIKE '%agency_id%'
ORDER BY tablename;
```

### **5. Verify Agencies Exist**
```sql
SELECT id, name, slug, is_active FROM agencies;
```

Should show at least the QAI agency:
```
id                                    | name       | slug | is_active
--------------------------------------|------------|------|----------
00000000-0000-0000-0000-000000000001  | QuantifyAI | qai  | true
```

---

## 🎯 Recommended Next Steps

1. **First:** Fix the immediate lawyers insert issue (add DEFAULT or update code)
2. **Second:** Verify all RLS policies are in place
3. **Third:** Test creating records in each table to ensure agency_id is handled correctly
4. **Fourth:** Review application code to ensure all INSERT/UPDATE operations include agency_id
5. **Fifth:** Document the multi-agency architecture for future developers

---

## 📞 Support

If you encounter more errors:
1. Check the exact error message
2. Identify which table/column is causing the issue
3. Verify the schema matches expectations
4. Check if RLS policies are blocking the operation
5. Ensure agency_id is being provided where required

**Last Updated:** 2026-04-13  
**Status:** ⚠️ Requires immediate attention - lawyers insert failing
