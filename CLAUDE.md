@AGENTS.md

# QuantifyAI — Claude Code Orientation (Single Source of Truth)

> This file overrides everything else. When this file conflicts with docs/core/constitution.md,
> src/constants/business.ts, or any other file, THIS FILE wins. Update it whenever the user
> confirms a business rule change.

---

## Stack

- Next.js 16.2.3 App Router + Turbopack, React 19, TypeScript, Tailwind CSS v4
- Supabase Auth + PostgreSQL + RLS
- `@supabase/ssr` — use `createServerClient` WITHOUT `<Database>` generic
- Service role client: `getAdminClient()` in `src/lib/supabase/admin.ts` — bypasses RLS, use only for privileged operations
- `src/constants/business.ts` — single source of truth for all numeric constants. Never hardcode numbers.
- `src/lib/commission/engine.ts` — shared commission calculation logic. All commission routes must use this.

---

## Key Conventions

- Every table has `agency_id` — always filter by it in queries
- `getCallerProfile(userId)` — shared helper, uses service role
- Panel lawyers: detected via `lawyers.is_panel = true` AND `lawyer_bank_associations` rows — never by null-checking `lawyer_name_other`
- Super admin always gets 7.5% platform fee (hardcoded, not from tier config)
- Co-broke: referrer 30% flat, doer 70% goes through tier breakdown (Option B)
- `notes` column does NOT exist on the `cases` table in the live DB — store notes inside `bank_form_data` JSONB instead

---

## Role Hierarchy (commission chain)

```
agent → senior_agent → unit_manager → agency_manager → admin → super_admin
```

Chain stops at admin/super_admin. Super_admin always gets 7.5% regardless.

---

## Full Case Lifecycle (confirmed 2026-04-14)

### Stage 0 — Calculation (pre-case, prospecting)

**Purpose:** Agent prospects client. Runs a calculation to compare current loan vs proposed.
Most useful for refinance; also used for subsale and developer purchases.

**Rules:**
- IC number is **optional** — it is too early in the process to have it
- **Age is required** (or derived from IC if provided) — max loan tenure must not extend past borrower age 70
- If co-borrower is younger, use the younger age for the 70-year ceiling check
- The output is a PDF report the agent brings to the client as a pitch

**Bugs to fix:**
- `/agent/calculations/[id]` — page does not exist → 404. Must build view + edit page.
- Edit must be available because client details may be wrong at first entry.

---

### Stage 1 — Application Form (case created, draft-able)

Agent creates a case (optionally from a calculation). Fills in the **bank-specific application form**
(form fields are tailored per bank selected — see `src/config/bank-forms/`).

- IC and full borrower details are entered here (now we have them)
- Agent can **save as draft at any point** — only bank selection is required
- All form data stored in `bank_form_data` JSONB column on `cases`

---

### Stage 2 — Supporting Info: Valuer + Lawyer Quotation (NEW)

Two parallel tasks before submitting. Both are part of the case creation flow.

#### 2A — Valuer Verbal Indicative Price

Normally **2 valuers** are required. For each valuer, agent enters:
- Firm name
- Valuer name
- Indicative property value (verbal, not formal report)
- Date of verbal quote

#### 2B — Lawyer Quotation Request

Agent selects which quotation types to request (one or more):
1. **LA** — Loan Agreement
2. **SPA** — Sales & Purchase Agreement
3. **MOT** — Memorandum of Transfer (includes Refinance variant)

System auto-emails the selected panel lawyer using the structured templates below.
Agent can request from **multiple lawyers** for comparison.

**After sending:** Admin receives the lawyer's reply (typically via WhatsApp) and forwards
to agent out of band. Agent then manually enters the quoted professional fee into the case.

#### Email Templates

**LA (Loan Agreement):**
```
Request for Quotation LA

Client Name: [client_name]
No. of Borrower: [borrower_count] borrower
1st/3rd Party: [party_type]

Financing Type: [financing_type]
Property details (Type): [property_type]
Land Tenure: [land_tenure]
Title Type: [title_type]
State: [state]

Bank: [bank_name]
Loan Amount: RM[loan_amount]

Special remark: [special_remark]
```

**SPA (Sales & Purchase — Purchaser):**
```
Request for Quotation SPA - Purchaser

Client Name: [client_name]
No. of Purchaser: [borrower_count]

Financing Type: [financing_type]
Property details (Type): [property_type]
Land Tenure: [land_tenure]
Title Type: [title_type]
State: [state]

Purchase Price: RM[purchase_price]

Special remark: [special_remark]
Involve mark up? [yes/no + details]
Please confirm if vendor bill is -
```

**MOT / Refinance:**
```
Request for Quotation MOT & Refinance – [transfer_reason]

Client Name: [client_name]
No. of Purchaser: [borrower_count] (registered owner after transfer)

Financing Type: [yes/no] ([financing_type])
Property Details (Type): [property_type]
Full Address: [property_address]
Built Up: [buildup_size_sqft] sqf
Land Tenure: [land_tenure]
Title Type: [title_type]
State: [state]

Market Value: RM[property_value]

Special Remark: [special_remark]
Existing loan (current outstanding): RM[existing_loan_outstanding]
Existing bank: [current_bank_name]
New/Refinance bank: [selected_bank]

Involve mark up?: [yes/no]
Please confirm if vendor bill is: [yes/no]
```

