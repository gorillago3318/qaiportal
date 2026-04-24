/**
 * Commission Engine — Shared Business Logic
 *
 * Single implementation of all commission calculations.
 * Both /api/cases/[id]/commission and /api/cases/[id]/commission/preview import from here.
 *
 * See: docs/core/constitution.md Part 3 for full rules.
 */

import {
  BANK_FLAT_DEDUCTION_RM,
  LAWYER_QAI_SHARE_PCT,
  LAWYER_COMPANY_CUT_PCT,
  LAWYER_PANEL_DEDUCTION_RM,
  SUPER_ADMIN_PLATFORM_FEE_PCT,
  CO_BROKE_REFERRER_SHARE_PCT,
  CO_BROKE_DOER_SHARE_PCT,
  COMMISSION_CHAIN_STOP_ROLES,
} from '@/constants/business'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TierEntry {
  role: string
  name: string
  percentage: number
  amount: number
  is_platform_fee?: boolean
  is_referrer?: boolean
  /** Agent-specific discount deducted from this entry's amount (special arrangement). */
  special_discount?: number
}

export interface TierBreakdown {
  breakdown: Record<string, TierEntry>
  /** The super_admin user ID who receives the 7.5% platform fee */
  platformFeeRecipientId: string | null
}

export interface CommissionSplit {
  /** Referrer flat payout (co-broke only, else 0) */
  referrerAmount: number
  referrerAgentId: string | null
  /** Pool that goes through tier breakdown */
  doerPool: number
  doerAgentId: string
  hasCoBroke: boolean
}

export interface BankCommissionResult {
  gross: number
  flatDeduction: number
  netDistributable: number
  /** Simplified tier breakdown: 100% assigned to the submitting agent. */
  tierBreakdown: TierBreakdown
  notes: string
}

export interface LawyerCommissionResult {
  gross: number
  qaiShare: number
  companyCut: number
  panelDeduction: number
  netDistributable: number
  coBroke: CommissionSplit
  tierBreakdown: TierBreakdown
  notes: string
}

// ─── Core: Walk upline chain ──────────────────────────────────────────────────

/**
 * Walk the upline chain from startAgentId, allocate commission using
 * the differential percentage model. Super_admin always gets 7.5% as platform fee.
 *
 * @param adminClient - Supabase service role client (bypasses RLS)
 * @param startAgentId - Case agent (or doer agent in co-broke)
 * @param pool - Amount to distribute (net distributable or doer's share)
 * @param configMap - { role: cumulative_percentage } for this agency
 * @param superAdminId - UUID of the super_admin user to receive platform fee
 */
export async function buildTierBreakdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  startAgentId: string,
  pool: number,
  configMap: Record<string, number>,
  superAdminId: string | null
): Promise<TierBreakdown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const breakdown: Record<string, TierEntry> = {}
  let currentId: string | null = startAgentId
  let lastPct = 0
  let depth = 0

  while (currentId && depth < 10) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p }: { data: any } = await adminClient
      .from('profiles')
      .select('id, full_name, role, upline_id')
      .eq('id', currentId)
      .single()

    if (!p) break

    // Stop chain at admin/super_admin roles
    if (COMMISSION_CHAIN_STOP_ROLES.has(p.role)) break

    const tierPct = configMap[p.role] ?? 0
    const diff = tierPct - lastPct

    if (diff > 0) {
      breakdown[p.id] = {
        role: p.role,
        name: p.full_name,
        percentage: diff,
        amount: parseFloat(((diff / 100) * pool).toFixed(2)),
      }
      lastPct = tierPct
    }

    currentId = p.upline_id
    depth++
  }

  // Super_admin always gets the platform fee (7.5% — which is 100% - 92.5% max tier)
  const platformFee = parseFloat(((SUPER_ADMIN_PLATFORM_FEE_PCT / 100) * pool).toFixed(2))

  if (superAdminId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sa }: { data: any } = await adminClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', superAdminId)
      .single()

    if (sa) {
      breakdown[superAdminId] = {
        role: 'super_admin',
        name: sa.full_name || 'QuantifyAI',
        percentage: SUPER_ADMIN_PLATFORM_FEE_PCT,
        amount: platformFee,
        is_platform_fee: true,
      }
    }
  }

  return { breakdown, platformFeeRecipientId: superAdminId }
}

// ─── Co-broke split ───────────────────────────────────────────────────────────

/**
 * Determine if a case has co-broke and compute the split.
 * Returns a CommissionSplit regardless (hasCoBroke = false if no co-broke record).
 */
export async function resolveCoBroke(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  caseId: string,
  caseAgentId: string,
  netDistributable: number
): Promise<CommissionSplit> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cobroke }: { data: any } = await adminClient
    .from('case_co_broke')
    .select('referrer_agent_id, doer_agent_id, referrer_share, doer_share')
    .eq('case_id', caseId)
    .maybeSingle()

  if (!cobroke) {
    return {
      referrerAmount: 0,
      referrerAgentId: null,
      doerPool: netDistributable,
      doerAgentId: caseAgentId,
      hasCoBroke: false,
    }
  }

  const referrerShare = CO_BROKE_REFERRER_SHARE_PCT // always 30
  const doerShare = CO_BROKE_DOER_SHARE_PCT         // always 70

  return {
    referrerAmount: parseFloat(((referrerShare / 100) * netDistributable).toFixed(2)),
    referrerAgentId: cobroke.referrer_agent_id,
    doerPool: parseFloat(((doerShare / 100) * netDistributable).toFixed(2)),
    doerAgentId: cobroke.doer_agent_id || caseAgentId,
    hasCoBroke: true,
  }
}

// ─── Panel lawyer check ───────────────────────────────────────────────────────

