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
 * GET /api/cases/[id]/commission/preview
 *
 * Preview commission breakdown before finalizing. Nothing is saved.
 * Query params: bank_gross, bank_discount, professional_fee
 */
export async function GET(
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
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const callerProfile = await getCallerProfile(user.id)
    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Parse Query Params ──
    const { searchParams } = new URL(request.url)
    const bankGross = parseFloat(searchParams.get('bank_gross') || '0')
    const bankDiscount = parseFloat(searchParams.get('bank_discount') || '0')
    const professionalFee = parseFloat(searchParams.get('professional_fee') || '0')

    if (!bankGross || bankGross <= 0) {
      return NextResponse.json({ error: 'bank_gross must be > 0' }, { status: 400 })
    }

    // ── Fetch Case ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: caseData, error: caseErr }: { data: any; error: any } = await (adminClient as any)
      .from('cases')
      .select('agent_id, agency_id, lawyer_id, case_code')
      .eq('id', id)
      .single()

    if (caseErr || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
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

    // ── Panel Lawyer Check ──
    const panelLawyerConfirmed = await isPanelLawyer(adminClient, caseData.lawyer_id)

    // ── Super Admin ──
    const superAdminId = await getSuperAdminId(adminClient)

    // ── Calculate (preview only — no save) ──
    const bankResult = await calculateBankCommission({
      caseAgentId: caseData.agent_id,
      bankGross,
      adminClient,
    })

    let lawyerResult = null
    if (panelLawyerConfirmed && professionalFee > 0) {
      lawyerResult = await calculateLawyerCommission({
        caseId: id,
        caseAgentId: caseData.agent_id,
        professionalFee,
        panelLawyerConfirmed,
        adminClient,
        configMap,
        superAdminId,
      })
    }

    return NextResponse.json({
      bank: {
        gross: bankResult.gross,
        deductions: {
          flat: bankResult.flatDeduction,
          total: bankResult.flatDeduction,
        },
        net_distributable: bankResult.netDistributable,
        rows: Object.entries(bankResult.tierBreakdown.breakdown).map(([uid, e]) => ({
          id: uid, name: e.name, role: e.role, percentage: e.percentage, amount: e.amount,
        })),
      },
      lawyer: lawyerResult ? {
        gross: lawyerResult.gross,
        qai_share: lawyerResult.qaiShare,
        company_cut: lawyerResult.companyCut,
        net_distributable: lawyerResult.netDistributable,
        co_broke: lawyerResult.coBroke.hasCoBroke ? {
          referrer_amount: lawyerResult.coBroke.referrerAmount,
          doer_pool: lawyerResult.coBroke.doerPool,
        } : null,
        tier_breakdown: Object.values(lawyerResult.tierBreakdown.breakdown),
      } : null,
      is_panel_lawyer: panelLawyerConfirmed,
      preview: true,
    })

  } catch (err) {
    console.error('Commission Preview Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
