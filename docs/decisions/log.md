# Decision Log

> Record of all architectural and business logic decisions.  
> Format: Decision | Why | Date | Who

---

## COMMISSION

### DEC-001: Co-Broke Uses Option B
**Decision:** When a case has a co-broke referral, the net distributable is split first (30% flat to referrer, 70% to doer's tier chain). The referrer receives their share directly with NO tier breakdown applied.  
**Why:** Option A (each party runs own full tier breakdown) would double-count money. Option B treats the referral as a flat reward separate from the sales hierarchy.  
**Date:** 2026-04-13  
**Confirmed by:** User

### DEC-002: Commission is 2-Step (Calculated → Payment Pending → Paid)
**Decision:** Commission finalisation only sets status to `calculated`. A second action marks `payment_pending` (admin sends payment). A third action marks `paid` (admin confirms receipt).  
**Why:** Immediate `paid` status before money moves creates a false audit trail. The 2-step flow reflects reality: calculation happens before money transfers.  
**Date:** 2026-04-13  
**Confirmed by:** User

### DEC-003: Only LWZ and Y&R Are Panel Lawyers
**Decision:** Lawyer commission is only calculated for LWZ and Y&R (stored in `lawyers` table with `is_panel = true`). All other lawyers result in no lawyer commission and no RM200 deduction from bank commission.  
**Why:** Business agreement — QAI only has commission-sharing arrangements with these two firms.  
**Date:** 2026-04-13  
**Confirmed by:** User

### DEC-004: Panel Lawyer Detected by DB Flag, Not Null Check
**Decision:** Panel lawyer is confirmed by querying `lawyers WHERE id = case.lawyer_id AND is_panel = true`. The old method of checking `lawyer_name_other IS NULL` is wrong and retired.  
**Why:** The null check was a proxy that breaks in multiple edge cases.  
**Date:** 2026-04-13  
**Confirmed by:** Audit finding + user validation

### DEC-005: Commission Tier Percentages Are Fixed
**Decision:** The authoritative tier percentages are:
- agent: 70%, senior_agent: 80%, unit_manager: 87.5%, agency_manager: 92.5%
- admin and super_admin: not in tier config (they do not earn commission)
**Why:** User confirmed these numbers on 2026-04-13.  
**Date:** 2026-04-13  
**Confirmed by:** User

### DEC-006: Commission Tier Config Must Be Agency-Scoped
**Decision:** All queries to `commission_tier_config` MUST include `.eq('agency_id', case.agency_id)`.  
**Why:** Without the filter, agencies with different tier configs contaminate each other. This is a financial correctness requirement.  
**Date:** 2026-04-13  
**Confirmed by:** Audit finding

---

## PANEL LAWYERS & FEES

### DEC-007: Stamp Duty Excluded from Finance-in-Fees Calculator
**Decision:** The "Finance in Legal/Valuation Fees" toggle no longer includes stamp duty as a separate field. Stamp duty is always assumed to be inside the lawyer's quotation.  
**Why:** Stamp duty is normally bundled by the lawyer and not separately financed. Showing it separately confused agents.  
**Date:** 2026-04-13  
**Confirmed by:** User (issue #8 in UX fixes)

### DEC-008: No-Quotation Fees = 4% of Loan Amount (Combined)
**Decision:** If agent has no lawyer/valuer quotation, estimate = 4% of proposed loan amount. This covers both legal fee and valuation fee combined.  
**Why:** 4% is a conservative combined estimate that covers both fees in most cases. Exact figures require quotation.  
**Date:** 2026-04-13  
**Confirmed by:** User (issue #7 in UX fixes)

---

## ARCHITECTURE

### DEC-009: Admin Middleware Checks Auth Only (Not Role)
**Decision:** `middleware.ts` only checks if the user is authenticated for `/admin` routes. Role checking happens at the page/API level.  
**Why:** User confirmed page-level checking is sufficient. Adding role checks to middleware would require an extra DB call on every request.  
**Date:** 2026-04-13  
**Confirmed by:** User

### DEC-010: Service Role Client Used Only for Caller Identity
**Decision:** `getAdminClient()` (service role, bypasses RLS) is used ONLY to fetch the caller's own profile. All data queries use the regular session client.  
**Why:** Using service role for data queries bypasses RLS and breaks multi-agency isolation. The pattern was established to solve the "Profile not found" bug during RLS migration.  
**Date:** 2026-04-13  
**Confirmed by:** Architectural decision from previous session

### DEC-011: database.ts Is the Authoritative TypeScript Schema
**Decision:** `src/types/database.ts` must always reflect the actual DB schema. Every migration that adds/removes columns must be followed by an update to this file.  
**Why:** Widespread `(as any)` casts exist because `database.ts` was not updated after migration 002 added `agency_id`. These casts hide bugs.  
**Date:** 2026-04-13  
**Confirmed by:** Audit finding

### DEC-012: No ignoreBuildErrors in Production
**Decision:** `next.config.ts` must have `ignoreBuildErrors: true` removed before production deployment.  
**Why:** TypeScript errors in financial logic are silently deployed. This is unacceptable in a system handling real money.  
**Date:** 2026-04-13  
**Confirmed by:** Audit finding

---

## CALCULATOR (UX)

### DEC-013: IC Number Auto-Fills Date of Birth
**Decision:** When 12 digits are entered in the IC field, the DOB field is auto-populated from digits 1–6 (YYMMDD format).  
**Why:** Agents enter IC first; typing DOB again is redundant and error-prone.  
**Date:** 2026-04-13

### DEC-014: Phone Field Defaults to +60
**Decision:** Phone input pre-fills with `+60`.  
**Why:** All users are Malaysian. Forcing the agent to type +60 every time is unnecessary friction.  
**Date:** 2026-04-13

### DEC-015: Snowball Has Two Scenarios for Refinancing
**Decision:** The snowball module shows two options for refinancing cases: (1) Maintain old instalment — auto-calculates extra from the instalment difference; (2) Custom extra amount — manual input.  
**Why:** The most common use case for refinancing snowball is "keep paying what I was paying before" — this should be one click, not a manual calculation.  
**Date:** 2026-04-13

### DEC-016: Bank Dropdown Shows Name Only (No Commission %)
**Decision:** Bank dropdown shows only bank name, not commission rate.  
**Why:** Showing % in the dropdown exposes commission data visually and is confusing to agents doing client-facing work.  
**Date:** 2026-04-13

---

### DEC-017: Panel Lawyer Names Confirmed
**Decision:** The two panel lawyers are **"Low, Wong and Zahrita"** and **"Yong & Rajah"**. Only these two have `is_panel = TRUE` in the `lawyers` table.  
**Date:** 2026-04-13 | **Confirmed by:** User

### DEC-018: Co-Broke Split is Always Fixed 30/70
**Decision:** Referrer always 30%, doer always 70%. No per-case override. `case_co_broke.referrer_share = 30`, `doer_share = 70` always.  
**Date:** 2026-04-13 | **Confirmed by:** User

### DEC-019: Chain Stops at agency_manager; super_admin Always Gets 7.5%
**Decision:** Tier breakdown walks agent → agency_manager only. After chain, super_admin (QuantifyAI) is explicitly allocated 7.5% of net distributable as a hardcoded platform fee. Super_admin MUST be a named recipient in tier_breakdown JSONB — not just "company_cut".  
**Date:** 2026-04-13 | **Confirmed by:** User

### DEC-020: Calculation → Case Must Pre-Fill (No Re-Typing)
**Decision:** Case form reads from saved calculation via `?calc=<id>` and pre-fills all matching fields. Agent can amend all values.  
**Date:** 2026-04-13 | **Confirmed by:** User

### DEC-021: Commission Logic Extracted to Shared Module
**Decision:** `buildTierBreakdown`, constants (RM50, RM200, 7.5%, 30/70), and co-broke logic extracted to `src/lib/commission/engine.ts`. Both commission routes import from there.  
**Date:** 2026-04-13 | **Decided by:** Claude (user delegated file structure decisions)

---

## OPEN DECISIONS (Unresolved)

| # | Question | Status |
|---|---|---|
| OD-003 | Website CMS — what pages/content does it manage? | ❓ Need from user |