/**
 * Check if the case's lawyer is a panel lawyer.
 * Uses DB is_panel flag — NOT the null-check on lawyer_name_other.
 * DEC-004, DEC-017.
 */
export async function isPanelLawyer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  lawyerId: string | null | undefined
): Promise<boolean> {
  if (!lawyerId) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data }: { data: any } = await adminClient
    .from('lawyers')
    .select('is_panel')
    .eq('id', lawyerId)
    .single()

  return data?.is_panel === true
}

// ─── Fetch super_admin ID ─────────────────────────────────────────────────────

/** Get the super_admin user ID to receive the platform fee. */
export async function getSuperAdminId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data }: { data: any } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)
    .single()

  return data?.id ?? null
}

// ─── Bank commission calculation ──────────────────────────────────────────────
// Rule (confirmed 2026-04-24): deduct RM50 admin fee, agent receives 100% of remainder.
// No tier distribution, no panel-lawyer deduction, no admin override.

export interface BankCommissionInput {
  caseAgentId: string
  bankGross: number
  notes?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
}

export async function calculateBankCommission(
  input: BankCommissionInput
): Promise<BankCommissionResult> {
  const { caseAgentId, bankGross, notes, adminClient } = input

  const flatDeduction = BANK_FLAT_DEDUCTION_RM
  const netDistributable = parseFloat(Math.max(0, bankGross - flatDeduction).toFixed(2))

  // Fetch agent profile so the tier_breakdown record is human-readable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentProfile }: { data: any } = await adminClient
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', caseAgentId)
    .single()

  const tierBreakdown: TierBreakdown = {
    breakdown: {
      [caseAgentId]: {
        role: agentProfile?.role ?? 'agent',
        name: agentProfile?.full_name ?? 'Agent',
        percentage: 100,
        amount: netDistributable,
      },
    },
    platformFeeRecipientId: null,
  }

  const noteStr = [
    `Bank gross: RM${bankGross.toFixed(2)}`,
    `Admin fee: RM${flatDeduction}`,
    `Net to agent (100%): RM${netDistributable.toFixed(2)}`,
    notes || null,
  ].filter(Boolean).join('. ')

  return {
    gross: bankGross,
    flatDeduction,
    netDistributable,
    tierBreakdown,
    notes: noteStr,
  }
}

// ─── Lawyer commission calculation ────────────────────────────────────────────

export interface LawyerCommissionInput {
  caseId: string
  caseAgentId: string
  professionalFee: number
  /** Whether a panel lawyer is used — triggers RM200 admin fee deduction. */
  panelLawyerConfirmed: boolean
  /**
   * Special arrangement discount entered by the agent (e.g. client negotiated lower fee
   * at LA signing). Reduces only the doer agent's tier amount — upline is unaffected.
   */
  specialArrangementDiscount?: number
  notes?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any
  configMap: Record<string, number>
  superAdminId: string | null
}

// Rule (confirmed 2026-04-24):
// 1. QAI takes 70% of professional fee
// 2. QAI keeps 10% of its share internally (company cut)
// 3. Deduct RM200 admin fee if panel lawyer used
// 4. Remainder goes through tier distribution
// 5. specialArrangementDiscount reduces doer agent's tier amount only (upline untouched)
export async function calculateLawyerCommission(
  input: LawyerCommissionInput
): Promise<LawyerCommissionResult> {
  const { caseId, caseAgentId, professionalFee, panelLawyerConfirmed, notes, adminClient, configMap, superAdminId } = input
  const specialDiscount = input.specialArrangementDiscount ?? 0

  const qaiShare = parseFloat((professionalFee * LAWYER_QAI_SHARE_PCT).toFixed(2))
  const companyCut = parseFloat((qaiShare * LAWYER_COMPANY_CUT_PCT).toFixed(2))
  const panelDeduction = panelLawyerConfirmed ? LAWYER_PANEL_DEDUCTION_RM : 0
  const netDistributable = parseFloat(Math.max(0, qaiShare - companyCut - panelDeduction).toFixed(2))

  const coBroke = await resolveCoBroke(adminClient, caseId, caseAgentId, netDistributable)
  const tierBreakdown = await buildTierBreakdown(
    adminClient,
    coBroke.doerAgentId,
    coBroke.doerPool,
    configMap,
    superAdminId
  )

  // Apply special arrangement discount — reduces only the doer agent's amount, upline untouched
  if (specialDiscount > 0 && tierBreakdown.breakdown[coBroke.doerAgentId]) {
    const entry = tierBreakdown.breakdown[coBroke.doerAgentId]
    tierBreakdown.breakdown[coBroke.doerAgentId] = {
      ...entry,
      amount: parseFloat(Math.max(0, entry.amount - specialDiscount).toFixed(2)),
      special_discount: specialDiscount,
    }
  }

  const noteStr = [
    `Lawyer professional fee: RM${professionalFee.toFixed(2)}`,
    `QAI 70% share = RM${qaiShare.toFixed(2)}`,
    `Company 10% cut = RM${companyCut.toFixed(2)}`,
    panelLawyerConfirmed ? `Panel admin fee = RM${panelDeduction}` : null,
    `Net distributable = RM${netDistributable.toFixed(2)}`,
    coBroke.hasCoBroke ? `Co-broke: referrer RM${coBroke.referrerAmount.toFixed(2)} | doer pool RM${coBroke.doerPool.toFixed(2)}` : null,
    specialDiscount > 0 ? `Special arrangement discount = RM${specialDiscount.toFixed(2)}` : null,
    notes || null,
  ].filter(Boolean).join('. ')

  return {
    gross: professionalFee,
    qaiShare,
    companyCut,
    panelDeduction,
    netDistributable,
    coBroke,
    tierBreakdown,
    notes: noteStr,
  }
}
