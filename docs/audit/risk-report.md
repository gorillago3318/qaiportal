# Risk Report — Conflicts, Gaps & Critical Issues

> Audited: 2026-04-13  
> Auditor: Claude Sonnet 4.6  
> Severity: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

---

## SECTION 1 — ENVIRONMENT & DEV SETUP ISSUES

### 🔴 RISK-001: SUPABASE_SERVICE_ROLE_KEY likely missing from .env.local
**What was found:**  
`.env.local` only contains the public anon key and URL. The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is required by:
- `src/lib/supabase/admin.ts` (getAdminClient)
- `src/lib/agency.ts` (getServiceClient)
- Every API route that calls `getCallerProfile()`

**Impact:** All API routes that use the admin client will fail silently or throw 500 errors. This is likely the cause of the "Supabase fetch" login issue.

**Fix needed:** Add `SUPABASE_SERVICE_ROLE_KEY=<key>` to `.env.local`. Get it from Supabase dashboard → Project Settings → API.

---

### 🟠 RISK-002: VS Code cannot run `npm run dev`
**Likely cause:** VS Code's terminal doesn't inherit the correct `PATH` entries for Node.js on this Windows machine. The Command Prompt works because it has Node in PATH natively.

**Symptoms:** "command not found: npm" or similar in VS Code integrated terminal.

**Fix options:**
1. Set Node path in VS Code: Settings → `terminal.integrated.env.windows` → add Node path
2. Use Command Prompt as VS Code default terminal (Settings → `terminal.integrated.defaultProfile.windows` → `Command Prompt`)
3. Install Node via Windows installer (not fnm/nvm) so it's globally accessible

---

### 🟠 RISK-003: `npm run dev` shows excessive errors
**Likely causes (in order of probability):**
1. **TypeScript errors** — `ignoreBuildErrors: true` in next.config.ts suppresses build errors but NOT dev server type errors
2. **Missing env vars** — Service role key missing causes module load failures
3. **Tailwind v4 compatibility** — Tailwind v4 has breaking changes from v3; some CSS utilities may not resolve
4. **React 19 + Next.js 16 edge cases** — Both are very new; some patterns may throw warnings

**What to look for:** Categorize errors into: (a) TypeScript errors, (b) runtime errors, (c) CSS warnings. Priority is fixing TypeScript errors as they cascade.

---

## SECTION 2 — CRITICAL FINANCIAL CALCULATION RISKS

### 🔴 RISK-004: Co-Broke (Referral) Commission Split is NOT Implemented
**What was found:**  
The `case_co_broke` table exists and has `referrer_share`/`doer_share` fields. The `case_co_broke` join is queried in some places.

**What the commission route (`/api/cases/[id]/commission`) actually does:**  
- Runs tier breakdown starting from `case.agent_id` — the case executor only.  
- Does NOT check if a `case_co_broke` record exists.  
- Does NOT split the commission between referrer and doer.  
- The referrer gets **zero** regardless of the co-broke agreement.

**This is a financial loss for referral agents.** If a referral network exists and co-broke cases are submitted, referrers are silently unpaid.

**Resolution needed from you:** Confirm: how should co-broke commission be handled? Does the commission engine split before tier breakdown, or does each agent (referrer + doer) get their own tier breakdown on their share?

---

### 🔴 RISK-005: Panel Lawyer Detection Logic is Fragile
**What was found:**
```typescript
const isPanelLawyer = !caseData.lawyer_name_other  // null = panel lawyer
```

**Problem:** This logic assumes that if `lawyer_name_other` is NULL, the case uses a panel lawyer. But:
- An agent could leave the panel lawyer field blank without selecting one → treated as panel
- An agent could enter a custom lawyer name AND have a panel lawyer `lawyer_id` → treated as non-panel
- The `lawyers` table has `is_panel` flag but this is not checked in commission route
- The `lawyer_bank_associations` table (migration 010) adds richer panel tracking, but is not used

**Impact:** Wrong deduction (RM200 panel loan agreement fee) applied when it shouldn't be, or missed when it should be.

---

### 🔴 RISK-006: Commission Tier Config Loaded Without Agency Filter
**What was found:**
```typescript
const { data: configs } = await supabase.from('commission_tier_config').select('*')
```

No `agency_id` filter. If multiple agencies exist with different tier percentages, this query returns ALL tiers from ALL agencies. The `configMap` is a flat dictionary by role, so later entries will silently overwrite earlier ones.

