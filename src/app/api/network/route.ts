import { NextResponse } from 'next/server'
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
        setAll: (c) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Fetch ALL non-super-admin profiles (including inactive) so structural links work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient as any)
      .from('profiles')
      .select(`
        id, full_name, email, role, agent_code, upline_id, is_active,
        cases:cases(count)
      `)
      .not('role', 'in', '(super_admin,admin)')
      .order('role', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch commissions separately (no direct FK from profiles→commissions;
    // link is: commissions.case_id → cases.agent_id → profiles.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: commRows } = await (adminClient as any)
      .from('commissions')
      .select('net_distributable, status, created_at, cases!inner(agent_id)')

    // Build a map: agent_id → commission rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commByAgent: Record<string, { amount: number; created_at: string }[]> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (commRows ?? []) as any[]) {
      if (row.status !== 'paid') continue
      const agentId = row.cases?.agent_id
      if (!agentId) continue
      if (!commByAgent[agentId]) commByAgent[agentId] = []
      commByAgent[agentId].push({ amount: row.net_distributable ?? 0, created_at: row.created_at })
    }

    // Build set of valid (non-admin) IDs
    const agentIds = new Set((data || []).map((p: { id: string }) => p.id))

    // Enrich with commission totals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (data || []).map((p: any) => {
      const rawComms = commByAgent[p.id] ?? []
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: p.role,
        agent_code: p.agent_code,
        // Map to QAI root if: upline_id is null, OR upline_id points to excluded user (admin)
        upline_id: (!p.upline_id || !agentIds.has(p.upline_id)) ? '__QAI_ROOT__' : p.upline_id,
        is_active: p.is_active,
        case_count: p.cases?.[0]?.count ?? 0,
        commission_earned: rawComms.reduce((sum: number, c) => sum + c.amount, 0),
        raw_commissions: rawComms,
      }
    })

    // Inject the QAI root virtual node
    const qaiRoot = {
      id: '__QAI_ROOT__',
      full_name: 'QuantifyAI (QAI)',
      email: 'admin@quantifyai.com',
      role: 'agency_manager' as const, // use valid UserRole for type safety
      agent_code: 'QAI-ROOT',
      upline_id: null,
      is_active: true,
      case_count: enriched.reduce((s: number, n: { case_count: number }) => s + n.case_count, 0),
      commission_earned: 0,
      is_root: true,
    }

    return NextResponse.json({
      data: [qaiRoot, ...enriched],
      current_user_id: user.id,
      current_role: profile.role,
      total_agents: enriched.length,
    })
  } catch (err) {
    console.error('GET /api/network error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
