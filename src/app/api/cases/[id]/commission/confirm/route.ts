import { NextResponse, NextRequest } from 'next/server'
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

/**
 * POST /api/cases/[id]/commission/confirm
 *
 * Step 3 of 2-step commission flow: Confirm payment received.
 * Advances commission status: payment_pending → paid.
 * Also advances case status → paid.
 *
 * Input: { notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const callerProfile = await getCallerProfile(user.id)
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { notes = '' } = body

    // ── Fetch commissions ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comms, error: commErr }: { data: any; error: any } = await supabase
      .from('commissions')
      .select('id, status, type, tier_breakdown')
      .eq('case_id', id)

    if (commErr || !comms || comms.length === 0) {
      return NextResponse.json({ error: 'No commission found for this case.' }, { status: 404 })
    }

    const notPending = comms.some((c: { status: string }) => c.status !== 'payment_pending')
    if (notPending) {
      return NextResponse.json(
        { error: 'Commission is not in payment_pending status.' },
        { status: 409 }
      )
    }

    // ── Mark all commissions as paid ──
    const commIds = comms.map((c: { id: string }) => c.id)
    await supabase
      .from('commissions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        commission_notes: notes || null,
      })
      .in('id', commIds)

    // ── Advance case to paid ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: caseData }: { data: any } = await supabase
      .from('cases')
      .select('agent_id, status, case_code')
      .eq('id', id)
      .single()

    if (caseData) {
      await supabase.from('cases').update({ status: 'paid' }).eq('id', id)
      await supabase.from('case_status_history').insert({
        case_id: id,
        from_status: caseData.status,
        to_status: 'paid',
        changed_by: user.id,
        notes: 'Commission payment confirmed received.',
      })

      // Compute agent's total payout across all commission records
      let agentTotal = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comms.forEach((c: any) => {
        const breakdown = c.tier_breakdown || {}
        agentTotal += breakdown[caseData.agent_id]?.amount ?? 0
      })

      await supabase.from('notifications').insert({
        user_id: caseData.agent_id,
        case_id: id,
        title: 'Commission Paid 🎉',
        message: `Case ${caseData.case_code}: Your commission of RM${agentTotal.toFixed(2)} has been paid. Thank you!`,
      })
    }

    return NextResponse.json({
      success: true,
      status: 'paid',
    })

  } catch (err) {
    console.error('Commission Confirm Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
