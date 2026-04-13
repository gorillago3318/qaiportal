# QuantifyAI — System Constitution
## The Single Source of Truth for Business Rules

> Version: 1.0  
> Date: 2026-04-13  
> Author: Audit + User confirmation  
> Status: AUTHORITATIVE — supersedes all code comments and previous assumptions  
> Future AI: Do NOT deviate from these rules without explicit user override.

---

## PART 1 — ORGANISATION HIERARCHY

### 1.1 Role Hierarchy (top → bottom)

```
super_admin        ← QuantifyAI system owner. Cross-agency access.
  └── admin        ← Per-agency administrator. Not a sales role.
        └── agency_manager   ← Highest SALES rank within an agency.
              └── unit_manager
                    └── senior_agent
                          └── agent
```

**Key rule:** `admin` and `super_admin` are **management roles**, not sales roles. They do not appear in commission tier config as earners.

### 1.2 What Each Role Can Do

| Action | agent | sr_agent | unit_mgr | agency_mgr | admin | super_admin |
|---|---|---|---|---|---|---|
| Submit cases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own cases | ✅ | ✅ | ✅ | ✅ | — | — |
| View all agency cases | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Finalize commission | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage agents | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage agencies | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View commission breakdown | Own only | Own only | Own only | Own only | All | All |

### 1.3 Multi-Agency

- Each agency is isolated. Agents in Agency A cannot see data from Agency B.
- `super_admin` is the only role that crosses agency boundaries.
- Every data record must have `agency_id` set. Records with `agency_id = NULL` are invalid.

---

## PART 2 — PANEL LAWYERS

### 2.1 Authoritative Panel Lawyer List

Only **two** panel lawyers exist:
1. **Low, Wong and Zahrita** (stored in DB as `is_panel = TRUE`)
2. **Yong & Rajah** (stored in DB as `is_panel = TRUE`)

These are stored in the `lawyers` table with `is_panel = TRUE`.

### 2.2 Panel vs Non-Panel Rules

| Scenario | Lawyer Commission | RM200 Deduction from Bank Commission |
|---|---|---|
| Case uses LWZ or Y&R (`is_panel = true`) | ✅ Calculated (see Part 3) | ✅ Deducted |
| Case uses any other lawyer (agent enters details) | ❌ None | ❌ Not deducted |
| Case has no lawyer | ❌ None | ❌ Not deducted |

### 2.3 How to Detect Panel Lawyer (Authoritative Method)

```
1. Check case.lawyer_id — is it set?
2. Query lawyers WHERE id = case.lawyer_id AND is_panel = TRUE
3. If YES → panel lawyer rules apply
4. If NO or NULL → non-panel rules apply
```

Do NOT use `lawyer_name_other` as the panel detection signal. That field is only for non-panel custom lawyers.

---

## PART 3 — COMMISSION CALCULATION

### 3.1 Commission Types

| Type | Source | Who receives | Trigger |
|---|---|---|---|
| Bank commission | Bank pays QAI based on disbursed loan | Agents in upline chain | Case reaches `payment_pending` status |
| Lawyer commission | Panel lawyer's professional fee (partial) | Agents in upline chain | Same — only for panel lawyers |

### 3.2 Commission Deductions (Bank)

Applied in order before distribution:

```
1. RM50     flat deduction (always)
2. RM200    panel loan agreement fee (only if panel lawyer confirmed — see 2.3)
3. Admin override (optional, entered by admin at finalization)

Bank Net Distributable = Gross Bank Commission − RM50 − [RM200] − Admin Override
```

### 3.3 Commission Deductions (Lawyer — Panel Only)

```
Lawyer Gross = Professional fee paid by client to panel lawyer
QAI Share = Lawyer Gross × 70%
Company Keep = QAI Share × 10%     (= 7% of Lawyer Gross)
Lawyer Net Distributable = QAI Share − Company Keep   (= 63% of Lawyer Gross)
```

### 3.4 Co-Broke (Referral) Split — **OPTION B**

When a `case_co_broke` record exists for the case:

```
Step 1: Compute Net Distributable as normal (after deductions)
Step 2: 
  Referrer gets: Net Distributable × referrer_share%    (default 30%)  ← FLAT, no tier breakdown
  Doer's pool:   Net Distributable × doer_share%        (default 70%)  ← goes to tier breakdown

Step 3: Run tier breakdown ONLY on Doer's pool, starting from doer_agent_id
```

