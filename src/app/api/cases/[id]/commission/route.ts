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
 * Step 1 of 2-step commission flow: Calculate and lock commission.
 * Sets commission status → 'calculated', case status → 'payment_pending'.
 *
 * Input: { bank_gross, bank_discount?, professional_fee?, notes? }
 * See: docs/core/constitution.md Part 3 for commission rules.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerProfile = await getCallerProfile(user.id)
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse Input ──
    const body = await request.json()
    const {
      bank_gross,
      bank_discount = 0,
      professional_fee,
      notes = '',
    } = body

    if (!bank_gross || bank_gross <= 0) {
      return NextResponse.json({ error: 'bank_gross must be > 0' }, { status: 400 })
    }

    // ── Fetch Case ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: caseData, error: caseErr }: { data: any; error: any } = await (adminClient as any)
      .from('cases')
      .select('agent_id, agency_id, status, lawyer_id, case_code')
      .eq('id', id)
      .single()

    if (caseErr || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check if commission already calculated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingComm }: { data: any } = await (adminClient as any)
      .from('commissions')
      .select('id, status')
      .eq('case_id', id)
      .limit(1)
      .maybeSingle()

    if (existingComm) {
      return NextResponse.json(
        { error: 'Commission already calculated for this case. Use /pay or /confirm to advance status.' },
        { status: 409 }
      )
    }

    // ── Load Tier Config (agency-scoped) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configs }: { data: any } = await (adminClient as any)
      .from('commission_tier_config')
      .select('tier, percentage')
      .eq('agency_id', caseData.agency_id)

    const configMap: Record<string, number> = {}
    configs?.forEach((c: { tier: string; percentage: number }) => {
      configMap[c.tier] = c.percentage
    })

    // ── Panel Lawyer Check (authoritative) ──
    const panelLawyerConfirmed = await isPanelLawyer(adminClient, caseData.lawyer_id)

    // ── Super Admin ID ──
    const superAdminId = await getSuperAdminId(adminClient)

    // ── Bank Commission ──
    const bankResult = await calculateBankCommission({
      caseId: id,
      caseAgentId: caseData.agent_id,
      agencyId: caseData.agency_id,
      bankGross: bank_gross,
      adminOverride: bank_discount,
      panelLawyerConfirmed,
      notes,
      adminClient,
      configMap,
      superAdminId,
    })

    // ── Lawyer Commission (panel only, if fee provided) ──
    let lawyerResult = null
    if (panelLawyerConfirmed && professional_fee && professional_fee > 0) {
      lawyerResult = await calculateLawyerCommission({
        caseId: id,
        caseAgentId: caseData.agent_id,
        professionalFee: professional_fee,
        notes,
        adminClient,
        configMap,
        superAdminId,
      })
    }

    // ── Insert Bank Commission (status: calculated) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bankCommData, error: bankErr }: { data: any; error: any } = await supabase
      .from('commissions')
      .insert({
        type: 'bank',
        case_id: id,
        gross_amount: bankResult.gross,
        discount_amount: bankResult.flatDeduction + bankResult.panelDeduction + bankResult.adminOverride,
        net_distributable: bankResult.netDistributable,
        company_cut: bankResult.tierBreakdown.breakdown[superAdminId ?? '']?.amount ?? 0,
        tier_breakdown: {
          ...bankResult.tierBreakdown.breakdown,
          _co_broke: bankResult.coBroke.hasCoBroke ? {
            referrer_agent_id: bankResult.coBroke.referrerAgentId,
            referrer_amount: bankResult.coBroke.referrerAmount,
            doer_agent_id: bankResult.coBroke.doerAgentId,
            doer_pool: bankResult.coBroke.doerPool,
          } : null,
        },
        commission_notes: bankResult.notes,
        status: 'calculated',
      })
      .select()
      .single()

    if (bankErr) {
      return NextResponse.json({ error: `Bank commission insert failed: ${bankErr.message}` }, { status: 500 })
    }

    // ── Insert Lawyer Commission ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lawyerCommData: any = null
    if (lawyerResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: lwErr }: { data: any; error: any } = await supabase
        .from('commissions')
        .insert({
          type: 'lawyer',
          case_id: id,
          gross_amount: lawyerResult.gross,
          discount_amount: lawyerResult.companyCut,
          net_distributable: lawyerResult.netDistributable,
          company_cut: lawyerResult.tierBreakdown.breakdown[superAdminId ?? '']?.amount ?? 0,
          tier_breakdown: {
            ...lawyerResult.tierBreakdown.breakdown,
            _co_broke: lawyerResult.coBroke.hasCoBroke ? {
              referrer_agent_id: lawyerResult.coBroke.referrerAgentId,
              referrer_amount: lawyerResult.coBroke.referrerAmount,
              doer_agent_id: lawyerResult.coBroke.doerAgentId,
              doer_pool: lawyerResult.coBroke.doerPool,
            } : null,
          },
          commission_notes: lawyerResult.notes,
          status: 'calculated',
        })
        .select()
        .single()

      if (lwErr) console.error('Lawyer commission insert error:', lwErr)
      else lawyerCommData = data
    }

    // ── Advance Case to payment_pending (Step 1 of 2-step flow) ──
    await supabase.from('cases').update({ status: 'payment_pending' }).eq('id', id)
    await supabase.from('case_status_history').insert({
      case_id: id,
      from_status: caseData.status,
      to_status: 'payment_pending',
      changed_by: user.id,
      notes: 'Commission calculated. Awaiting payment.',
    })

    // ── Notify Agent ──
    const agentBankAmount = bankResult.tierBreakdown.breakdown[caseData.agent_id]?.amount ?? 0
    const agentLawyerAmount = lawyerResult?.tierBreakdown.breakdown[caseData.agent_id]?.amount ?? 0
    const referrerAmount = bankResult.coBroke.referrerAmount

    await supabase.from('notifications').insert({
      user_id: caseData.agent_id,
      case_id: id,
      title: 'Commission Calculated',
      message: `Case ${caseData.case_code}: Bank RM${agentBankAmount.toFixed(2)}${lawyerResult ? ` + Lawyer RM${agentLawyerAmount.toFixed(2)}` : ''}. Payment processing.`,
    })

    if (bankResult.coBroke.hasCoBroke && bankResult.coBroke.referrerAgentId) {
      await supabase.from('notifications').insert({
        user_id: bankResult.coBroke.referrerAgentId,
        case_id: id,
        title: 'Co-Broke Commission Calculated',
        message: `Case ${caseData.case_code}: Your referral commission RM${referrerAmount.toFixed(2)}. Payment processing.`,
      })
    }

    return NextResponse.json({
      bank: bankCommData,
      lawyer: lawyerCommData,
      summary: {
        bank_gross: bank_gross,
        bank_deductions: bankResult.flatDeduction + bankResult.panelDeduction + bankResult.adminOverride,
        bank_net: bankResult.netDistributable,
        lawyer_professional_fee: professional_fee ?? null,
        lawyer_net: lawyerResult?.netDistributable ?? null,
        is_panel_lawyer: panelLawyerConfirmed,
        has_co_broke: bankResult.coBroke.hasCoBroke,
        referrer_amount: bankResult.coBroke.hasCoBroke ? bankResult.coBroke.referrerAmount : null,
        agent_bank_amount: agentBankAmount,
        agent_lawyer_amount: agentLawyerAmount,
        status: 'calculated',
        next_step: 'POST /api/cases/{id}/commission/pay to mark payment sent',
      },
    })

  } catch (err) {
    console.error('Commission Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
