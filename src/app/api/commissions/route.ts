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

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('commissions')
      .select(`
        id,
        case_id,
        type,
        gross_amount,
        company_cut,
        discount_amount,
        net_distributable,
        tier_breakdown,
        status,
        paid_amount,
        paid_at,
        payment_reference,
        created_at,
        updated_at,
        case:cases!commissions_case_id_fkey(
          id,
          case_code,
          loan_type,
          agent_id,
          agent:profiles!cases_agent_id_fkey(id, full_name, agent_code)
        )
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For agents, filter to only their cases
    let result = data || []
    if (!isAdmin) {
      result = result.filter((commission) => {
        const caseData = commission.case as { agent_id?: string } | null
        return caseData?.agent_id === user.id
      })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('GET /api/commissions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const commissionId = searchParams.get('id')
    if (!commissionId) {
      return NextResponse.json({ error: 'Commission ID required' }, { status: 400 })
    }

    const body = await request.json()
    const { status, paid_amount, payment_reference, paid_at } = body

    const { data: updated, error: updateError } = await supabase
      .from('commissions')
      .update({
        status,
        paid_amount: paid_amount ? Number(paid_amount) : undefined,
        payment_reference: payment_reference || null,
        paid_at: paid_at || null,
      })
      .eq('id', commissionId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('PATCH /api/commissions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