**Important:** The referrer receives their amount as a DIRECT payout — no tier breakdown is applied to the referrer's share. The referrer keeps 100% of their co-broke share.

This applies to BOTH bank and lawyer commissions when co-broke exists.

### 3.5 Tier Breakdown (Differential Percentage Model)

Starting from the case agent (or doer agent in co-broke), walk up the `upline_id` chain:

```
For each person in the chain:
  tier_pct = commission_tier_config[person.role]  (from THIS agency only)
  diff = tier_pct - previous_tier_pct
  if diff > 0:
    allocate (diff / 100) × Net Distributable to this person

Chain stops at agency_manager (role = 'admin' or 'super_admin' = stop)

QuantifyAI (super_admin) ALWAYS gets: 7.5% of Net Distributable — attributed to the super_admin user
```

**Tier Percentages (Authoritative):**

| Role | Cumulative % | Differential |
|---|---|---|
| `agent` | 70% | 70% (baseline) |
| `senior_agent` | 80% | +10% |
| `unit_manager` | 87.5% | +7.5% |
| `agency_manager` | 92.5% | +5% |
| `super_admin` (QuantifyAI) | 100% | **always 7.5%** — fixed, not differential |

**Chain rule:** Walk up from case agent → stop when role is `admin` or `super_admin`.  
**Super_admin rule:** After the chain, always add super_admin as a recipient with exactly 7.5% of Net Distributable. This is hardcoded — it is QuantifyAI's platform fee.  
**Total always = 100%.**

**This must be reflected in the `tier_breakdown` JSONB.** Super_admin must appear as an explicit named recipient, not just "company_cut".

### 3.6 Co-Broke Rules (FIXED)

- Co-broke referrer_share is ALWAYS **30%**, doer_share is ALWAYS **70%**. Not configurable per case.
- Referrer receives their 30% as a direct flat payout — no tier breakdown applied to their share.
- Doer's 70% pool goes through the full tier breakdown (including the super_admin 7.5%).
- Example: Net = RM1,000
  - Referrer: RM300 (flat, direct)
  - Doer pool: RM700 → tier breakdown applied → doer's agent gets 70%×700=RM490, uplines get their diffs, super_admin gets 7.5%×700=RM52.50

### 3.6 Commission Status Flow (2-Step — AUTHORITATIVE)

```
[finalization by admin]       [mark payment sent]    [confirm received]
        ↓                              ↓                      ↓
   calculated    →    payment_pending    →    paid
```

- `calculated`: Commission amounts are computed and locked. Cannot be changed.
- `payment_pending`: Admin has sent the payment (bank transfer etc.). Agent is notified.
- `paid`: Payment confirmed received. Case is fully closed.

**No skipping steps.** `calculated → paid` directly is NOT valid.

---

## PART 4 — CASE LIFECYCLE

### 4.1 Status Flow

```
draft
  → submitted          (agent submits)
    → bank_processing  (admin submits to bank)
      → kiv            (bank requests more info)
      → approved        (bank approves)
        → accepted      (client accepts offer)
          → executed    (loan documents signed)
            → payment_pending  (funds disbursing)
              → paid    (commission finalised and paid)
      → declined        (bank declines)
    → rejected          (admin/agent rejects before bank)
```

### 4.2 Who Can Change Status

| Transition | Who |
|---|---|
| draft → submitted | Agent |
| submitted → bank_processing | Admin |
| bank_processing → approved/declined/kiv | Admin |
| approved → accepted/rejected | Admin |
| accepted → executed | Admin |
| executed → payment_pending | Admin (when commission is calculated) |
| payment_pending → paid | Admin (when payment is confirmed) |

### 4.3 Validation Rules

- A case must have: `client_id`, `agent_id`, `proposed_bank_id`, `proposed_loan_amount`, `loan_type`
- Co-borrower: maximum 1 per case
- A case cannot be edited by an agent after status moves past `submitted`

---

## PART 5 — LOAN TYPES

| Type | Description | Has current loan section? | Lawyer commission possible? |
|---|---|---|---|
| refinance | Replace existing mortgage | ✅ | ✅ if panel lawyer |
| subsale | Buy from secondary market | ❌ | ✅ if panel lawyer |
| developer | Buy new property from developer | ❌ | ✅ if panel lawyer |

