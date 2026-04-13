import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'

// ── Deduction Constants ──────────────────────────────────────
const BANK_FLAT_DEDUCTION = 50          // RM50 always from bank commission
const PANEL_LOAN_AGR_DEDUCTION = 200    // RM200 from bank comm if panel lawyer (loan agreement fee)
const LAWYER_QAI_SHARE_PCT = 0.70       // QAI gets 70% of professional fees
const LAWYER_COMPANY_CUT_PCT = 0.10     // QAI keeps 10% company override from lawyer share

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
 * Traverse upline chain and allocate commission using differential percentage model.
 * Each upline level only gets the *incremental* difference vs their downline's tier %.
 */
async function buildTierBreakdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  startAgentId: string,
  netDistributable: number,
  configMap: Record<string, number>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ breakdown: Record<string, any>; companyPct: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, any> = {}
  let currentAgentId: string | null = startAgentId
  let lastPct = 0
  let depth = 0

  while (currentAgentId && depth < 10) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p }: { data: any } = await adminClient
      .from('profiles')
      .select('id, full_name, role, upline_id')
      .eq('id', currentAgentId)
      .single()
    if (!p) break

    const tierPct = configMap[p.role] || 0
    const diff = tierPct - lastPct
    if (diff > 0) {
      breakdown[p.id] = {
        role: p.role,
        name: p.full_name,
        percentage: diff,
        amount: parseFloat(((diff / 100) * netDistributable).toFixed(2)),
      }
      lastPct = tierPct
    }

    currentAgentId = p.upline_id
    depth++
  }

  const companyPct = Math.max(0, 100 - lastPct)
  return { breakdown, companyPct }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminProfile = await getCallerProfile(user.id)
    if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      // Bank commission fields
      bank_gross,          // Raw bank commission (e.g. loan × 0.3%)
      bank_discount = 0,   // Admin manual deduction override
      // Lawyer commission fields
      professional_fee,    // From lawyer quotation (agent-entered)
      // Shared
      notes = '',
    } = body

    // ── Validate ──
    if (!bank_gross || bank_gross <= 0) {
      return NextResponse.json({ error: 'bank_gross must be > 0' }, { status: 400 })
    }

    // ── Get Case ──
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('agent_id, status, lawyer_name_other, case_code')
      .eq('id', id)
      .single()

    if (caseErr || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    const isPanelLawyer = !caseData.lawyer_name_other  // null = panel lawyer

    // ── Load Tier Config ──
    const { data: configs } = await supabase.from('commission_tier_config').select('*')
    const configMap: Record<string, number> = {}
    configs?.forEach((c: { tier: string; percentage: number }) => {
      configMap[c.tier] = c.percentage
    })

    // ════════════════════════════════════════════
    // BANK COMMISSION CALCULATION
    // ════════════════════════════════════════════
    const bankFlat = BANK_FLAT_DEDUCTION
    const bankPanelFee = isPanelLawyer ? PANEL_LOAN_AGR_DEDUCTION : 0
    const bankNetDistributable = Math.max(0, bank_gross - bankFlat - bankPanelFee - bank_discount)

    const bankResult = await buildTierBreakdown(
      adminClient,
      caseData.agent_id,
      bankNetDistributable,
      configMap
    )

    const bankCompanyAmount = parseFloat(
      ((bankResult.companyPct / 100) * bankNetDistributable).toFixed(2)
    )

    // ════════════════════════════════════════════
    // LAWYER COMMISSION CALCULATION (panel only)
    // ════════════════════════════════════════════
    let lawyerCommission = null

    if (isPanelLawyer && professional_fee && professional_fee > 0) {
      const qaiShare = professional_fee * LAWYER_QAI_SHARE_PCT
      const companyCut = qaiShare * LAWYER_COMPANY_CUT_PCT
      const lawyerNetDistributable = Math.max(0, qaiShare - companyCut)

      const lawyerResult = await buildTierBreakdown(
        adminClient,
        caseData.agent_id,
        lawyerNetDistributable,
        configMap
      )

      const lawyerCompanyAmount = parseFloat(
        ((lawyerResult.companyPct / 100) * lawyerNetDistributable).toFixed(2)
      )

      lawyerCommission = {
        type: 'lawyer',
        case_id: id,
        gross_amount: professional_fee,
        discount_amount: companyCut,          // company override acts as "discount"
        net_distributable: lawyerNetDistributable,
        company_cut: lawyerCompanyAmount,
        tier_breakdown: lawyerResult.breakdown,
        commission_notes: `Lawyer professional fee: RM${professional_fee.toFixed(2)}. QAI 70% = RM${qaiShare.toFixed(2)}. Company 10% cut = RM${companyCut.toFixed(2)}. ${notes}`,
        status: 'paid',
      }
    }

    // ── Insert Bank Commission ──
    const bankInsertData = {
      type: 'bank',
      case_id: id,
      gross_amount: bank_gross,
      discount_amount: bankFlat + bankPanelFee + bank_discount,
      net_distributable: bankNetDistributable,
      company_cut: bankCompanyAmount,
      tier_breakdown: bankResult.breakdown,
      commission_notes: `Bank gross: RM${bank_gross.toFixed(2)}. Deductions: RM${bankFlat} (flat)${isPanelLawyer ? ` + RM${bankPanelFee} (panel loan agr)` : ''}${bank_discount > 0 ? ` + RM${bank_discount} (admin adj)` : ''}. ${notes}`,
      status: 'paid',
    }

    const { data: bankCommData, error: bankErr } = await supabase
      .from('commissions')
      .insert(bankInsertData)
      .select()
      .single()

    if (bankErr) {
      return NextResponse.json({ error: `Bank commission insert failed: ${bankErr.message}` }, { status: 500 })
    }

    // ── Insert Lawyer Commission ──
    let lawyerCommData = null
    if (lawyerCommission) {
      const { data, error: lwErr } = await supabase
        .from('commissions')
        .insert(lawyerCommission)
        .select()
        .single()
      if (lwErr) console.error('Lawyer commission insert error:', lwErr)
      else lawyerCommData = data
    }

    // ── Update Case Status → paid ──
    await supabase.from('cases').update({ status: 'paid' }).eq('id', id)

    await supabase.from('case_status_history').insert({
      case_id: id,
      from_status: caseData.status,
      to_status: 'paid',
      changed_by: user.id,
      notes: 'Commission finalised and paid out.',
    })

    // ── Notify Agent ──
    const agentAmount = bankResult.breakdown[caseData.agent_id]?.amount ?? 0
    const lawyerAgentAmount = lawyerCommission
      ? (lawyerCommission?.tier_breakdown?.[caseData.agent_id]?.amount ?? 0)
      : 0
    const totalAgentPayout = agentAmount + lawyerAgentAmount

    await supabase.from('notifications').insert({
      user_id: caseData.agent_id,
      case_id: id,
      title: 'Commission Paid 🎉',
      message: `Case ${caseData.case_code} commission paid. Bank: RM${agentAmount.toFixed(2)}${lawyerCommission ? ` + Lawyer: RM${lawyerAgentAmount.toFixed(2)}` : ''}. Total to you: RM${totalAgentPayout.toFixed(2)}`,
    })

    return NextResponse.json({
      bank: bankCommData,
      lawyer: lawyerCommData,
      summary: {
        bank_gross: bank_gross,
        bank_deductions: bankFlat + bankPanelFee + bank_discount,
        bank_net: bankNetDistributable,
        lawyer_professional_fee: professional_fee ?? null,
        lawyer_net: lawyerCommission?.net_distributable ?? null,
        agent_total: totalAgentPayout,
        is_panel_lawyer: isPanelLawyer,
      }
    })

  } catch (err) {
    console.error('Commission Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
