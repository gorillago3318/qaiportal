import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'
import {
  isPanelLawyer,
  getSuperAdminId,
  calculateBankCommission,
  calculateLawyerCommission,
} from '@/lib/commission/engine'

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
 * POST /api/cases/[id]/commission
 *
 * Advances existing commission rows for this case to the next status:
 *   calculated → payment_pending
 *   payment_pending → paid
 *
 * Body (optional for paid step): { payment_reference?, paid_at? }
 * Admin/super_admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient() as any

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerProfile = await getCallerProfile(user.id)
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { payment_reference, paid_at, type } = body
    // `type`: optional 'bank' | 'lawyer' — advance only that commission type.
    // When omitted, advances all types for the case (original behaviour).

    // ── Fetch commissions for this case (optionally filtered by type) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let commQuery = adminClient
      .from('commissions')
      .select('id, status, net_distributable, type')
      .eq('case_id', id)
    if (type) commQuery = commQuery.eq('type', type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comms, error: commErr }: { data: any; error: any } = await commQuery

    if (commErr) {
      return NextResponse.json({ error: commErr.message }, { status: 500 })
    }

    if (!comms || comms.length === 0) {
      return NextResponse.json(
        { error: 'No commissions found for this case. Ensure the case has been accepted first.' },
        { status: 404 }
      )
    }

    // Determine current status (use the first row — same type rows share the same status)
    const currentStatus: string = comms[0].status

    let nextStatus: string
    if (currentStatus === 'calculated') {
      nextStatus = 'payment_pending'
    } else if (currentStatus === 'payment_pending') {
      nextStatus = 'paid'
    } else if (currentStatus === 'paid') {
      return NextResponse.json({ message: 'Commission already paid', status: 'paid' })
    } else {
      return NextResponse.json({ error: `Cannot advance from status: ${currentStatus}` }, { status: 400 })
    }

    const commIds = comms.map((c: { id: string }) => c.id)
    const paidAt = paid_at || new Date().toISOString()

    // ── Advance each commission row individually (paid_amount = that row's own net_distributable) ──
    for (const comm of comms) {
      const updateData: Record<string, unknown> = { status: nextStatus }
      if (nextStatus === 'paid') {
        updateData.paid_amount = comm.net_distributable || 0
        updateData.paid_at = paidAt
        if (payment_reference) updateData.payment_reference = payment_reference
      }
      const { error: updateErr } = await adminClient
        .from('commissions')
        .update(updateData)
        .eq('id', comm.id)
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    // ── Advance case status — only if ALL commission rows for the case are at or beyond nextStatus ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allComms }: { data: any } = await adminClient
      .from('commissions')
      .select('status')
      .eq('case_id', id)
    const allPaid = allComms?.every((c: { status: string }) => c.status === 'paid')
    const allAtLeastPending = allComms?.every((c: { status: string }) =>
      c.status === 'payment_pending' || c.status === 'paid'
    )

    let caseNextStatus: string | null = null
    if (nextStatus === 'paid' && allPaid) {
      caseNextStatus = 'paid'
    } else if (nextStatus === 'payment_pending' && allAtLeastPending) {
      caseNextStatus = 'payment_pending'
    }

    if (caseNextStatus) {
      await adminClient.from('cases').update({ status: caseNextStatus }).eq('id', id)
      await adminClient.from('case_status_history').insert({
        case_id: id,
        to_status: caseNextStatus,
        notes: caseNextStatus === 'payment_pending'
          ? 'Commission confirmed. Awaiting payment disbursement.'
          : 'Commission paid.',
      })
    }

    // ── Notify agent when fully paid ──
    if (nextStatus === 'paid' && allPaid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: caseRow }: { data: any } = await adminClient
        .from('cases').select('agent_id, case_code').eq('id', id).single()
      if (caseRow) {
        const typeLabel = type ? ` (${type})` : ''
        await adminClient.from('notifications').insert({
          user_id: caseRow.agent_id, case_id: id,
          title: 'Commission Paid',
          message: `Case ${caseRow.case_code}: Your commission${typeLabel} has been disbursed.`,
        })
      }
    }

    return NextResponse.json({ success: true, advanced_to: nextStatus, commission_count: commIds.length, type: type || 'all' })

  } catch (err) {
    console.error('Commission advance error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
