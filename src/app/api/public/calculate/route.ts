import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin'

const FALLBACK_AGENT_CODE = 'QAI0001'

export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient()
    const body = await request.json()

    const {
      referral_code,
      client_name,
      client_ic,
      client_phone,
      client_dob,
      loan_type,
      current_bank,
      current_loan_amount,
      current_interest_rate,
      current_monthly_instalment,
      current_tenure_months,
      proposed_bank_id,
      proposed_loan_amount,
      proposed_interest_rate,
      proposed_tenure_months,
      results,
    } = body

    if (!client_name || !loan_type) {
      return NextResponse.json({ error: 'client_name and loan_type are required' }, { status: 400 })
    }

    // Resolve agent from referral code (or fallback)
    const code = referral_code?.trim() || FALLBACK_AGENT_CODE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: agentProfile } = await (adminClient as any)
      .from('profiles')
      .select('id, full_name, agent_code, agency_id')
      .eq('agent_code', code)
      .eq('is_active', true)
      .single()

    // If still no match, find QAI0001
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvedAgent: any = agentProfile
    if (!resolvedAgent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fallback } = await (adminClient as any)
        .from('profiles')
        .select('id, full_name, agent_code, agency_id')
        .eq('agent_code', FALLBACK_AGENT_CODE)
        .single()
      resolvedAgent = fallback
    }

    if (!resolvedAgent) {
      return NextResponse.json({ error: 'No agent found for attribution' }, { status: 500 })
    }

    // Save calculation attributed to resolved agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: calc, error: calcError } = await (adminClient as any)
      .from('calculations')
      .insert({
        agent_id: resolvedAgent.id,
        agency_id: resolvedAgent.agency_id,
        client_name,
        client_ic: client_ic || null,
        client_phone: client_phone || null,
        client_dob: client_dob || null,
        loan_type,
        current_bank: current_bank || null,
        current_loan_amount: current_loan_amount || null,
        current_interest_rate: current_interest_rate || null,
        current_monthly_instalment: current_monthly_instalment || null,
        current_tenure_months: current_tenure_months || null,
        proposed_bank_id: proposed_bank_id || null,
        proposed_loan_amount: proposed_loan_amount || null,
        proposed_interest_rate: proposed_interest_rate || null,
        proposed_tenure_months: proposed_tenure_months || null,
        finance_legal_fees: false,
        has_cash_out: false,
        referral_code: code,
        results: results || null,
      })
      .select('id')
      .single()

    if (calcError) {
      return NextResponse.json({ error: calcError.message }, { status: 500 })
    }

    // Notify the attributed agent
    await (adminClient as any)
      .from('notifications')
      .insert({
        user_id: resolvedAgent.id,
        title: '📊 New Public Calculation',
        message: `${client_name} completed a refinance calculation via your referral link. Ref: ${code}`,
      })

    return NextResponse.json({
      success: true,
      calculation_id: calc.id,
      attributed_to: {
        agent_code: resolvedAgent.agent_code,
        full_name: resolvedAgent.full_name,
      },
    })
  } catch (err) {
    console.error('POST /api/public/calculate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