**Lawyer table fields (lawyers):**
- `general_email` — goes on bank forms / official correspondence
- `contact_email` — used for quotation request emails (may differ from general)

---

### Stage 3 — PDF Render + Client Signing

Once the application form is complete, agent renders it to PDF (via `/api/generate-pdf`),
prints it, and the **client signs**.

The rendered PDF overlays agent-entered data onto the bank's official form template stored
in `/Forms/`. Field positions are calibrated per bank in `src/app/api/generate-pdf/route.ts`.

---

### Stage 4 — Submission (document upload + lock)

Agent reviews all details (still editable at this point). Uploads:
- Signed application form
- Personal documents (IC, passport, etc.)
- Income documents (payslip, EA form, bank statement, etc.)
- Property documents (SPA, title, valuation report, etc.)

Click **Submit** → case status changes to `submitted`, admin is notified.

**After submit:** Agent **cannot edit** unless admin sets status to `kiv`.

---

### Stage 5 — Admin Review

Admin receives notification. Cross-checks portal data against the hardcopy documents.
If correct, sends the hardcopy stack to the bank.

Admin updates case status:
- `approved` — bank approved
- `kiv` — keep in view (issues to resolve; agent is notified and can edit again)
- `rejected` — bank rejected

**KIV flow:** Agent sees notification on login and in the case's comment/activity log.
Agent resolves the issue, adds a comment, and re-submits. Admin reviews again.

---

### Stage 6 — Post-Approval: Agent Accepts

Agent changes status `approved → accepted`. This requires:
1. Uploading the **signed Letter of Offer (LO)**
2. Filling in property title details:
   - Geran Tanah (land title number)
   - Cukai Tanah / Cukai Pintu (assessment tax reference)
   - *(Further fields to be finalised — softcopy upload sufficient for now)*

On accepted + LO upload: system **notifies the lawyer** to begin preparing the Loan Agreement.
This is done proactively before the bank issues its formal Letter of Instruction, saving time.

---

### Stage 7 — Admin: One-Click Send to Lawyer

Admin sees all documents. A single button sends the **Letter of Instruction** to the lawyer
(email to `contact_email`). This action is timestamped and logged — visible to both admin and agent.

---

### Stage 8 — Commission (calculated at Accepted)

Commission is **pre-calculated when the case reaches `accepted` status**, not at approval.

**Bank commission:**
- Standard formula: loan amount × bank commission rate
- Deduct: RM50 flat fee always
- Deduct: RM200 if panel lawyer used (covers LA fee charged to QAI)
- Deduct: any admin override adjustment
- Net distributable flows through tier breakdown

**Lawyer commission (panel lawyer only):**
- Source: professional fee from quotation (entered by agent in Stage 2B)
- Less: any special arrangement discount entered by agent
- QAI takes 70% of professional fee, keeps 10% internally, distributes 90% of its share
- Final amount is **viewable by agent but editable only by admin**
- Admin can amend after client signs LA (client sometimes negotiates discount at signing)

**Commission flow states:** `calculated` → `payment_pending` → `paid` (never skip to paid directly)

---

### Stage 9 — Audit Log (throughout all stages)

Every action is timestamped and attributed:
- Case created / edited (who, what, when)
- Status changes
- Documents uploaded
- Emails sent to lawyers
- Admin comments
- Agent comments

Viewable by **both agent and admin** from within the case detail page.

---

## Case Status Flow

```
draft → submitted → approved / kiv / rejected
                         ↓
                      accepted  ← uploads signed LO here
                         ↓
                   (commission calculated)
                         ↓
                   payment_pending → paid
```

---

## Permission Matrix

| Action | Agent | Admin |
|---|---|---|
| Edit case fields | ✅ before submit | ✅ always |
| Edit after submitted | ❌ (unless kiv) | ✅ always |
| Edit after approved | ❌ | ✅ always |
| Change status approved→accepted | ✅ (must upload LO) | ✅ |
| Change status accepted→anything | ❌ (find admin) | ✅ |
| Amend commission figures | ❌ | ✅ |
| Add comments | ✅ | ✅ |

---

## Pending Work (priority order)

1. **Fix: Calculation view/edit** — build `/agent/calculations/[id]/page.tsx` (view + edit); currently 404
2. **Fix: Calculation form** — IC optional, add age field, 70yr tenure cap using min(borrower_age, co_borrower_age)
3. **New: Lawyer table** — add `contact_email` column (for quotation emails) separate from `general_email`
4. **New: Stage 2 UI** — valuer entry (2 valuers) + lawyer quotation request (3 templates: LA, SPA, MOT) with email send
5. **New: Document upload** — Supabase Storage integration for Stages 4 and 6
6. **New: Audit log** — `case_activity_log` table + UI component in case detail
7. **New: Case status transitions** — enforce permission matrix above in both UI and API routes
8. **New: Commission at accepted** — trigger commission calculation when status → accepted
9. **Fix: Dev server tailwind** — `tailwindcss` can't resolve from parent dir
10. **Fix: Calculation form remaining** — Fix 6 (finance fees flow), Fix 7 (stamp duty row), Fix 8/10 (snowball scenarios)
11. Add `agency_id` to all table types in `src/types/database.ts`
12. Remove `ignoreBuildErrors: true` from `next.config.ts`
