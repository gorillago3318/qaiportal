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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const caller = await getCallerProfile(user.id)
    if (!caller || (caller.role !== 'admin' && caller.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { agent_id, new_password } = body as { agent_id?: string; new_password?: string }

    if (!agent_id || !new_password || new_password.length < 8) {
      return NextResponse.json(
        { error: 'agent_id and new_password (min 8 chars) are required' },
        { status: 400 }
      )
    }

    const adminClient = getAdminClient()

    // Verify target belongs to same agency (super_admin can reset anyone)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target, error: targetErr } = await (adminClient as any)
      .from('profiles')
      .select('id, agency_id, role, email')
      .eq('id', agent_id)
      .single()

    if (targetErr || !target) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (caller.role !== 'super_admin' && target.agency_id !== caller.agency_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update password via admin API
    const { error: updErr } = await adminClient.auth.admin.updateUserById(agent_id, {
      password: new_password,
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    // Force user to change password on next login
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any)
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', agent_id)

    return NextResponse.json({ success: true, email: target.email })
  } catch (err) {
    console.error('POST /api/admin/reset-agent-password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
