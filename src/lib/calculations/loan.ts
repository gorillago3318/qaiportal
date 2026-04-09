// ==================== LOAN CALCULATION ENGINE ====================
// Malaysian mortgage calculation logic for QuantifyAI

// ==================== INTERFACES ====================

export interface RefinanceInputs {
  currentLoanAmount: number
  currentInterestRate: number // annual %
  currentMonthlyInstalment: number
  currentTenureMonths: number
  proposedLoanAmount: number
  proposedInterestRate: number // annual %
  proposedTenureMonths: number
  financeInFees: boolean
  legalFeeAmount?: number
  valuationFeeAmount?: number
  stampDutyAmount?: number
  cashOutAmount?: number
  cashOutTenureMonths?: number // max 120 (10 years)
}

export interface RefinanceResults {
  // Main loan comparison
  currentRemainingInterest: number
  currentTotalRemaining: number
  proposedMonthlyInstalment: number
  proposedTotalInterest: number
  proposedTotalAmount: number
  monthlySavings: number
  totalInterestSaved: number
  // Tenure saved (if paying old instalment on new loan)
  tenureSavedMonths: number
  effectiveTenureMonths: number
  // Bi-weekly savings
  biweeklyPayment: number
  biweeklyTenureMonths: number
  biweeklyInterestSaved: number
  // Break-even
  totalRefinancingCosts: number
  breakEvenMonths: number
  // Cash out (separate section)
  cashOutMonthlyInstalment?: number
  cashOutTotalInterest?: number
  cashOutTotalAmount?: number
  // Fees breakdown
  totalFeesFinanced: number
  effectiveLoanAmount: number // proposed + fees if financed
}

export interface BiweeklyResult {
  payment: number
  tenureMonths: number
  totalInterest: number
}

export interface SnowballResult {
  tenureMonths: number
  totalInterest: number
  saved: number
}

// ==================== CORE AMORTIZATION ====================

/**
 * Standard amortization monthly instalment.
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyInstalment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0
  if (annualRate === 0) return principal / months

  const monthlyRate = annualRate / 100 / 12
  const factor = Math.pow(1 + monthlyRate, months)
  return (principal * monthlyRate * factor) / (factor - 1)
}

/**
 * Total interest paid over the life of the loan.
 */
export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  months: number
): number {
  const monthly = calculateMonthlyInstalment(principal, annualRate, months)
  return monthly * months - principal
}

// ==================== BI-WEEKLY ====================

/**
 * Bi-weekly payment = monthly / 2 but paid 26 times/year.
 * This accelerates payoff because there are 26 bi-weekly periods vs 24 half-months.
 */
export function calculateBiweekly(
  principal: number,
  annualRate: number,
  months: number
): BiweeklyResult {
  const monthlyInstalment = calculateMonthlyInstalment(principal, annualRate, months)
  const biweeklyPayment = monthlyInstalment / 2
  const biweeklyRate = annualRate / 100 / 26

  // Calculate bi-weekly tenure using amortization formula solved for n
  // n = -ln(1 - P*r/M) / ln(1+r)
  let tenurePeriods: number
  if (annualRate === 0) {
    tenurePeriods = principal / biweeklyPayment
  } else {
    const x = 1 - (principal * biweeklyRate) / biweeklyPayment
    if (x <= 0) {
      tenurePeriods = 1
    } else {
      tenurePeriods = -Math.log(x) / Math.log(1 + biweeklyRate)
    }
  }

  const tenureMonths = Math.ceil((tenurePeriods / 26) * 12)
  const totalInterest = biweeklyPayment * tenurePeriods - principal

  return {
    payment: biweeklyPayment,
    tenureMonths,
    totalInterest: Math.max(0, totalInterest),
  }
}

// ==================== TENURE SAVED ====================

/**
 * Calculate how many months are saved if borrower keeps paying
 * their old (higher) instalment on the new loan.
 */
export function calculateTenureSaved(
  currentInstalment: number,
  newPrincipal: number,
  newAnnualRate: number
): number {
  if (currentInstalment <= 0 || newPrincipal <= 0) return 0
  if (newAnnualRate === 0) {
    return Math.ceil(newPrincipal / currentInstalment)
  }

  const monthlyRate = newAnnualRate / 100 / 12
  const x = 1 - (newPrincipal * monthlyRate) / currentInstalment

  if (x <= 0) return 1

  const periodsNeeded = -Math.log(x) / Math.log(1 + monthlyRate)
  return Math.ceil(periodsNeeded)
}

// ==================== SNOWBALL / EXTRA PAYMENT ====================

/**
 * Calculate impact of making extra monthly payments.
 */