**Impact:** Agency A's agents could receive Agency B's commission percentages. In a multi-agency setup this is a critical financial error.

---

### 🟠 RISK-007: Commission Immediately Marked as 'Paid'
**What was found:**  
The commission route inserts the commission record with `status: 'paid'` directly. There is no review step, no `payment_pending` → `paid` transition, no confirmation of actual bank transfer.

**Impact:** Commission records show as paid the moment admin clicks "Finalize" — before any money actually moves. The `CommissionStatus` enum has `payment_pending` and `paid` states, implying a two-step flow was intended.

---

### 🟠 RISK-008: `bank_gross` is Manually Entered by Admin — No Validation Against Loan Amount
**What was found:**  
The commission finalization endpoint accepts `bank_gross` as a free-form input from the admin. There is no check that:  
`bank_gross ≈ proposed_loan_amount × bank.commission_rate`

**Impact:** Admin could enter any number. Overpayments or underpayments go undetected.

---

### 🟡 RISK-009: `calculateStampDuty` Imported but Not Used After Recent Changes
Partial fix was in progress (removal of stamp duty from UI). The import was removed from the calculation page but the function still exists in `loan.ts`. Not a financial risk, but indicates partial work-in-progress.

---

## SECTION 3 — DATA MODEL INCONSISTENCIES

### 🔴 RISK-010: `database.ts` Types Missing `agency_id` on All Tables
**What was found:**  
Migration 002 adds `agency_id` to every major table (`profiles`, `cases`, `calculations`, `banks`, `lawyers`, `clients`, `commissions`, etc.).  

The TypeScript type definitions in `src/types/database.ts` do NOT include `agency_id` on any of these tables.

**Impact:**
- TypeScript thinks inserting a record with `agency_id` is a type error
- This is masked by `ignoreBuildErrors: true`
- Every API route that needs to filter by agency has to use `(supabase as any)` casts or gets errors silently suppressed
- The type system provides zero protection for multi-agency correctness

---

### 🟠 RISK-011: Case Status Enum Mismatch
**database.ts defines:**
```
draft | submitted | bank_processing | kiv | approved | declined |
accepted | rejected | payment_pending | paid
```

**Migration 008 adds:**
```
pending_signature | documents_uploaded | admin_review | bank_submission
```

**Impact:**
- Frontend status label maps (`CASE_STATUS_LABELS`) have no entry for the 4 new statuses
- Cases reaching these statuses will show undefined/blank labels in the UI
- Status history timeline will break for these statuses

---

### 🟠 RISK-012: Duplicate and Conflicting Lawyer Fields
The `cases` table has grown through multiple migrations with conflicting lawyer-related fields:

| Field | Source | Meaning |
|---|---|---|
| `lawyer_id` | 001 | FK to panel lawyers table |
| `lawyer_name_other` | 001 | Custom (non-panel) lawyer name |
| `lawyer_firm_other` | 001 | Custom firm name |
| `lawyer_case_types` | 001 | Array of LA/SPA/MOT |
| `lawyer_professional_fee` | 007/008 | Professional fee amount |
| `has_lawyer_discount` | 007 | Discount flag |
| `lawyer_discount_amount` | 007 | Discount amount |
| `has_lawyer` | 008 | Whether a lawyer is involved |
| `is_panel_lawyer` | 008 | Is it a panel lawyer (boolean) |
| `lawyer_contact` | 008 | Contact info |
| `special_arrangement_discount` | 011 | Special panel arrangement discount |

There is no single authoritative field for "is this a panel lawyer". The commission route uses `!lawyer_name_other` as a proxy. Migration 008 added `is_panel_lawyer` boolean but the commission route doesn't use it.

---

### 🟠 RISK-013: Duplicate Valuer Fields
Similarly, valuers have accumulated conflicting fields:

| Field | Source |
|---|---|
| `valuer_name`, `valuer_firm` | 001 |
| `valuer_1_name`, `valuer_1_firm`, `valuer_1_date`, `valuer_1_amount` | 006/010 |
| `valuer_2_name`, `valuer_2_firm`, `valuer_2_date`, `valuer_2_amount` | 010 |
| `has_valuer`, `valuer_contact`, `valuer_email` | 008 |
| `valuation_fee_quoted`, `valuation_report_received` | 008 |

The original `valuer_name/firm` fields are likely never used if the newer `valuer_1_*` fields are populated by the form.

---

