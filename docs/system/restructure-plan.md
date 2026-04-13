# File Restructuring Plan

> Date: 2026-04-13  
> Status: APPROVED — implements DEC-021 and DEC-022

---

## What We Are Creating (New Files)

```
src/
├── constants/
│   └── business.ts          ← ALL business constants in one place
└── lib/
    └── commission/
        └── engine.ts        ← Commission calculation logic (shared by both commission routes)
```

---

## What We Are Fixing (Existing Files)

| File | What Changes |
|---|---|
| `src/types/database.ts` | Add agency_id to all tables; add new case statuses; fix missing fields |
| `src/app/api/cases/[id]/commission/route.ts` | Use engine.ts; fix co-broke; fix panel lawyer; 2-step flow |
| `src/app/api/cases/[id]/commission/preview/route.ts` | Use engine.ts; fix panel lawyer detection |
| `src/app/api/cases/[id]/commission/pay/route.ts` | NEW — mark payment sent |
| `src/app/api/cases/[id]/commission/confirm/route.ts` | NEW — confirm payment received |
| `supabase/migrations/` | New migration to: seed LWZ/Y&R lawyers, fix tier config, add commission status columns |

---

## What We Are NOT Touching (Stable, Keep As-Is)

| File | Reason |
|---|---|
| `src/lib/calculations/loan.ts` | Core engine, correct, well-tested |
| `src/lib/agency.ts` | Works correctly |
| `src/lib/supabase/` | Works correctly |
| `src/lib/utils.ts` | Works correctly |
| `src/config/bank-forms/` | User actively built these, functional |
| `src/components/dynamic-bank-form.tsx` | User actively built, functional |
| `src/components/case-print-view.tsx` | User actively built, functional |
| `src/components/co-borrower-manager.tsx` | User actively built, functional |
| `src/components/shared/` | Reusable, working |
| `src/components/ui/` | Primitive components, working |
| `src/app/agent/cases/new/page.tsx` | User actively working on this |
| `src/app/agent/calculations/new/page.tsx` | Partially fixed, ongoing |
| All admin pages | Working, no urgent issues |
| `Forms/` folder | Bank form PDFs for calibration |

---

## What We Are Deleting

| File | Reason |
|---|---|
| `FIX_AGENCY_ID_DEFAULTS.sql` (root) | Temp fix file — should not be at root. Apply it or delete it. |
| Duplicate constants in commission routes | Replaced by `src/constants/business.ts` |
| Duplicate `buildTierBreakdown` in preview route | Replaced by `src/lib/commission/engine.ts` |

---

## Large Files — Plan (Do Not Rewrite Now)

These files are large but functional. Split them into step components **after** the commission fix is stable:

| File | Lines | Plan |
|---|---|---|
| `src/app/agent/calculations/new/page.tsx` | 1888 | Split into step files when UX fixes are complete |
| `src/app/agent/cases/new/page.tsx` | 1661 | Split into step files when user confirms form is final |

---

## Priority Order for Implementation

1. **Create `src/constants/business.ts`** — foundational, everything else imports from it
2. **Create `src/lib/commission/engine.ts`** — fix co-broke + super_admin 7.5% + panel lawyer
3. **Update `src/types/database.ts`** — fix all missing fields
4. **Rewrite commission routes** — use engine, implement 2-step flow
5. **New migration** — seed panel lawyers, fix tier config, add needed DB fields
6. **Fix `next.config.ts`** — remove `ignoreBuildErrors`
