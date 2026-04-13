import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient, getCallerProfile } from '@/lib/supabase/admin'

const BANK_FLAT_DEDUCTION = 50
const PANEL_LOAN_AGR_DEDUCTION = 200
const LAWYER_QAI_SHARE_PCT = 0.70
const LAWYER_COMPANY_CUT_PCT = 0.10

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildTierPreview(adminClient: any, startAgentId: string, netDistributable: number, configMap: Record<string, number>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: { id: string; name: string; role: string; percentage: number; amount: number }[] = []
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
      rows.push({
        id: p.id,
        name: p.full_name,
        role: p.role,
        percentage: diff,
        amount: parseFloat(((diff / 100) * netDistributable).toFixed(2)),
      })
      lastPct = tierPct
    }
    currentAgentId = p.upline_id
    depth++
  }

  const companyPct = Math.max(0, 100 - lastPct)
  const companyAmount = parseFloat(((companyPct / 100) * netDistributable).toFixed(2))
  return { rows, companyPct, companyAmount }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = getSupabase(cookieStore)
    const adminClient = getAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await getCallerProfile(user.id)
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get case
    const { data: caseData, error: caseErr } = await supabase
      .from('cases')
      .select('agent_id, status, proposed_loan_amount, proposed_bank_id, lawyer_name_other, professional_fee')
      .eq('id', id)
      .single()

    if (caseErr || !caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    // Get bank commission rate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bankData } = await (supabase as any)
      .from('banks')
      .select('commission_rate, name')
      .eq('id', caseData.proposed_bank_id)
      .single()

    const commRate = bankData?.commission_rate ?? 0
    const loanAmount = caseData.proposed_loan_amount ?? 0
    const bankGross = parseFloat((loanAmount * commRate).toFixed(2))
    const isPanelLawyer = !caseData.lawyer_name_other

    // Tier config
    const { data: configs } = await supabase.from('commission_tier_config').select('*')
    const configMap: Record<string, number> = {}
    configs?.forEach((c: { tier: string; percentage: number }) => { configMap[c.tier] = c.percentage })

    // ── Bank Preview ──
    const bankFlat = BANK_FLAT_DEDUCTION
    const bankPanelFee = isPanelLawyer ? PANEL_LOAN_AGR_DEDUCTION : 0
    const bankNet = Math.max(0, bankGross - bankFlat - bankPanelFee)
    const bankPreview = await buildTierPreview(adminClient, caseData.agent_id, bankNet, configMap)

    // ── Lawyer Preview (panel only, if professional_fee set) ──
    let lawyerPreview = null
    const professionalFee = caseData.professional_fee ?? 0
    if (isPanelLawyer && professionalFee > 0) {
      const qaiShare = professionalFee * LAWYER_QAI_SHARE_PCT
      const companyCut = qaiShare * LAWYER_COMPANY_CUT_PCT
      const lawyerNet = Math.max(0, qaiShare - companyCut)
      const preview = await buildTierPreview(adminClient, caseData.agent_id, lawyerNet, configMap)
      lawyerPreview = {
        professional_fee: professionalFee,
        qai_share: parseFloat(qaiShare.toFixed(2)),
        company_cut: parseFloat(companyCut.toFixed(2)),
        net_distributable: parseFloat(lawyerNet.toFixed(2)),
        ...preview,
      }
    }

    return NextResponse.json({
      bank: {
        gross: bankGross,
        bank_name: bankData?.name,
        commission_rate_pct: commRate * 100,
        flat_deduction: bankFlat,
        panel_deduction: bankPanelFee,
        net_distributable: bankNet,
        ...bankPreview,
      },
      lawyer: lawyerPreview,
      is_panel_lawyer: isPanelLawyer,
      professional_fee: professionalFee,
    })

  } catch (err) {
    console.error('Commission preview error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
