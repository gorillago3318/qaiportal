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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await getCallerProfile(user.id)
    const isAdmin =
      profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const fromFilter = searchParams.get('from')
    const toFilter = searchParams.get('to')

    const adminClient = getAdminClient() as any

    let query = adminClient
      .from('commissions')
      .select(`
        id,
        type,
        gross_amount,
        company_cut,
        discount_amount,
        net_distributable,
        tier_breakdown,
        status,
        paid_amount,
        paid_at,
        created_at,
        case:cases!commissions_case_id_fkey(
          id,
          case_code,
          proposed_loan_amount,
          status,
          bank_form_data,
          lawyer_name_other,
          lawyer_firm_other,
          lawyer_professional_fee,
          client:clients!cases_client_id_fkey(full_name),
          proposed_bank:banks!cases_proposed_bank_id_fkey(name),
          lawyer:lawyers!cases_lawyer_id_fkey(name, firm),
          agency:agencies!cases_agency_id_fkey(name)
        )
      `)
      .order('created_at', { ascending: false })

    if (statusFilter) query = query.eq('status', statusFilter)
    if (fromFilter) query = query.gte('created_at', fromFilter)
    if (toFilter) query = query.lte('created_at', toFilter)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] = data || []

    // Scope to admin's own agency unless super_admin
    if (profile?.role !== 'super_admin' && profile?.agency_id) {
      rows = rows.filter((row: any) => {
        const caseData = row.case as { agency_id?: string } | null
        return caseData?.agency_id === profile.agency_id
      })
    }

    // Transform rows into the detailed report shape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed = rows.map((row: any) => {
      const breakdown = row.tier_breakdown ?? {}

      const tiers: Record<string, { name: string; amount: number }> = {
        agent: { name: '—', amount: 0 },
        senior_agent: { name: '—', amount: 0 },
        unit_manager: { name: '—', amount: 0 },
        agency_manager: { name: '—', amount: 0 },
        platform_fee: { name: '—', amount: 0 },
      }

      Object.values(breakdown).forEach((e: any) => {
        if (e.is_platform_fee) {
          tiers.platform_fee = { name: e.name, amount: e.amount }
        } else if (tiers[e.role] !== undefined) {
          tiers[e.role] = { name: e.name, amount: e.amount }
        }
      })

      const clientName: string | null =
        row.case?.client?.full_name ??
        row.case?.bank_form_data?.client_name ??
        null

      const specialDiscount: number | null =
        typeof row.case?.bank_form_data?.special_arrangement_discount === 'number'
          ? row.case.bank_form_data.special_arrangement_discount
          : null

      return {
        id: row.id,
        type: row.type,
        status: row.status,
        paid_at: row.paid_at,
        created_at: row.created_at,
        case_code: row.case?.case_code ?? null,
        agency_name: row.case?.agency?.name ?? null,
        client_name: clientName,
        loan_amount: row.case?.proposed_loan_amount ?? null,
        bank_name: row.case?.proposed_bank?.name ?? null,
        lawyer_name:
          row.case?.lawyer?.name ?? row.case?.lawyer_name_other ?? null,
        lawyer_firm:
          row.case?.lawyer?.firm ?? row.case?.lawyer_firm_other ?? null,
        professional_fee: row.case?.lawyer_professional_fee ?? null,
        special_discount: specialDiscount,
        gross_amount: row.gross_amount,
        company_cut: row.company_cut,
        net_distributable: row.net_distributable,
        bank_admin_fee: row.type === 'bank' ? 50 : 0,
        panel_admin_fee: row.type === 'lawyer' ? 200 : 0,
        tiers: {
          agent: tiers.agent,
          senior_agent: tiers.senior_agent,
          unit_manager: tiers.unit_manager,
          agency_manager: tiers.agency_manager,
          platform_fee: tiers.platform_fee,
        },
      }
    })

    return NextResponse.json({ data: transformed })
  } catch (err) {
    console.error('GET /api/reports/commissions error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