### 🟡 RISK-014: Co-Borrower Limit Trigger May Be Broken
**Migration 009** adds a trigger to enforce max 1 co-borrower per case. However, migration 009 also references:
- `facility_amount`, `loan_tenure`, `insurance_type` — columns that don't exist in the schema
- `case_co_borrowers` — table that doesn't exist (the table is `co_borrowers`)

**Impact:** Migration 009 may have **partially failed or been partially applied**. If the trigger was applied before the broken parts, the limit enforcement may work. If not, it may silently allow multiple co-borrowers.

---

## SECTION 4 — SECURITY & AUTH RISKS

### 🔴 RISK-015: Middleware Does Not Enforce Role-Based Admin Access
**What was found:**  
```typescript
// Protect admin routes
if (pathname.startsWith('/admin') && !user) {
  return NextResponse.redirect(...)
}
```

Middleware only checks if the user **is authenticated** for `/admin` routes. It does NOT check if the user **has an admin role**. An authenticated agent navigating directly to `/admin/settings` would get past middleware.

**Current protection:** Only from server-side `getCallerProfile()` checks in individual API routes. The admin UI pages themselves rely on the API returning 403. But the admin **pages** render for any authenticated user.

**Impact:** Agents can access admin page HTML/UI even if API calls are blocked.

---

### 🟠 RISK-016: Some API Routes Use Anon Client for Data Queries After RLS Migration
After migration 002, RLS policies filter by agency_id. Some API routes (like `/api/cases` GET) use the anon Supabase client for the main data query, relying on RLS to scope data correctly. This is the intended pattern.

