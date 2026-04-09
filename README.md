# QuantifyAI Portal

Malaysia's premier mortgage refinance agency management portal — built for agents, administrators, and back-office operations.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (customised)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **UI Libraries:** Framer Motion, Recharts, Lucide Icons
- **Forms:** react-hook-form + Zod
- **PDF:** @react-pdf/renderer
- **Fonts:** DM Sans (body) + Playfair Display (headings) via Google Fonts

## Prerequisites

- Node.js 18.17+
- npm or pnpm
- A Supabase project (already configured)
- Git

## Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://cttiriuwngdzelhrncjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

## Supabase Setup

### 1. Run the SQL migration

In Supabase dashboard → SQL Editor, paste and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, enums, indexes, RLS policies, triggers, and seeds banks + commission tiers.

### 2. Create the admin user

1. Go to Supabase Dashboard → Authentication → Users
2. Click **Add User**, set email `admin@quantifyai.me` and a secure password
3. Copy the UUID of the created user
4. In SQL Editor, run:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES ('<user-uuid>', 'admin@quantifyai.me', 'QuantifyAI Admin', 'super_admin');
```

### 3. Create Storage Buckets

In Supabase Dashboard → Storage, create:

| Bucket name      | Public? | Description                    |
|------------------|---------|--------------------------------|
| `case-documents` | No      | Uploaded case documents        |
| `reports`        | Yes     | Generated PDF proposal reports |
| `avatars`        | Yes     | Agent profile pictures         |

## Project Structure

```
src/
├── app/
│   ├── (public)/          # Public-facing pages
│   ├── (auth)/login/      # Login page
│   ├── (agent)/           # Agent portal (authenticated)
│   │   ├── dashboard/
│   │   ├── calculations/
│   │   ├── cases/
│   │   └── commissions/
│   ├── (admin)/           # Admin portal (authenticated, admin-only)
│   │   ├── dashboard/
│   │   ├── cases/
│   │   ├── agents/
│   │   ├── commissions/
│   │   └── settings/
│   └── api/               # API routes
├── components/
│   ├── ui/                # Design-system components
│   ├── agent/             # Agent-specific components
│   ├── admin/             # Admin-specific components
│   └── shared/            # Shared components
├── lib/
│   ├── supabase/          # Supabase client helpers
│   ├── calculations/      # Loan calculation engine
│   └── utils.ts           # Utility functions
├── types/
│   └── database.ts        # Full TypeScript types for DB schema
└── middleware.ts           # Route protection
```

## Key Features

### Calculation Engine (`src/lib/calculations/loan.ts`)

- Standard amortization monthly instalment
- Refinance savings analysis
- Bi-weekly payment acceleration
- Tenure saved calculation
- Malaysian legal fee scale (Solicitors' Remuneration Order 2017)
- Malaysian valuation fee scale
- Stamp duty (0.5% of loan)
- Cash-out analysis
- Snowball extra payment simulation
- Bank commission and tier breakdown
- Co-broke split (30% referrer / 70% doer)

### Commission Structure

- Company takes 10% off gross bank commission
- Remaining is distributed per tier percentage:
  - Agency Manager: 92.5%
  - Unit Manager: 87.5%
  - Senior Agent: 80%
  - Agent: 70%
- Lawyer commissions: flat referral fee per case type (LA/SPA/MOT)
- Co-broke: each party runs their own upline chain independently

### Case Workflow

`Draft → Submitted → Bank Processing → KIV → Approved/Declined → Accepted/Rejected → Payment Pending → Paid`

## Deployment to Vercel

1. Push to GitHub (`gorillago3318/qaiportal`)
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local`
4. Deploy — Vercel auto-detects Next.js

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

## Design System

| Token         | Value     |
|---------------|-----------|
| Primary       | `#0A1628` |
| Accent / Gold | `#C9A84C` |
| Background    | `#F8F9FA` |
| Surface       | `#FFFFFF` |
| Border        | `#E5E7EB` |
| Text Muted    | `#6B7280` |
| Success       | `#10B981` |
| Warning       | `#F59E0B` |
| Error         | `#EF4444` |

---

&copy; 2025 QuantifyAI Sdn Bhd