---

## PART 6 — CALCULATION ENGINE RULES

### 6.1 Monthly Instalment

Standard reducing balance amortisation:
```
M = P × [r(1+r)^n] / [(1+r)^n − 1]
where r = annual_rate / 12 / 100
```

### 6.2 Finance-in-Fees

When toggled on:
- If agent has quotation: enter exact legal fee + valuation fee separately
- If no quotation: use **4% of loan amount** as combined estimate

Stamp duty is **excluded** (included in lawyer's quotation, not separately financed).

### 6.3 Snowball (Refinance Only) — Two Scenarios

1. **Maintain Old Instalment**: extra = old monthly instalment − new monthly instalment (auto-calculated)
2. **Custom Extra**: agent enters any amount

### 6.4 Max Tenure

Age 70 minus current age = maximum remaining tenure years.  
Calculated from IC number (YYMMDD format) or DOB input.

### 6.5 Bank Interest Rate

When a bank is selected in the calculator, if that bank has `interest_rate` set in the DB, it auto-fills the proposed interest rate field.

---

## PART 7 — REFERRAL / AGENT CODE

- Each agent has a unique `agent_code` (e.g., `QAI0001`, `ALS0001` — agency prefix + 4-digit seq)
- Referral codes in the public calculator match agent codes
- A referral from the public calculator is recorded in `calculations.referral_code`
- Referral does NOT automatically create a `case_co_broke` — an admin must explicitly set up co-broke on the case

---

## PART 8 — DATA ISOLATION RULES

1. Every DB record that belongs to an agency MUST have `agency_id` set
2. All API routes that query data must filter by `agency_id` unless the caller is `super_admin`
3. RLS policies enforce this at the DB level as a second line of defence
4. `commission_tier_config` must be queried with `.eq('agency_id', case_agency_id)`

---

## PART 9 — UNIFIED CASE WORKFLOW (Agent Experience)

The calculation phase and case submission are done by the **same agent** for the same client. Data must flow forward — no re-typing.

### 9.1 Phase 1: Consultation (Calculator)
Agent enters: age, remaining tenure, interest rate, current outstanding, current repayment.  
System outputs: savings projection report for client.  
Saves to: `calculations` table with `report_token`.

### 9.2 Phase 2: Application Drafting (Case Creation)
After client agrees to proceed:
- Agent creates a case (optionally pre-filled from a saved calculation via `?calc=<id>`)
- Agent selects bank (HLB or OCBC for now — these have full digital form support)
- System pre-fills all data from the calculation record into the case form
- Agent fills in additional info: employment, property details, lawyer, valuer
- Agent reviews the data → system renders it into the bank's printable form
- Client signs the printed form

### 9.3 Phase 3: Document Upload & Submission
Agent uploads:
- Signed bank form (scan)
- Income documents
- Property documents
- Co-borrower documents (if any)
Agent clicks **Submit** → case status changes from `draft` to `submitted`.

### 9.4 Phase 4: Admin Processing
Admin reviews all documents and data.  
If complete → admin changes status to `bank_processing` (passes to bank).  
Bank processes → admin updates status based on bank decision.

### 9.5 Pre-Fill Rule
If a case is created with `?calc=<calculation_id>`:
- Pull: client_name, client_ic, client_phone, client_dob, current_bank, current_loan_amount, current_interest_rate, current_tenure_months, proposed_bank_id, proposed_loan_amount, proposed_interest_rate, proposed_tenure_months, referral_code
- Pre-fill into the case form
- Agent can amend all pre-filled values (data changes between consultation and application are normal)

### 9.6 Bank Form Support
| Bank | Config File | Printable Form |
|---|---|---|
| Hong Leong Bank (HLB) | `src/config/bank-forms/hlb.ts` | `Forms/HONG LEONG BANK APPLICATION FORM.pdf` |
| OCBC | `src/config/bank-forms/ocbc.ts` | `Forms/OCBC APPLICATION FORM 0225.pdf` |
| All others | Manual entry only — no digital form rendering | N/A |

---

## APPENDIX — Open Questions

| # | Question | Status |
|---|---|---|
| A3 | Website CMS scope and structure | ❓ Pending |
