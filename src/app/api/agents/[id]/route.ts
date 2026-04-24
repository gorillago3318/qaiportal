import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'

function getSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = getSupabase(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const caller = await getCallerProfile(user.id)
  if (!caller || (caller.role !== 'admin' && caller.role !== 'super_admin')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, caller }
}

// GET /api/agents/[id] — full profile + recent cases, using service role so RLS doesn't block admin
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { caller } = gate

    const { id } = await params
    const adminClient = getAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: pErr } = await (adminClient as any)
      .from('profiles')
      .select('*, upline:profiles!upline_id(full_name, role, agent_code)')
      .eq('id', id)
      .maybeSingle()

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!profile) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    // Scope: non-super-admin can only view agents in their own agency
    if (caller!.role !== 'super_admin' && profile.agency_id !== caller!.agency_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Recent cases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cases } = await (adminClient as any)
      .from('cases')
      .select('id, case_code, status, loan_type, proposed_loan_amount, created_at, client:clients(full_name)')
      .eq('agent_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ profile, cases: cases || [] })
  } catch (err) {
    console.error('GET /api/agents/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/agents/[id] — update role / is_active / upline / bank / nric
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error
    const { caller } = gate

    const { id } = await params
    const body = await request.json()

    const allowed = [
      'role', 'is_active', 'upline_id', 'phone', 'full_name',
      'bank_name', 'bank_account_number', 'bank_account_name',
      'nric_number',
    ] as const
    const update: Record<string, unknown> = {}
    for (const key of allowed) if (key in body) update[key] = body[key]

    const adminClient = getAdminClient()

    // Enforce agency scope
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (adminClient as any)
      .from('profiles').select('agency_id').eq('id', id).maybeSingle()
    if (!target) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    if (caller!.role !== 'super_admin' && target.agency_id !== caller!.agency_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (adminClient as any)
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select('*, upline:profiles!upline_id(full_name, role, agent_code)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ profile: updated })
  } catch (err) {
    console.error('PATCH /api/agents/[id] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