However: if the `my_agency_id()` RLS function returns NULL (because the user's profile has no agency_id set), the RLS policy may return NO rows or ALL rows depending on how the policy is written — both are wrong.

**Specific risk:** Agents created directly in Supabase dashboard (not via the invite flow) may have `agency_id = NULL` and bypass agency isolation.

---

### 🟡 RISK-017: PDF Generation Has No Size/Content Validation
`/api/generate-pdf` and `/api/inspect-pdf` accept file uploads without documented size limits or content validation. No malicious PDF protection.

---

## SECTION 5 — CODE QUALITY & MAINTAINABILITY RISKS

### 🟠 RISK-018: Massive Monolithic Page Files
| File | Lines |
|---|---|
| `src/app/agent/calculations/new/page.tsx` | 1,888 |
| `src/app/agent/cases/new/page.tsx` | 1,661 |
| `src/config/bank-forms/hlb.ts` | 1,067 |

These files are difficult to maintain, review, or test. Logic, UI, and state management are mixed. Bugs are harder to isolate.

---

### 🟠 RISK-019: Commission Constants Are Duplicated
The constants `BANK_FLAT_DEDUCTION = 50`, `PANEL_LOAN_AGR_DEDUCTION = 200`, `LAWYER_QAI_SHARE_PCT = 0.70`, `LAWYER_COMPANY_CUT_PCT = 0.10` are copy-pasted identically in both:
- `/api/cases/[id]/commission/route.ts`
- `/api/cases/[id]/commission/preview/route.ts`

If the business changes (e.g., flat deduction becomes RM100), both files must be updated manually. One will be missed.

---

### 🟡 RISK-020: `buildTierBreakdown` Function Also Duplicated
The same function exists in both commission routes above, with slightly different signatures. Any logic fix must be applied twice.

---

### 🟡 RISK-021: `(supabase as any)` Casts Widespread
Across many API routes, queries use `(adminClient as any)` or `(supabase as any)` to bypass TypeScript. This means type errors in queries (wrong column names, wrong return shapes) are invisible at compile time.

Root cause: `database.ts` types are incomplete (no `agency_id`, missing fields added by later migrations).

---

### 🟡 RISK-022: No Test Suite Exists
Zero test files found in the codebase. The loan calculation engine — which handles Malaysian-specific financial formulas — has no unit tests. A wrong formula (e.g., wrong fee scale tier, off-by-one in snowball) would only be caught manually.

---

## SECTION 6 — INCOMPLETE / MISSING FEATURES

### 🟠 RISK-023: Calculation → Case Conversion Not Automated
`calculations.converted_to_case_id` field exists. But there is no API endpoint or UI flow that actually copies calculation data into a new case. An agent must manually re-enter all data when converting a calculation to a case.

---

### 🟠 RISK-024: Reports Page is Empty / Placeholder
`/admin/reports/page.tsx` exists but the audit found no connected data API or chart data. Likely a stub page.

---

### 🟡 RISK-025: Website CMS is Undecided / Stub
`/admin/website/page.tsx` exists. The `/api/cms/route.ts` exists. But no content schema, no CMS structure, and the user confirmed in a previous session they haven't decided the scope.

---

### 🟡 RISK-026: Resources & Campaigns Have No File Upload Implementation
Tables exist. Pages exist. But no file upload flow, no storage bucket integration visible for these features specifically.

---

### 🟡 RISK-027: Dynamic Bank Forms Wired on Frontend Only
`src/config/bank-forms/hlb.ts` (1,067 lines) and `ocbc.ts` (671 lines) contain detailed field definitions. The `cases.bank_form_data` JSONB stores submitted values. But:
- Only HLB and OCBC have configs
- No API endpoint to fetch the config for a given bank
- The dynamic form component (`dynamic-bank-form.tsx`) imports configs directly — all banks are bundled into the client regardless
- New banks require code changes, not admin configuration

---

## SECTION 7 — SUMMARY TABLE

| ID | Severity | Area | Description |
|---|---|---|---|
| 001 | 🔴 | Env | SUPABASE_SERVICE_ROLE_KEY missing — breaks all admin API calls |
| 002 | 🟠 | Dev | VS Code can't run npm dev |
| 003 | 🟠 | Dev | Excessive dev server errors |
| 004 | 🔴 | Finance | Co-broke referral commission not implemented — referrers unpaid |
| 005 | 🔴 | Finance | Panel lawyer detection is wrong — wrong deductions applied |
| 006 | 🔴 | Finance | Commission tier config has no agency filter — cross-agency contamination |
| 007 | 🟠 | Finance | Commission immediately set to 'paid' — no payment confirmation step |
| 008 | 🟠 | Finance | bank_gross not validated against actual loan × rate |
| 009 | 🟡 | Finance | Stamp duty function orphaned after UI removal |
| 010 | 🔴 | Types | agency_id missing from all TypeScript type definitions |
| 011 | 🟠 | Types | 4 new case statuses not in frontend label maps |
| 012 | 🟠 | Data | Conflicting lawyer fields — no authoritative source |
| 013 | 🟠 | Data | Conflicting valuer fields — no authoritative source |
| 014 | 🟡 | Data | Co-borrower limit trigger may be broken (migration 009) |
| 015 | 🔴 | Security | Admin middleware only checks auth, not role |
| 016 | 🟠 | Security | NULL agency_id breaks RLS isolation |
| 017 | 🟡 | Security | PDF endpoints lack size/content validation |
| 018 | 🟠 | Code | Massive monolithic pages (1888, 1661 lines) |
| 019 | 🟠 | Code | Commission constants duplicated in two files |
| 020 | 🟡 | Code | buildTierBreakdown function duplicated |
| 021 | 🟡 | Code | Widespread (as any) casts bypass type safety |
| 022 | 🟡 | Code | No test suite — financial formulas untested |
| 023 | 🟠 | Feature | Calc → Case conversion not automated |
| 024 | 🟠 | Feature | Reports page is a stub |
| 025 | 🟡 | Feature | CMS scope undecided |
| 026 | 🟡 | Feature | Resources/Campaigns have no file upload |
| 027 | 🟡 | Feature | Dynamic bank forms frontend-only, only 2 banks |

---

## AWAITING YOUR INPUT

Before any fixes are made, I need you to clarify the following **business logic questions**:

1. **Co-broke commission split**: When a case has a referrer (case_co_broke record), how should commission be calculated?
   - Option A: Split the net distributable first (referrer gets 30% share, doer gets 70% share), then each runs their own tier breakdown independently
   - Option B: Run tier breakdown on full amount from doer's chain, then give referrer a separate fixed amount
   - Option C: Something else?

2. **Panel lawyer**: What is the correct way to determine if a lawyer is "panel"? 
   - By `lawyer_id` being set (existing panel lawyer selected)?
   - By the `is_panel_lawyer` boolean on the case (added in migration 008)?
   - By something else?

3. **Commission payment flow**: Should commission go `calculated → payment_pending → paid` (two-step), or is `calculated → paid` (one-step) intentional?

4. **Commission tier defaults**: What are the correct tier percentages for each role? (These are currently configured per-agency in the DB but may not be seeded correctly)

5. **Case statuses**: Which statuses are currently in use vs. which are future? Can we simplify the status list?

6. **Admin portal access control**: Should the middleware itself block non-admin roles from the `/admin` URL, or is page-level checking sufficient?

7. **Deleted/unwanted files**: Once you're ready, which sections would you like to remove?
