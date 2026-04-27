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
 * POST /api/session/register
 * Called on layout mount. Stores the current session nonce in profiles.
 * Any other active session with a different nonce will be kicked out on next validate().
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
    await admin.from('profiles').update({ active_session_nonce: nonce }).eq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[session/register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
