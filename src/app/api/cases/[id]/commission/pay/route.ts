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
 * POST /api/cases/[id]/commission/pay
 *
 * Step 2 of 2-step commission flow: Mark payment as sent.
 * Advances commission status: calculated → payment_pending.
 *
 * Input: { payment_reference, paid_amount, notes? }
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
    const { payment_reference, paid_amount, notes = '' } = body

    if (!payment_reference) {
      return NextResponse.json({ error: 'payment_reference is required' }, { status: 400 })
    }

    // ── Fetch commissions for this case ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: comms, error: commErr }: { data: any; error: any } = await supabase
      .from('commissions')
      .select('id, status')
      .eq('case_id', id)

    if (commErr || !comms || comms.length === 0) {
      return NextResponse.json({ error: 'No commission found for this case. Finalize first.' }, { status: 404 })
    }

    // Validate current status
    const notCalculated = comms.some((c: { status: string }) => c.status !== 'calculated')
    if (notCalculated) {
      return NextResponse.json(
        { error: 'Commission is not in calculated status. Cannot mark as payment_pending.' },
        { status: 409 }
      )
    }

    // ── Update all commissions for this case ──
    const commIds = comms.map((c: { id: string }) => c.id)
    await supabase
      .from('commissions')
      .update({
        status: 'payment_pending',
        payment_reference,
        paid_amount: paid_amount ?? null,
        commission_notes: notes || null,
      })
      .in('id', commIds)

    // ── Notify agent ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: caseData }: { data: any } = await supabase
      .from('cases')
      .select('agent_id, case_code')
      .eq('id', id)
      .single()

    if (caseData) {
      await supabase.from('notifications').insert({
        user_id: caseData.agent_id,
        case_id: id,
        title: 'Commission Payment Sent',
        message: `Case ${caseData.case_code}: Commission payment sent. Reference: ${payment_reference}`,
      })
    }

    return NextResponse.json({
      success: true,
      status: 'payment_pending',
      payment_reference,
      next_step: 'POST /api/cases/{id}/commission/confirm when payment is received',
    })

  } catch (err) {
    console.error('Commission Pay Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
