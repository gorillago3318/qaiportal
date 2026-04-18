import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCallerProfile } from '@/lib/supabase/admin'

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

// ─── GET /api/calculations/[id] ───────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    const { data, error } = await supabase
      .from('calculations')
      .select(`
        *,
        proposed_bank:proposed_bank_id (id, name, commission_rate)
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 })
    }

    // Agents can only access their own calculations
    if (!isAdmin && data.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/calculations/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/calculations/[id] ────────────────────────────

const ALLOWED_UPDATE_FIELDS = [
  'client_name',
  'client_ic',
  'client_phone',
  'client_dob',
  'current_bank',
  'current_loan_amount',
  'current_interest_rate',
  'current_monthly_instalment',
  'current_tenure_months',
  'proposed_bank_id',
  'proposed_loan_amount',
  'proposed_interest_rate',
  'proposed_tenure_months',
  'has_cash_out',
  'cash_out_amount',
  'cash_out_tenure_months',
  'finance_legal_fees',
  'legal_fee_amount',
  'valuation_fee_amount',
  'stamp_duty_amount',
  'referral_code',
  'results',
  'report_url',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch existing record to verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('calculations')
      .select('id, agent_id')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin && existing.agent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Only allow updating safe fields — strip anything else
    const updates: Record<string, unknown> = {}
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('calculations')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        proposed_bank:proposed_bank_id (id, name, commission_rate)
      `)
      .single()

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message ?? 'Update failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[PATCH /api/calculations/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
