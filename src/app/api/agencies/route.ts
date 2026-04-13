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

const DEFAULT_TIERS = [
  { tier: 'agency_manager', percentage: 92.5 },
  { tier: 'unit_manager', percentage: 87.5 },
  { tier: 'senior_agent', percentage: 80 },
  { tier: 'agent', percentage: 70 },
  { tier: 'admin', percentage: 10 },
  { tier: 'super_admin', percentage: 10 },
]

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerProfile = await getCallerProfile(user.id)
    if (callerProfile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 })
    }

    const admin = getAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agencies, error } = await (admin as any)
      .from('agencies')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich with counts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = await Promise.all((agencies || []).map(async (agency: any) => {
      const [agentRes, caseRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any).from('profiles').select('id', { count: 'exact', head: true }).eq('agency_id', agency.id).not('role', 'in', '("super_admin","admin")'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (admin as any).from('cases').select('id', { count: 'exact', head: true }).eq('agency_id', agency.id),
      ])
      return {
        ...agency,
        agent_count: agentRes.count || 0,
        case_count: caseRes.count || 0,
      }
    }))

    return NextResponse.json({ data: enriched })
  } catch (err) {
    console.error('GET /api/agencies error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerProfile = await getCallerProfile(user.id)
    if (callerProfile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, code_prefix, primary_color, accent_color, custom_domain } = body

    if (!name || !slug || !code_prefix) {
      return NextResponse.json({ error: 'name, slug, and code_prefix are required' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Create agency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newAgency, error: agencyError } = await (admin as any)
      .from('agencies')
      .insert({
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        code_prefix: code_prefix.toUpperCase(),
        primary_color: primary_color || '#0A1628',
        accent_color: accent_color || '#C9A84C',
        custom_domain: custom_domain || null,
      })
      .select()
      .single()

    if (agencyError || !newAgency) {
      return NextResponse.json({ error: agencyError?.message || 'Failed to create agency' }, { status: 500 })
    }

    // Seed commission tiers for the new agency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('commission_tier_config').insert(
      DEFAULT_TIERS.map((t) => ({ ...t, agency_id: newAgency.id }))
    )

    return NextResponse.json({ data: newAgency }, { status: 201 })
  } catch (err) {
    console.error('POST /api/agencies error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
