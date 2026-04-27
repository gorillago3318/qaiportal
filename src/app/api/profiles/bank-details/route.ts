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

/**
 * POST /api/profiles/bank-details
 * Admin-only. Returns bank details for a list of user IDs, bypassing RLS.
 * Body: { user_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { user_ids } = body as { user_ids: string[] }

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const adminClient = getAdminClient()
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, full_name, bank_name, bank_account_number, bank_account_name')
      .in('id', user_ids)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('POST /api/profiles/bank-details error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
