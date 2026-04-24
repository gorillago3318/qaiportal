import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

// GET /api/clients/lookup?ic=XXXXXX
// Returns the normalized client profile for IC (if caller has access via RLS).
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const ic = (url.searchParams.get('ic') || '').trim()
    if (!ic) return NextResponse.json({ data: null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('clients')
      .select('full_name, ic_number, phone, email, date_of_birth, gender, marital_status, address, employer, monthly_income')
      .eq('ic_number', ic)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('GET /api/clients/lookup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
