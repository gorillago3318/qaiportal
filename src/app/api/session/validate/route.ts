import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'

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

/**
 * POST /api/session/validate
 * Returns 200 if nonce matches the stored nonce, 409 if another session replaced it.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nonce } = await request.json()
    if (!nonce || typeof nonce !== 'string') {
      return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 })
    }

    const admin = getAdminClient() as any
    const { data: profile } = await admin
      .from('profiles')
      .select('active_session_nonce')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.active_session_nonce !== nonce) {
      // Another session has taken over
      return NextResponse.json({ valid: false, reason: 'session_replaced' }, { status: 409 })
    }

    return NextResponse.json({ valid: true })
  } catch (err) {
    console.error('[session/validate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
