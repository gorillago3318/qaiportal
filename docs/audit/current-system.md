# Current System — What It Actually Does

> Audited: 2026-04-13  
> Auditor: Claude Sonnet 4.6  
> Status: READ-ONLY — Do not treat this as specification

---

## 1. Stack & Tech

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.3 — App Router, server components |
| React | 19.2.4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email + password) |
| RLS | Enabled on all tables |
| Styling | Tailwind CSS v4 + Radix UI / Shadcn |
| PDF | @react-pdf/renderer + pdf-lib |
| Charts | Recharts |
| Forms | React Hook Form + Zod |

**⚠️ `next.config.ts` has `ignoreBuildErrors: true` — builds succeed even with TypeScript errors.**

---

## 2. Role Hierarchy

```
super_admin
  └── admin (per-agency admin)
        └── agency_manager  (highest sales rank)
              └── unit_manager
                    └── senior_agent
                          └── agent
```

- Commission flows **up** the upline chain via a differential percentage model.
- Each role has a `commission_tier_config` row per agency defining their cumulative %.

---

## 3. Database Tables (as built)

### Core

| Table | Purpose |
|---|---|
| `profiles` | User accounts. Includes `role`, `agent_code`, `upline_id` (self-ref), `is_active`, `must_change_password`, `agreement_signed_at` |
| `agencies` | Multi-tenant agencies. Has `slug`, `code_prefix`, `custom_domain`, brand colors |
| `banks` | Panel banks. `commission_rate` (decimal, e.g. 0.005 = 0.5%), `interest_rate` (nullable) |
| `lawyers` | Lawyer panel. `la_fee`, `spa_fee`, `mot_fee`, `is_panel` |
| `clients` | Client profiles. Linked by IC number |
| `calculations` | Calculator runs. Stores inputs + results JSONB. Has `report_token` for sharing |
| `cases` | Main mortgage case. Links to client, agent, proposed bank, lawyer |
| `commissions` | Commission records. Two types: `bank` and `lawyer` |
| `co_borrowers` | Co-borrowers per case (max 1 enforced by trigger) |
| `case_co_broke` | Referral split record. `referrer_share` + `doer_share` = 100 |
| `case_status_history` | Audit trail of all status changes |
| `case_comments` | Comments (admin vs agent scoped by `is_admin` flag) |
| `case_documents` | File upload records |
| `notifications` | In-app notification records |
| `lawyer_bank_associations` | Which lawyers are panel for which banks |
| `case_amendment_log` | Tracks changes to financial fields (lawyer fees, discounts) |
| `commission_tier_config` | Per-agency tier percentages |

### Supporting

| Table | Purpose |
|---|---|
| `campaigns` | Marketing campaigns (likely from migration 005) |
| `resources` | Educational files (migration 005) |

---

## 4. Case Lifecycle

### Statuses (as defined in database.ts)

```
draft → submitted → bank_processing → kiv → approved → accepted → executed → payment_pending → paid
                  ↘ declined
                  ↘ rejected
```

**Additional statuses added in migration 008** (not yet reflected in frontend label maps):
- `pending_signature`
- `documents_uploaded`
- `admin_review`
- `bank_submission`

### Transitions

- Agent can only edit a case in `draft` status.
- Any status change is logged in `case_status_history` (trigger-based).
- Commission finalization is tied to `paid` status.

---

## 5. Commission Engine (What It Actually Does)

### Bank Commission

```
1. Gross = Loan Amount × bank.commission_rate
2. Deductions:
     - RM50 flat (always)
     - RM200 if panel lawyer used
     - Admin override amount (optional)
3. Net Distributable = Gross − Deductions
4. Tier Breakdown (differential model):
     Walk up the upline chain from the case agent.
     For each person:
       diff = their tier% − previous tier%
       if diff > 0: allocate (diff/100) × Net Distributable to them
     Company gets: (100 − highest tier%) × Net Distributable
```

**Example with defaults:**
- Agent (70%) → 70% of Net
- Senior Agent upline (80%) → 10% of Net
- Unit Manager upline (87.5%) → 7.5% of Net
- Company → 12.5% of Net

### Lawyer Commission (Panel Only)

```
QAI Share = Professional Fee × 70%
Company keeps = QAI Share × 10%
Net Distributable = QAI Share × 90%
Tier Breakdown: same differential model on Net Distributable
```

Non-panel lawyers: no commission entry created.

### Co-Broke (Referral)

```
case_co_broke:
  referrer_agent_id  ← agent who brought the client
  doer_agent_id      ← agent who executed the case
  referrer_share     ← default 30%
  doer_share         ← default 70%
  (constraint: must sum to 100)
```

