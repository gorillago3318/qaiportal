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
        setAll: (c) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  )
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')

    // Use admin client so RLS doesn't block listing agency members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (adminClient as any)
      .from('profiles')
      .select('id, email, full_name, phone, role, agent_code, upline_id, is_active, agency_id, created_at')
      .not('role', 'eq', 'super_admin')
      .order('created_at', { ascending: false })

    if (profile.role !== 'super_admin') {
      query = query.eq('agency_id', profile.agency_id)
    }

    if (role) {
      query = query.eq('role', role)
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,agent_code.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('GET /api/agents error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any)
      .from('profiles')
      .select('role, agency_id')
      .eq('id', user.id)
      .single()

    const isAdmin =
      profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id: userId, full_name, email, phone, role: agentRole, upline_id } = body

    if (!userId || !full_name || !email || !agentRole) {
      return NextResponse.json(
        { error: 'id, full_name, email, and role are required' },
        { status: 400 }
      )
    }

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name,
        email,
        phone: phone || null,
        role: agentRole,
        upline_id: upline_id || null,
        agency_id: profile.agency_id, // Lock agent to the creator's agency
        is_active: true,
      })
      .select()
      .single()

    if (insertError || !newProfile) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: newProfile }, { status: 201 })
  } catch (err) {
    console.error('POST /api/agents error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
