# API Contracts

> Version: 1.0 | Date: 2026-04-13  
> All routes require authenticated session unless marked [PUBLIC]  
> All routes use JSON (Content-Type: application/json) unless noted

---

## AGENTS

### GET /api/agents
List agents within caller's agency.  
**Auth:** admin or super_admin only  
**Response:** `{ agents: Profile[] }`

### POST /api/agents
Create a new agent profile (does not send invite email).  
**Auth:** admin or super_admin only  
**Body:**
```json
{
  "email": "string (required)",
  "full_name": "string (required)",
  "role": "agency_manager | unit_manager | senior_agent | agent",
  "upline_id": "uuid (optional)",
  "phone": "string (optional)"
}
```
**Response:** `{ agent: Profile }`

### POST /api/agents/invite
Create agent + send invitation email with temporary password.  
**Auth:** admin or super_admin only  
**Body:** Same as POST /api/agents  
**Response:** `{ agent: Profile, invited: true }`

---

## CASES

### GET /api/cases
**Auth:** Any authenticated user  
**Behaviour:** Agents see own cases only. Admins see all cases in their agency.  
**Query params:** `status`, `loan_type`, `search`, `page`, `limit`  
**Response:** `{ cases: CaseWithClient[], total: number }`

### POST /api/cases
Create new case.  
**Auth:** Any authenticated user  
**Body:** Full case form data (see case form for field list)  
**Response:** `{ case: Case }`

### GET /api/cases/[id]
**Auth:** Case owner or admin  
**Response:** Full case with client, co_borrowers, comments, documents, status_history, commissions

### PATCH /api/cases/[id]
Update case.  
**Auth:** Agent (draft only), admin (any status)  
**Body:** Partial case fields  
**Response:** `{ case: Case }`

### POST /api/cases/[id]/comments
**Auth:** Case owner or admin  
**Body:** `{ content: string, is_admin: boolean }`  
**Response:** `{ comment: CaseComment }`

---

## COMMISSION

### POST /api/cases/[id]/commission
Finalize commission calculation. Sets status to `calculated`.  
**Auth:** admin or super_admin only  
**Body:**
```json
{
  "bank_gross": "number (required, > 0)",
  "bank_discount": "number (optional, default 0)",
  "professional_fee": "number (optional, only for panel lawyers)",
  "notes": "string (optional)"
}
```
**Response:**
```json
{
  "bank": { commission record },
  "lawyer": { commission record | null },
  "summary": {
    "bank_gross": number,
    "bank_deductions": number,
    "bank_net": number,
    "is_panel_lawyer": boolean,
    "co_broke": { referrer_amount: number, doer_pool: number } | null,
    "agent_total": number
  }
}
```

### GET /api/cases/[id]/commission/preview
Preview commission breakdown before finalizing.  
**Auth:** admin or super_admin only  
**Query params:** `bank_gross`, `bank_discount`, `professional_fee`  
**Response:** Same shape as POST but nothing is saved.

### POST /api/cases/[id]/commission/pay  *(TO BUILD)*
Mark commission payment as sent.  
**Auth:** admin or super_admin only  
**Body:** `{ payment_reference: string, paid_amount: number }`  
**Response:** `{ commission: Commission }`  
**Side effect:** commission.status → payment_pending; case.status → payment_pending

### POST /api/cases/[id]/commission/confirm  *(TO BUILD)*
Confirm payment received.  
**Auth:** admin or super_admin only  
**Body:** `{ notes: string (optional) }`  
**Response:** `{ commission: Commission }`  
**Side effect:** commission.status → paid; case.status → paid; agent notification sent

---

## CALCULATIONS

### POST /api/calculations
Save a calculation run.  
**Auth:** Any authenticated user  
**Body:** Calculation inputs + results JSONB  
**Response:** `{ id, report_token }`

### GET /api/calculations
List calculations for caller.  
**Auth:** Any authenticated user  
**Response:** `{ calculations: Calculation[] }`

### GET /api/calculations/[id]
**Auth:** Owner or admin  
**Response:** `{ calculation: Calculation }`

### POST /api/public/calculate  [PUBLIC]
Run calculation without saving.  
**Auth:** None  
**Body:** Calculation inputs  
**Response:** Calculation results JSONB

---

## BANKS

### GET /api/banks
**Auth:** Any authenticated user  
**Response:** `{ banks: Bank[] }` (active banks for current agency)

### POST /api/banks
**Auth:** admin or super_admin only  
**Body:** `{ name, commission_rate, interest_rate?, is_active }`

---

## LAWYERS

### GET /api/lawyers
**Auth:** Any authenticated user  
**Response:** `{ lawyers: Lawyer[] }` (active panel lawyers first)

### POST /api/lawyers
**Auth:** admin or super_admin only  
**Body:** `{ name, firm, phone, email, la_fee, spa_fee, mot_fee, is_panel, is_active }`

---

## AGENCIES

### GET /api/agencies
**Auth:** super_admin only  
**Response:** `{ agencies: Agency[] }`

### POST /api/agencies
**Auth:** super_admin only  
**Body:** `{ name, slug, code_prefix, custom_domain?, primary_color, accent_color }`

---

## ERROR RESPONSE FORMAT

All errors return:
```json
{
  "error": "Human-readable error message"
}
```

Standard HTTP status codes:
- `400` Bad Request (invalid input)
- `401` Unauthorized (no session)
- `403` Forbidden (wrong role)
- `404` Not Found
- `500` Internal Server Error

---

## AUTH PATTERN (Every API Route Must Follow)

```typescript
// 1. Get session user (anon client — respects RLS)
const { data: { user }, error } = await supabase.auth.getUser()
if (!user) return 401

// 2. Get caller profile (admin client — bypasses RLS for own profile lookup)
const profile = await getCallerProfile(user.id)
if (!profile) return 404

// 3. Role gate if needed
if (profile.role !== 'admin' && profile.role !== 'super_admin') return 403

// 4. All data queries use regular supabase client (RLS scopes by agency)
```
