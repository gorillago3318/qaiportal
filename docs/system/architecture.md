# System Architecture

> Version: 1.0 | Date: 2026-04-13

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | Server components, API routes in `src/app/api/` |
| Database | Supabase (PostgreSQL) | RLS enabled on all tables |
| Auth | Supabase Auth | Email + password. Session managed via cookies |
| Styling | Tailwind CSS v4 + Radix UI | No component library re-exports (Shadcn primitives only) |
| State | React hooks only | No Redux, no Zustand |
| PDF | @react-pdf/renderer | Server-side generation |

---

## Directory Structure (Intended)

```
src/
├── app/
│   ├── admin/          # Admin portal pages (role-gated at page level)
│   ├── agent/          # Agent portal pages
│   ├── api/            # API routes (all auth-checked server-side)
│   ├── calculate/      # Public calculator (no auth)
│   ├── login/
│   └── onboarding/     # change-password, agreement
├── components/
│   ├── ui/             # Low-level primitives (button, card, input, etc.)
│   └── shared/         # Domain-aware reusable components
├── config/
│   └── bank-forms/     # Bank-specific submission form configs
├── lib/
│   ├── calculations/loan.ts    # Core financial engine (NEVER change formulas without updating constitution)
│   ├── supabase/
│   │   ├── client.ts   # Browser Supabase client
│   │   ├── server.ts   # Server Supabase client (RLS-scoped)
│   │   └── admin.ts    # Service role client (bypasses RLS — use carefully)
│   ├── agency.ts       # Agency slug resolver
│   └── utils.ts        # formatCurrency, formatDate, cn, etc.
├── types/
│   └── database.ts     # AUTHORITATIVE TypeScript types for all DB tables
└── middleware.ts        # Session refresh + agency slug header
```

```
docs/                   # SOURCE OF TRUTH — read this before touching code
├── core/constitution.md
├── system/architecture.md
├── api/contracts.md
└── decisions/log.md

supabase/
└── migrations/         # SQL migrations in order. Never modify applied migrations.
```

---

## Auth Flow

```
1. Browser → POST /login (Supabase email+password)
2. Supabase sets session cookie
3. middleware.ts runs on every request:
   a. Refresh session cookie
   b. Redirect unauthenticated → /login (for /agent, /admin, /onboarding)
   c. Resolve agency slug from hostname → x-agency-slug header
4. Layout server components check must_change_password + agreement_signed_at
   → Redirect to /onboarding/* if incomplete
5. API routes: call getCallerProfile(user.id) using admin client (service role)
   to bypass RLS for caller identification
6. Data queries: use regular (anon) Supabase client → RLS scopes by agency automatically
```

---

## Multi-Agency Resolution

```
Hostname                  → Agency Slug Resolved
localhost / 127.0.0.1    → 'qai' (QuantifyAI default)
xxx.quantifyai.me        → 'xxx' (subdomain = slug)
custom-domain.com        → resolve by custom_domain field in agencies table
```

---

## Supabase Client Usage Rules

| Client | When to use | Key behaviour |
|---|---|---|
| `createClient()` (client.ts) | Browser components only | User-scoped, RLS enforced |
| `createServerClient()` (server.ts) | Server components, layouts | User-scoped, RLS enforced |
| `getAdminClient()` (admin.ts) | API routes — caller identity check only | Service role, bypasses ALL RLS |

**Rule:** Use `getAdminClient()` ONLY to fetch the caller's own profile. All data queries must use the regular session client so RLS applies.

---

## Commission Engine Architecture

```
/api/cases/[id]/commission (POST)   ← Admin finalizes
  │
  ├── Validate: bank_gross > 0, caller is admin
  ├── Fetch case (agency_id, agent_id, lawyer_id)
  ├── Check panel lawyer (query lawyers WHERE id=lawyer_id AND is_panel=true)
  ├── Load tier config (filter by case.agency_id)
  ├── Check co_broke (query case_co_broke WHERE case_id=id)
  │
  ├── BANK COMMISSION:
  │   ├── Net = bank_gross − 50 − [200 if panel] − admin_override
  │   ├── IF co_broke:
  │   │     referrerAmount = Net × referrer_share%
  │   │     doerPool = Net × doer_share%
  │   │     tierBreakdown(doer_agent_id, doerPool, configMap)
  │   └── IF no co_broke:
  │         tierBreakdown(case.agent_id, Net, configMap)
  │
  ├── LAWYER COMMISSION (only if is_panel = true):
  │   ├── qaiShare = professional_fee × 70%
  │   ├── companyCut = qaiShare × 10%
  │   ├── Net = qaiShare - companyCut
  │   └── Same co_broke split logic as bank
  │
  ├── INSERT commissions (status = 'calculated')
  ├── UPDATE case status → payment_pending
  └── NOTIFY agent

/api/cases/[id]/commission/pay (POST)  ← NEW — Admin marks payment sent
  └── UPDATE commissions status → 'payment_pending'

/api/cases/[id]/commission/confirm (POST)  ← NEW — Admin confirms payment received
  └── UPDATE commissions status → 'paid'
     UPDATE case status → 'paid'
     NOTIFY agent
```

---

## Key Data Flow: Case Submission

```
Agent fills case form (/agent/cases/new)
  → POST /api/cases
    → Create/upsert client by IC number
    → Insert case with agency_id from callerProfile
    → Upsert co-borrowers (max 1)
    → Return case ID

Case appears in admin list (/admin/cases)
Admin reviews, changes status through workflow
Admin finalizes commission → commission flow above
```

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=         (from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_ANON_KEY=    (from Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY=        (from Supabase dashboard — NEVER expose to browser)
```