export function calculateSnowball(
  principal: number,
  annualRate: number,
  months: number,
  extraPayment: number
): SnowballResult {
  const baseMonthly = calculateMonthlyInstalment(principal, annualRate, months)
  const totalMonthly = baseMonthly + extraPayment
  const monthlyRate = annualRate / 100 / 12

  let balance = principal
  let totalPaid = 0
  let period = 0

  while (balance > 0.01 && period < months * 2) {
    period++
    const interest = balance * monthlyRate
    const payment = Math.min(totalMonthly, balance + interest)
    const principal_paid = payment - interest
    balance -= principal_paid
    totalPaid += payment
  }

  const baseInterest = calculateTotalInterest(principal, annualRate, months)
  const snowballInterest = totalPaid - principal
  const saved = Math.max(0, baseInterest - snowballInterest)

  return {
    tenureMonths: period,
    totalInterest: Math.max(0, snowballInterest),
    saved,
  }
}

// ==================== MALAYSIAN FEE CALCULATORS ====================

/**
 * Malaysian Legal Fee Scale (Solicitors' Remuneration Order 2017)
 * - First RM500,000: 1%
 * - RM500,001 – RM7,500,000: 0.8%
 * - Above RM7,500,000: 0.7% (negotiable)
 * - Minimum RM500
 */
export function calculateLegalFee(loanAmount: number): number {
  if (loanAmount <= 0) return 0

  let fee = 0

  if (loanAmount <= 500_000) {
    fee = loanAmount * 0.01
  } else if (loanAmount <= 7_500_000) {
    fee = 500_000 * 0.01 + (loanAmount - 500_000) * 0.008
  } else {
    fee = 500_000 * 0.01 + 7_000_000 * 0.008 + (loanAmount - 7_500_000) * 0.007
  }

  return Math.max(500, fee)
}

/**
 * Malaysian Valuation Fee Scale
 * - First RM100,000: 0.25% (min RM500)
 * - Next RM1,900,000 (up to RM2M): 0.2%
 * - Next RM5M (up to RM7M): 0.167%
 * - Next RM15M (up to RM22M): 0.125%
 * - Above RM22M: 0.1%
 */
export function calculateValuationFee(propertyValue: number): number {
  if (propertyValue <= 0) return 0

  let fee = 0

  if (propertyValue <= 100_000) {
    fee = propertyValue * 0.0025
  } else if (propertyValue <= 2_000_000) {
    fee = 100_000 * 0.0025 + (propertyValue - 100_000) * 0.002
  } else if (propertyValue <= 7_000_000) {
    fee =
      100_000 * 0.0025 +
      1_900_000 * 0.002 +
      (propertyValue - 2_000_000) * 0.00167
  } else if (propertyValue <= 22_000_000) {
    fee =
      100_000 * 0.0025 +
      1_900_000 * 0.002 +
      5_000_000 * 0.00167 +
      (propertyValue - 7_000_000) * 0.00125
  } else {
    fee =
      100_000 * 0.0025 +
      1_900_000 * 0.002 +
      5_000_000 * 0.00167 +
      15_000_000 * 0.00125 +
      (propertyValue - 22_000_000) * 0.001
  }

  return Math.max(500, fee)
}

/**
 * Stamp Duty on loan agreement = 0.5% of loan amount
 */
export function calculateStampDuty(loanAmount: number): number {
  return loanAmount * 0.005
}

// ==================== MAIN REFINANCE CALCULATOR ====================

