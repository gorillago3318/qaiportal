/**
 * Business Constants — Single Source of Truth
 *
 * All financial constants, tier percentages, and business rules live here.
 * Do NOT hardcode these values anywhere else. Import from this file.
 *
 * See: docs/core/constitution.md for business rules
 * See: docs/decisions/log.md for rationale behind each value
 */

// ─────────────────────────────────────────────
// COMMISSION DEDUCTIONS (Bank)
// ─────────────────────────────────────────────

/**
 * Flat admin fee deducted from every bank commission.
 * Agent receives 100% of the remainder — no tier distribution.
 * Confirmed 2026-04-24.
 */
export const BANK_FLAT_DEDUCTION_RM = 50

// ─────────────────────────────────────────────
// COMMISSION DEDUCTIONS (Lawyer — Panel Only)
// ─────────────────────────────────────────────

/**
 * QAI's share of the panel lawyer's professional fee.
 * The lawyer keeps (1 - LAWYER_QAI_SHARE_PCT) = 30%.
 */
export const LAWYER_QAI_SHARE_PCT = 0.70

/**
 * QAI's internal company cut from its own 70% share.
 * Kept by QuantifyAI, not distributed to agents.
 */
export const LAWYER_COMPANY_CUT_PCT = 0.10

/**
 * Admin fee deducted from lawyer net distributable when a panel lawyer is used.
 * Applied AFTER the company cut, BEFORE tier distribution.
 * Confirmed 2026-04-24.
 */
export const LAWYER_PANEL_DEDUCTION_RM = 200

// ─────────────────────────────────────────────
// SUPER ADMIN PLATFORM FEE
// ─────────────────────────────────────────────

/**
 * QuantifyAI (super_admin) always retains this % of every net distributable.
 * Applied AFTER the agency tier chain (which maxes at agency_manager 92.5%).
 * Total = 92.5% (agency chain) + 7.5% (QuantifyAI) = 100%.
 */
export const SUPER_ADMIN_PLATFORM_FEE_PCT = 7.5

// ─────────────────────────────────────────────
// TIER PERCENTAGES (Cumulative)
// ─────────────────────────────────────────────

/**
 * Commission tier percentages by role.
 * These are CUMULATIVE (not differential).
 * The differential model subtracts the previous tier's % to get each person's share.
 *
 * DEC-005: Confirmed by user 2026-04-13.
 */
export const COMMISSION_TIER_PCT: Record<string, number> = {
  agent: 70,
  senior_agent: 80,
  unit_manager: 87.5,
  agency_manager: 92.5,
  // admin and super_admin are NOT in this map — they do not earn sales commission
}

/** Roles that stop the upline chain traversal. */
export const COMMISSION_CHAIN_STOP_ROLES = new Set(['admin', 'super_admin'])

// ─────────────────────────────────────────────
// CO-BROKE (REFERRAL) SPLIT
// ─────────────────────────────────────────────

/**
 * Referrer's fixed share of net distributable.
 * Paid as a flat direct payout — no tier breakdown applied.
 * DEC-018: Always 30%, never configurable per case.
 */
export const CO_BROKE_REFERRER_SHARE_PCT = 30

/**
 * Doer's share of net distributable.
 * This pool goes through the full tier breakdown.
 */
export const CO_BROKE_DOER_SHARE_PCT = 70

// ─────────────────────────────────────────────
// PANEL LAWYERS
// ─────────────────────────────────────────────

/**
 * Authoritative list of panel lawyer firm names.
 * DEC-017: Confirmed by user 2026-04-13.
 * These must match exactly what is stored in the lawyers table (name field).
 */
export const PANEL_LAWYER_NAMES = [
  'Low, Wong and Zahrita',
  'Yong & Rajah',
] as const

// ─────────────────────────────────────────────
// CASE WORKFLOW
// ─────────────────────────────────────────────

/** Roles that can see ALL cases in their agency (not just own). */
export const ADMIN_ROLES = new Set(['admin', 'super_admin'])

/** Roles that can finalize commissions. */
export const COMMISSION_FINALIZE_ROLES = new Set(['admin', 'super_admin'])

/** Maximum co-borrowers per case. */
export const MAX_CO_BORROWERS = 1

// ─────────────────────────────────────────────
// CALCULATOR
// ─────────────────────────────────────────────

/** Maximum age for Malaysian mortgage (standard bank policy). */
export const MORTGAGE_MAX_AGE = 70

/** Estimated combined legal + valuation fee when no quotation (4% of loan amount). */
export const NO_QUOTATION_FEE_ESTIMATE_PCT = 0.04