The actual commission split for co-broke is **not implemented** in the commission API yet — the commission route only runs the tier breakdown from `case.agent_id`, not from the co-broke record.

---

## 6. Calculation Engine (loan.ts)

### What's implemented:

| Function | Formula |
|---|---|
| `calculateMonthlyInstalment` | Standard amortisation: M = P·r(1+r)^n / ((1+r)^n − 1) |
| `calculateRefinance` | Full refinance comparison (savings, break-even, cash-out) |
| `calculateBiweekly` | Pay half-monthly every 2 weeks (26 payments/year) |
| `calculateSnowball` | Extra monthly payment → reduced tenure |
| `calculateLegalFee` | Solicitors' Remuneration Order 2017 scale |
| `calculateValuationFee` | BOVAEA scale |
| `calculateStampDuty` | 0.5% flat |

### Public API

`POST /api/public/calculate` — unauthenticated, runs core calculation from JSON input.

---

## 7. Authentication Flow

1. User logs in at `/login` via Supabase email/password.
2. Middleware at `src/middleware.ts`:
   - Refreshes Supabase session cookies.
   - Redirects unauthenticated users away from `/agent/**` and `/admin/**`.
   - Reads hostname to resolve agency slug → sets `x-agency-slug` header.
3. On first login (admin-created agents):
   - `must_change_password = true` → forced redirect to `/onboarding/change-password`.
   - `agreement_signed_at = null` → forced redirect to `/onboarding/agreement`.
4. RLS policies on every table, using helper functions:
   - `is_super_admin()`, `is_admin()`, `my_agency_id()` (all SECURITY DEFINER)

---

## 8. API Routes (Full List)

| Method | Route | Who | What |
|---|---|---|---|
| GET | /api/agents | admin+ | List agents, filter by role/agency |
| POST | /api/agents | admin+ | Create agent profile |
| POST | /api/agents/invite | admin+ | Send invite email |
| GET | /api/cases | agent/admin | List cases (agent sees own, admin sees all) |
| POST | /api/cases | agent | Create new case |
| GET | /api/cases/[id] | agent/admin | Fetch full case |
| PUT | /api/cases/[id] | agent/admin | Update case (draft only for agents) |
| POST | /api/cases/[id]/commission | admin | Finalize commission |
| GET | /api/cases/[id]/commission/preview | admin | Preview commission |
| POST | /api/cases/[id]/comments | agent/admin | Add comment |
| GET | /api/calculations | agent | List calculations |
| POST | /api/calculations | agent | Save calculation |
| GET | /api/calculations/[id] | agent | Get calculation |
| POST | /api/public/calculate | public | Run calculation (no auth) |
| GET | /api/commissions | agent/admin | List commissions |
| PATCH | /api/commissions | admin | Update commission status |
| GET/POST | /api/banks | admin | Manage banks |
| GET/POST | /api/lawyers | admin | Manage lawyers |
| GET/POST | /api/agencies | super_admin | Manage agencies |
| GET/POST | /api/campaigns | admin | Marketing campaigns |
| GET/POST | /api/resources | admin | Educational resources |
| POST | /api/generate-pdf | agent | Generate PDF from calc/case |
| POST | /api/inspect-pdf | agent | Parse uploaded PDF |

---

## 9. Multi-Agency

- `agencies` table with `slug`, `code_prefix`, `custom_domain`
- Middleware resolves agency from hostname
- All core tables have `agency_id` FK
- RLS uses `my_agency_id()` to scope data
- Commission tier config is **per agency**
- Case codes are **per agency** with agency-specific prefix

---

## 10. Pages

### Agent Portal
- `/agent/dashboard` — stats overview
- `/agent/cases` — case list
- `/agent/cases/new` — create case (dynamic bank form)
- `/agent/cases/[id]` — case detail + timeline
- `/agent/calculations` — calculator list
- `/agent/calculations/new` — run new calculation (5-step wizard)
- `/agent/commissions` — commission tracking
- `/agent/network` — org tree view
- `/agent/profile` — profile + bank details
- `/agent/resources` — educational materials
- `/agent/campaigns` — marketing campaigns

### Admin Portal
- `/admin/dashboard` — system stats
- `/admin/cases` — all cases
- `/admin/cases/[id]` — case detail + commission finalization
- `/admin/agents` — agent management
- `/admin/commissions` — commission management + payment
- `/admin/agencies` — agency management (super_admin only)
- `/admin/reports` — analytics
- `/admin/settings` — system settings
- `/admin/website` — CMS
- `/admin/resources` — resources management

### Public
- `/` — home/landing
- `/login` — login
- `/calculate` — public calculator
- `/onboarding/change-password` — forced password change
- `/onboarding/agreement` — terms agreement