export function calculateRefinance(inputs: RefinanceInputs): RefinanceResults {
  const {
    currentLoanAmount,
    currentInterestRate,
    currentMonthlyInstalment,
    currentTenureMonths,
    proposedLoanAmount,
    proposedInterestRate,
    proposedTenureMonths,
    financeInFees,
    legalFeeAmount = 0,
    valuationFeeAmount = 0,
    stampDutyAmount = 0,
    cashOutAmount = 0,
    cashOutTenureMonths = 120,
  } = inputs

  // ── Current loan remaining interest ──
  const currentTotalRemaining = currentMonthlyInstalment * currentTenureMonths
  const currentRemainingInterest = Math.max(
    0,
    currentTotalRemaining - currentLoanAmount
  )

  // ── Total fees to finance ──
  const totalFeesFinanced = financeInFees
    ? legalFeeAmount + valuationFeeAmount + stampDutyAmount
    : 0

  const effectiveLoanAmount = proposedLoanAmount + totalFeesFinanced

  // ── Proposed loan ──
  const proposedMonthlyInstalment = calculateMonthlyInstalment(
    effectiveLoanAmount,
    proposedInterestRate,
    proposedTenureMonths
  )
  const proposedTotalAmount = proposedMonthlyInstalment * proposedTenureMonths
  const proposedTotalInterest = proposedTotalAmount - effectiveLoanAmount

  // ── Monthly savings ──
  const monthlySavings = currentMonthlyInstalment - proposedMonthlyInstalment

  // ── Total interest saved ──
  const totalInterestSaved = currentRemainingInterest - proposedTotalInterest

  // ── Tenure saved (if borrower keeps paying old instalment) ──
  const acceleratedTenureMonths = calculateTenureSaved(
    currentMonthlyInstalment,
    effectiveLoanAmount,
    proposedInterestRate
  )
  const tenureSavedMonths = Math.max(
    0,
    proposedTenureMonths - acceleratedTenureMonths
  )
  const effectiveTenureMonths = acceleratedTenureMonths

  // ── Bi-weekly ──
  const biweekly = calculateBiweekly(
    effectiveLoanAmount,
    proposedInterestRate,
    proposedTenureMonths
  )
  const biweeklyInterestSaved = Math.max(
    0,
    proposedTotalInterest - biweekly.totalInterest
  )

  // ── Break-even ──
  const totalRefinancingCosts =
    legalFeeAmount + valuationFeeAmount + stampDutyAmount
  const breakEvenMonths =
    monthlySavings > 0
      ? Math.ceil(totalRefinancingCosts / monthlySavings)
      : 9999

  // ── Cash out ──
  let cashOutMonthlyInstalment: number | undefined
  let cashOutTotalInterest: number | undefined
  let cashOutTotalAmount: number | undefined

  if (cashOutAmount && cashOutAmount > 0) {
    cashOutMonthlyInstalment = calculateMonthlyInstalment(
      cashOutAmount,
      proposedInterestRate,
      cashOutTenureMonths
    )
    cashOutTotalAmount = cashOutMonthlyInstalment * cashOutTenureMonths
    cashOutTotalInterest = cashOutTotalAmount - cashOutAmount
  }

  return {
    currentRemainingInterest,
    currentTotalRemaining,
    proposedMonthlyInstalment,
    proposedTotalInterest,
    proposedTotalAmount,
    monthlySavings,
    totalInterestSaved,
    tenureSavedMonths,
    effectiveTenureMonths,
    biweeklyPayment: biweekly.payment,
    biweeklyTenureMonths: biweekly.tenureMonths,
    biweeklyInterestSaved,
    totalRefinancingCosts,
    breakEvenMonths,
    cashOutMonthlyInstalment,
    cashOutTotalInterest,
    cashOutTotalAmount,
    totalFeesFinanced,
    effectiveLoanAmount,
  }
}

// ==================== COMMISSION CALCULATOR ====================

export interface CommissionTier {
  role: string
  percentage: number
  amount: number
}

export interface CommissionCalculation {
  grossBankCommission: number
  companyCut: number
  netDistributable: number
  tiers: CommissionTier[]
  agentAmount: number
}

/**
 * Calculate bank commission and tier breakdown.
 * Company takes their % off the top, then remaining is split down the upline.
 */
export function calculateBankCommission(
  loanAmount: number,
  bankCommissionRate: number, // % of loan (e.g. 0.3 = 0.3%)
  companyPercentage: number, // % company takes (e.g. 10)
  tierPercentages: Array<{ role: string; percentage: number }> // in order from agent up
): CommissionCalculation {
  const grossBankCommission = loanAmount * (bankCommissionRate / 100)
  const companyCut = grossBankCommission * (companyPercentage / 100)
  const netDistributable = grossBankCommission - companyCut

  const tiers: CommissionTier[] = tierPercentages.map((tier) => ({
    role: tier.role,
    percentage: tier.percentage,
    amount: netDistributable * (tier.percentage / 100),
  }))

  // Agent gets the base tier amount (bottom of chain)
  const agentAmount = tiers.length > 0 ? tiers[tiers.length - 1].amount : 0

  return {
    grossBankCommission,
    companyCut,
    netDistributable,
    tiers,
    agentAmount,
  }
}

// ==================== CO-BROKE SPLIT ====================

export interface CoBrokeResult {
  referrerAmount: number
  doerAmount: number
  referrerShare: number // % (default 30)
  doerShare: number // % (default 70)
}

/**
 * Split commission between referrer and doer agents.
 * Default: 30% referrer, 70% doer.
 */
export function calculateCoBroke(
  totalCommission: number,
  referrerShare = 30,
  doerShare = 70
): CoBrokeResult {
  const totalShares = referrerShare + doerShare
  const referrerFraction = referrerShare / totalShares
  const doerFraction = doerShare / totalShares

  return {
    referrerAmount: totalCommission * referrerFraction,
    doerAmount: totalCommission * doerFraction,
    referrerShare,
    doerShare,
  }
}
