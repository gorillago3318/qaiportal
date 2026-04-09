"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, CheckCircle, FileText, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { WizardStepIndicator } from "@/components/shared/wizard-step-indicator"
import { CurrencyInput } from "@/components/shared/currency-input"
import { TenureInput } from "@/components/shared/tenure-input"
import { LoanTypeCard } from "@/components/shared/loan-type-card"
import { createClient } from "@/lib/supabase/client"
import {
  calculateMonthlyInstalment,
  calculateRefinance,
  calculateBiweekly,
  calculateSnowball,
  calculateLegalFee,
  calculateValuationFee,
  calculateStampDuty,
  type RefinanceResults,
} from "@/lib/calculations/loan"
import {
  formatCurrency,
  formatDate,
  calcMaxTenureMonths,
  monthsToYearsMonths,
  cn,
} from "@/lib/utils"
import type { LoanType, Bank } from "@/types/database"

// ─────────────────────────── Types ───────────────────────────

interface WizardState {
  // Step 1
  loanType: LoanType | null
  clientName: string
  clientIc: string
  clientPhone: string
  clientDob: string
  referralCode: string

  // Step 2 — Refinance current loan
  currentBank: string
  currentLoanAmount: number | undefined
  currentInterestRate: number | undefined
  currentMonthlyInstalment: number | undefined
  currentTenureYears: number | undefined
  currentTenureMonths: number | undefined
  loanTenureType: "term" | "flexi" | "semi_flexi"
  isIslamic: boolean
  hasLockIn: boolean
  lockInMonths: number | undefined

  // Step 2 — Subsale/Developer
  propertyPurchasePrice: number | undefined
  downPaymentPct: number
  propertyType: string
  developerAbsorbsLegalFees: boolean
  developerAbsorbsSpaStampDuty: boolean
  numBorrowers: number

  // Step 3
  proposedBankId: string
  proposedBankName: string
  proposedBankCommissionRate: number
  proposedLoanAmount: number | undefined
  proposedInterestRate: number | undefined
  proposedTenureYears: number | undefined
  proposedTenureMonths: number | undefined
  financeInFees: boolean
  legalFeeAmount: number | undefined
  valuationFeeAmount: number | undefined
  stampDutyAmount: number | undefined
  hasCashOut: boolean
  cashOutAmount: number | undefined
  cashOutTenureMonths: number | undefined

  // Step 4
  showInterestSavings: boolean
  showBiweekly: boolean
  showSnowball: boolean
  snowballExtra: number | undefined
  showBreakeven: boolean
  showCashOutSummary: boolean
}

const initialState: WizardState = {
  loanType: null,
  clientName: "",
  clientIc: "",
  clientPhone: "",
  clientDob: "",
  referralCode: "",
  currentBank: "",
  currentLoanAmount: undefined,
  currentInterestRate: undefined,
  currentMonthlyInstalment: undefined,
  currentTenureYears: undefined,
  currentTenureMonths: undefined,
  loanTenureType: "term",
  isIslamic: false,
  hasLockIn: false,
  lockInMonths: undefined,
  propertyPurchasePrice: undefined,
  downPaymentPct: 10,
  propertyType: "residential",
  developerAbsorbsLegalFees: false,
  developerAbsorbsSpaStampDuty: false,
  numBorrowers: 1,
  proposedBankId: "",
  proposedBankName: "",
  proposedBankCommissionRate: 0,
  proposedLoanAmount: undefined,
  proposedInterestRate: undefined,
  proposedTenureYears: undefined,
  proposedTenureMonths: undefined,
  financeInFees: false,
  legalFeeAmount: undefined,
  valuationFeeAmount: undefined,
  stampDutyAmount: undefined,
  hasCashOut: false,
  cashOutAmount: undefined,
  cashOutTenureMonths: 120,
  showInterestSavings: true,
  showBiweekly: true,
  showSnowball: true,
  snowballExtra: undefined,
  showBreakeven: true,
  showCashOutSummary: true,
}

const STEP_LABELS = ["Loan Type", "Current Loan", "New Loan", "Modules", "Results"]

const MALAYSIAN_BANKS = [
  "Maybank", "CIMB", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "OCBC", "UOB", "Standard Chartered", "HSBC",
  "Affin Bank", "Alliance Bank", "Bank Islam", "Bank Muamalat", "BSN",
]

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential (House/Condo/Apartment)" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "agricultural", label: "Agricultural" },
]

// ─────────────────────────── Main Component ───────────────────────────

function NewCalculationWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = React.useState(0) // 0-indexed, 0-4
  const [state, setState] = React.useState<WizardState>({
    ...initialState,
    referralCode: searchParams.get("ref") || "",
  })
  const [banks, setBanks] = React.useState<Bank[]>([])
  const [banksLoading, setBanksLoading] = React.useState(true)
  const [results, setResults] = React.useState<RefinanceResults | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [savedId, setSavedId] = React.useState<string | null>(null)

  const maxTenureMonths = state.clientDob
    ? calcMaxTenureMonths(state.clientDob)
    : undefined

  // Fetch banks
  React.useEffect(() => {
    const supabase = createClient()
    supabase
      .from("banks")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setBanks(data as Bank[])
        setBanksLoading(false)
      })
  }, [])

  // Auto-calc current monthly instalment
  React.useEffect(() => {
    if (
      state.currentLoanAmount &&
      state.currentInterestRate &&
      state.currentTenureYears !== undefined
    ) {
      const months =
        (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
      if (months > 0) {
        const mi = calculateMonthlyInstalment(
          state.currentLoanAmount,
          state.currentInterestRate,
          months
        )
        setState((s) => ({ ...s, currentMonthlyInstalment: Math.round(mi * 100) / 100 }))
      }
    }
  }, [state.currentLoanAmount, state.currentInterestRate, state.currentTenureYears, state.currentTenureMonths])

  // Auto-calc proposed loan amount from property price
  React.useEffect(() => {
    if (
      (state.loanType === "subsale" || state.loanType === "developer") &&
      state.propertyPurchasePrice
    ) {
      const loanAmt =
        state.propertyPurchasePrice * (1 - state.downPaymentPct / 100)
      setState((s) => ({ ...s, proposedLoanAmount: Math.round(loanAmt) }))
    }
  }, [state.propertyPurchasePrice, state.downPaymentPct, state.loanType])

  // Auto-calc fees when financeInFees toggled or loan amount changes
  React.useEffect(() => {
    if (state.financeInFees && state.proposedLoanAmount) {
      const legal = calculateLegalFee(state.proposedLoanAmount)
      const val = calculateValuationFee(state.proposedLoanAmount)
      const stamp = calculateStampDuty(state.proposedLoanAmount)
      setState((s) => ({
        ...s,
        legalFeeAmount: Math.round(legal * 100) / 100,
        valuationFeeAmount: Math.round(val * 100) / 100,
        stampDutyAmount: Math.round(stamp * 100) / 100,
      }))
    }
  }, [state.financeInFees, state.proposedLoanAmount])

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // ── Validation per step ──
  function canProceed(): boolean {
    if (step === 0) {
      return !!state.loanType && state.clientName.trim().length > 0
    }
    if (step === 1) {
      if (state.loanType === "refinance") {
        return !!(
          state.currentLoanAmount &&
          state.currentInterestRate &&
          (state.currentTenureYears !== undefined || state.currentTenureMonths !== undefined)
        )
      }
      return !!(state.propertyPurchasePrice)
    }
    if (step === 2) {
      return !!(
        state.proposedBankId &&
        state.proposedLoanAmount &&
        state.proposedInterestRate &&
        (state.proposedTenureYears !== undefined || state.proposedTenureMonths !== undefined)
      )
    }
    return true
  }

  function handleNext() {
    if (step === 0 && state.loanType !== "refinance") {
      // Skip step 1 (current loan) for subsale/developer
      setStep(2)
      return
    }
    if (step < 4) setStep((s) => s + 1)
  }

  function handleBack() {
    if (step === 2 && state.loanType !== "refinance") {
      setStep(0)
      return
    }
    if (step > 0) setStep((s) => s - 1)
  }

  function handleCalculate() {
    if (state.loanType === "refinance") {
      const currentTenureMonths =
        (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
      const proposedTenureMonths =
        (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)

      const r = calculateRefinance({
        currentLoanAmount: state.currentLoanAmount ?? 0,
        currentInterestRate: state.currentInterestRate ?? 0,
        currentMonthlyInstalment: state.currentMonthlyInstalment ?? 0,
        currentTenureMonths,
        proposedLoanAmount: state.proposedLoanAmount ?? 0,
        proposedInterestRate: state.proposedInterestRate ?? 0,
        proposedTenureMonths,
        financeInFees: state.financeInFees,
        legalFeeAmount: state.legalFeeAmount ?? 0,
        valuationFeeAmount: state.valuationFeeAmount ?? 0,
        stampDutyAmount: state.stampDutyAmount ?? 0,
        cashOutAmount: state.hasCashOut ? state.cashOutAmount ?? 0 : 0,
        cashOutTenureMonths: state.cashOutTenureMonths ?? 120,
      })
      setResults(r)
    } else {
      // For subsale/developer: compute simple new loan monthly
      const proposedTenureMonths =
        (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)
      const mi = calculateMonthlyInstalment(
        state.proposedLoanAmount ?? 0,
        state.proposedInterestRate ?? 0,
        proposedTenureMonths
      )
      // Build a partial results-like object
      const totalInterest = mi * proposedTenureMonths - (state.proposedLoanAmount ?? 0)
      setResults({
        currentRemainingInterest: 0,
        currentTotalRemaining: 0,
        proposedMonthlyInstalment: mi,
        proposedTotalInterest: totalInterest,
        proposedTotalAmount: mi * proposedTenureMonths,
        monthlySavings: 0,
        totalInterestSaved: 0,
        tenureSavedMonths: 0,
        effectiveTenureMonths: proposedTenureMonths,
        biweeklyPayment: 0,
        biweeklyTenureMonths: 0,
        biweeklyInterestSaved: 0,
        totalRefinancingCosts: 0,
        breakEvenMonths: 0,
        totalFeesFinanced: 0,
        effectiveLoanAmount: state.proposedLoanAmount ?? 0,
      })
    }
    setStep(4)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const currentTenureMonths =
        (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
      const proposedTenureMonths =
        (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)

      const response = await fetch("/api/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: state.clientName,
          client_ic: state.clientIc || null,
          client_phone: state.clientPhone || null,
          client_dob: state.clientDob || null,
          loan_type: state.loanType,
          current_bank: state.currentBank || null,
          current_loan_amount: state.currentLoanAmount ?? null,
          current_interest_rate: state.currentInterestRate ?? null,
          current_monthly_instalment: state.currentMonthlyInstalment ?? null,
          current_tenure_months: currentTenureMonths || null,
          proposed_bank_id: state.proposedBankId || null,
          proposed_loan_amount: state.proposedLoanAmount ?? null,
          proposed_interest_rate: state.proposedInterestRate ?? null,
          proposed_tenure_months: proposedTenureMonths || null,
          has_cash_out: state.hasCashOut,
          cash_out_amount: state.hasCashOut ? state.cashOutAmount ?? null : null,
          cash_out_tenure_months: state.cashOutTenureMonths ?? null,
          finance_legal_fees: state.financeInFees,
          legal_fee_amount: state.financeInFees ? state.legalFeeAmount ?? null : null,
          valuation_fee_amount: state.financeInFees ? state.valuationFeeAmount ?? null : null,
          stamp_duty_amount: state.financeInFees ? state.stampDutyAmount ?? null : null,
          results: results,
          referral_code: state.referralCode || null,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to save")
      }

      const data = await response.json()
      setSavedId(data.id)
      toast.success("Calculation saved successfully!")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save calculation"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ── Live preview sidebar ──
  const livePreview = React.useMemo(() => {
    if (step !== 2) return null
    if (!state.proposedLoanAmount || !state.proposedInterestRate) return null
    const tenureMonths =
      (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)
    if (tenureMonths === 0) return null
    const mi = calculateMonthlyInstalment(
      state.proposedLoanAmount,
      state.proposedInterestRate,
      tenureMonths
    )
    const savings = state.currentMonthlyInstalment
      ? state.currentMonthlyInstalment - mi
      : null
    return { mi, savings }
  }, [
    step,
    state.proposedLoanAmount,
    state.proposedInterestRate,
    state.proposedTenureYears,
    state.proposedTenureMonths,
    state.currentMonthlyInstalment,
  ])

  // ── Snowball/biweekly hints for step 4 ──
  const adviceHints = React.useMemo(() => {
    if (step !== 3) return null
    const tenureMonths =
      (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)
    if (!state.proposedLoanAmount || !state.proposedInterestRate || tenureMonths === 0) return null

    const bw = calculateBiweekly(state.proposedLoanAmount, state.proposedInterestRate, tenureMonths)
    const mi = calculateMonthlyInstalment(state.proposedLoanAmount, state.proposedInterestRate, tenureMonths)
    const totalInterest = mi * tenureMonths - state.proposedLoanAmount
    const biweeklySavingsPct = totalInterest > 0
      ? Math.round((bw.totalInterest / totalInterest - 1) * -100)
      : 0

    let snowballSaved = 0
    if (state.snowballExtra && state.snowballExtra > 0) {
      const sb = calculateSnowball(
        state.proposedLoanAmount,
        state.proposedInterestRate,
        tenureMonths,
        state.snowballExtra
      )
      snowballSaved = sb.saved
    }

    return { biweeklySavingsPct, snowballSaved }
  }, [
    step,
    state.proposedLoanAmount,
    state.proposedInterestRate,
    state.proposedTenureYears,
    state.proposedTenureMonths,
    state.snowballExtra,
  ])

  const currentStepForIndicator = step === 4 ? 4 : step

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agent/calculations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">New Calculation</h1>
          <p className="text-gray-500 text-sm mt-1">Calculate and compare loan options for your client</p>
        </div>
      </div>

      {/* Step Indicator */}
      <WizardStepIndicator steps={STEP_LABELS} currentStep={currentStepForIndicator} />

      {/* Step Content */}
      <div className={cn(
        "flex gap-6",
        step === 2 && livePreview && "lg:flex-row flex-col"
      )}>
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* ─── STEP 0: Loan Type + Client Info ─── */}
              {step === 0 && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg">What type of loan are you calculating?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <LoanTypeCard
                        type="refinance"
                        title="Refinance"
                        description="Compare existing loan with a new offer"
                        icon="🏠"
                        selected={state.loanType === "refinance"}
                        onSelect={(t) => update("loanType", t)}
                      />
                      <LoanTypeCard
                        type="subsale"
                        title="Subsale"
                        description="Purchase from secondary market"
                        icon="🏘️"
                        selected={state.loanType === "subsale"}
                        onSelect={(t) => update("loanType", t)}
                      />
                      <LoanTypeCard
                        type="developer"
                        title="Developer Purchase"
                        description="New property from developer"
                        icon="🏗️"
                        selected={state.loanType === "developer"}
                        onSelect={(t) => update("loanType", t)}
                      />
                    </CardContent>
                  </Card>

                  {state.loanType && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card>
                        <CardHeader>
                          <CardTitle className="font-heading text-lg">Client Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                              Client Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={state.clientName}
                              onChange={(e) => update("clientName", e.target.value)}
                              placeholder="Full name as per IC"
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">IC Number</label>
                            <input
                              type="text"
                              value={state.clientIc}
                              onChange={(e) => update("clientIc", e.target.value)}
                              placeholder="e.g. 901231-01-1234"
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Phone Number</label>
                            <input
                              type="tel"
                              value={state.clientPhone}
                              onChange={(e) => update("clientPhone", e.target.value)}
                              placeholder="e.g. 012-3456789"
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                              Date of Birth
                              <span className="text-xs text-gray-400 ml-1">(for max tenure)</span>
                            </label>
                            <input
                              type="date"
                              value={state.clientDob}
                              onChange={(e) => update("clientDob", e.target.value)}
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                            />
                            {maxTenureMonths !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                Max tenure: {monthsToYearsMonths(maxTenureMonths)} (until age 70)
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                              Referral Code
                              <span className="text-xs text-gray-400 ml-1">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={state.referralCode}
                              onChange={(e) => update("referralCode", e.target.value)}
                              placeholder="e.g. QAI001"
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ─── STEP 1: Current Loan Details ─── */}
              {step === 1 && (
                <div className="space-y-6">
                  {state.loanType === "refinance" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-heading text-lg">Current Loan Details</CardTitle>
                        <p className="text-sm text-gray-500">Enter your client&apos;s existing loan information</p>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Current Bank</label>
                          <input
                            type="text"
                            list="banks-list"
                            value={state.currentBank}
                            onChange={(e) => update("currentBank", e.target.value)}
                            placeholder="e.g. Maybank"
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                          />
                          <datalist id="banks-list">
                            {MALAYSIAN_BANKS.map((b) => <option key={b} value={b} />)}
                          </datalist>
                        </div>
                        <CurrencyInput
                          label="Outstanding Loan Amount *"
                          value={state.currentLoanAmount}
                          onChange={(v) => update("currentLoanAmount", v)}
                          placeholder="500,000"
                        />
                        <div>
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                            Current Interest Rate (% p.a.) *
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="20"
                              value={state.currentInterestRate ?? ""}
                              onChange={(e) => update("currentInterestRate", parseFloat(e.target.value) || undefined)}
                              placeholder="4.50"
                              className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                          </div>
                        </div>
                        <TenureInput
                          label="Remaining Tenure *"
                          years={state.currentTenureYears}
                          months={state.currentTenureMonths}
                          onChange={(y, m) => {
                            update("currentTenureYears", y)
                            update("currentTenureMonths", m)
                          }}
                          maxMonths={maxTenureMonths}
                        />
                        <CurrencyInput
                          label="Current Monthly Instalment"
                          value={state.currentMonthlyInstalment}
                          onChange={(v) => update("currentMonthlyInstalment", v)}
                          placeholder="Auto-calculated"
                          hint="Auto-calculated from above inputs, or edit manually"
                        />

                        {/* Loan type & Islamic */}
                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-2">Loan Type</label>
                            <div className="flex flex-col gap-1.5">
                              {(["term", "flexi", "semi_flexi"] as const).map((t) => (
                                <label key={t} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="loanTenureType"
                                    value={t}
                                    checked={state.loanTenureType === t}
                                    onChange={() => update("loanTenureType", t)}
                                    className="accent-[#C9A84C]"
                                  />
                                  <span className="text-sm text-gray-700 capitalize">
                                    {t.replace("_", "-")}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-[#0A1628] mb-2">Islamic?</label>
                              <button
                                type="button"
                                onClick={() => update("isIslamic", !state.isIslamic)}
                                className={cn(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                  state.isIslamic ? "bg-[#C9A84C]" : "bg-gray-200"
                                )}
                              >
                                <span className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                                  state.isIslamic ? "translate-x-6" : "translate-x-1"
                                )} />
                              </button>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#0A1628] mb-2">Lock-in Period?</label>
                              <button
                                type="button"
                                onClick={() => update("hasLockIn", !state.hasLockIn)}
                                className={cn(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                  state.hasLockIn ? "bg-[#C9A84C]" : "bg-gray-200"
                                )}
                              >
                                <span className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                                  state.hasLockIn ? "translate-x-6" : "translate-x-1"
                                )} />
                              </button>
                            </div>
                          </div>

                          {state.hasLockIn && (
                            <div>
                              <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                                Remaining Lock-in (months)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={state.lockInMonths ?? ""}
                                onChange={(e) => update("lockInMonths", parseInt(e.target.value) || undefined)}
                                placeholder="e.g. 12"
                                className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {state.loanType === "subsale" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-heading text-lg">Property Details (Subsale)</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <CurrencyInput
                          label="Property Purchase Price *"
                          value={state.propertyPurchasePrice}
                          onChange={(v) => update("propertyPurchasePrice", v)}
                          placeholder="500,000"
                        />
                        <div>
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                            Down Payment %
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={state.downPaymentPct}
                              onChange={(e) => update("downPaymentPct", parseFloat(e.target.value) || 10)}
                              className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                          </div>
                          {state.propertyPurchasePrice && (
                            <p className="text-xs text-gray-500 mt-1">
                              = {formatCurrency(state.propertyPurchasePrice * state.downPaymentPct / 100)}
                            </p>
                          )}
                        </div>
                        <CurrencyInput
                          label="Loan Amount (auto-calculated)"
                          value={state.proposedLoanAmount}
                          onChange={(v) => update("proposedLoanAmount", v)}
                          placeholder="450,000"
                          hint="Auto-calculated from purchase price and down payment"
                        />
                        <div>
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Property Type</label>
                          <select
                            value={state.propertyType}
                            onChange={(e) => update("propertyType", e.target.value)}
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          >
                            {PROPERTY_TYPES.map((pt) => (
                              <option key={pt.value} value={pt.value}>{pt.label}</option>
                            ))}
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {state.loanType === "developer" && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="font-heading text-lg">Property Details (Developer)</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <CurrencyInput
                          label="Property Purchase Price *"
                          value={state.propertyPurchasePrice}
                          onChange={(v) => update("propertyPurchasePrice", v)}
                          placeholder="500,000"
                        />
                        <div>
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Down Payment %</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="100"
                              value={state.downPaymentPct}
                              onChange={(e) => update("downPaymentPct", parseFloat(e.target.value) || 10)}
                              className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                          </div>
                          {state.propertyPurchasePrice && (
                            <p className="text-xs text-gray-500 mt-1">
                              = {formatCurrency(state.propertyPurchasePrice * state.downPaymentPct / 100)}
                            </p>
                          )}
                        </div>
                        <CurrencyInput
                          label="Loan Amount (auto-calculated)"
                          value={state.proposedLoanAmount}
                          onChange={(v) => update("proposedLoanAmount", v)}
                          placeholder="450,000"
                        />
                        <div>
                          <label className="block text-sm font-medium text-[#0A1628] mb-1.5">No. of Borrowers</label>
                          <select
                            value={state.numBorrowers}
                            onChange={(e) => update("numBorrowers", parseInt(e.target.value))}
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          >
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>{n} borrower{n > 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2 space-y-3 pt-2 border-t border-gray-100">
                          <p className="text-sm font-medium text-[#0A1628]">Developer Absorbs:</p>
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <button
                                type="button"
                                onClick={() => update("developerAbsorbsLegalFees", !state.developerAbsorbsLegalFees)}
                                className={cn(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                  state.developerAbsorbsLegalFees ? "bg-[#C9A84C]" : "bg-gray-200"
                                )}
                              >
                                <span className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                                  state.developerAbsorbsLegalFees ? "translate-x-6" : "translate-x-1"
                                )} />
                              </button>
                              <span className="text-sm text-gray-700">Legal Fees</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <button
                                type="button"
                                onClick={() => update("developerAbsorbsSpaStampDuty", !state.developerAbsorbsSpaStampDuty)}
                                className={cn(
                                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                  state.developerAbsorbsSpaStampDuty ? "bg-[#C9A84C]" : "bg-gray-200"
                                )}
                              >
                                <span className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                                  state.developerAbsorbsSpaStampDuty ? "translate-x-6" : "translate-x-1"
                                )} />
                              </button>
                              <span className="text-sm text-gray-700">SPA Stamp Duty</span>
                            </label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ─── STEP 2: Proposed Loan Details ─── */}
              {step === 2 && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg">Proposed / New Loan Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {/* Bank selector */}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                          Proposed Bank <span className="text-red-500">*</span>
                        </label>
                        {banksLoading ? (
                          <Skeleton className="h-10 w-full" />
                        ) : (
                          <select
                            value={state.proposedBankId}
                            onChange={(e) => {
                              const bank = banks.find((b) => b.id === e.target.value)
                              update("proposedBankId", e.target.value)
                              update("proposedBankName", bank?.name || "")
                              update("proposedBankCommissionRate", bank?.commission_rate || 0)
                            }}
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          >
                            <option value="">Select a bank...</option>
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} · {b.commission_rate}%
                              </option>
                            ))}
                          </select>
                        )}
                        {state.proposedBankCommissionRate > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Commission rate: {state.proposedBankCommissionRate}%
                          </p>
                        )}
                      </div>

                      <CurrencyInput
                        label="Proposed Loan Amount *"
                        value={state.proposedLoanAmount}
                        onChange={(v) => update("proposedLoanAmount", v)}
                        placeholder="500,000"
                        hint={
                          state.loanType === "refinance" && state.currentLoanAmount
                            ? `Outstanding: ${formatCurrency(state.currentLoanAmount)}`
                            : undefined
                        }
                      />

                      <div>
                        <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                          Proposed Interest Rate (% p.a.) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="20"
                            value={state.proposedInterestRate ?? ""}
                            onChange={(e) => update("proposedInterestRate", parseFloat(e.target.value) || undefined)}
                            placeholder="3.85"
                            className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                      </div>

                      <TenureInput
                        label="Proposed Tenure *"
                        years={state.proposedTenureYears}
                        months={state.proposedTenureMonths}
                        onChange={(y, m) => {
                          update("proposedTenureYears", y)
                          update("proposedTenureMonths", m)
                        }}
                        maxMonths={maxTenureMonths}
                      />

                      <div className="flex gap-2 pt-1">
                        {[35, 30, 25].map((yrs) => (
                          <button
                            key={yrs}
                            type="button"
                            onClick={() => {
                              update("proposedTenureYears", yrs)
                              update("proposedTenureMonths", 0)
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                              state.proposedTenureYears === yrs
                                ? "border-[#C9A84C] bg-[#FFFBEB] text-[#0A1628]"
                                : "border-gray-200 text-gray-500 hover:border-gray-300"
                            )}
                          >
                            {yrs}y
                          </button>
                        ))}
                      </div>

                      {/* Finance in fees toggle */}
                      <div className="sm:col-span-2 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-[#0A1628]">Finance in Legal / Valuation Fees?</p>
                            <p className="text-xs text-gray-500">Fees will be added to the loan amount</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => update("financeInFees", !state.financeInFees)}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                              state.financeInFees ? "bg-[#C9A84C]" : "bg-gray-200"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                              state.financeInFees ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>

                        {state.financeInFees && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-amber-50 rounded-xl border border-amber-200"
                          >
                            <CurrencyInput
                              label="Legal Fee"
                              value={state.legalFeeAmount}
                              onChange={(v) => update("legalFeeAmount", v)}
                              placeholder="Auto-calculated"
                            />
                            <CurrencyInput
                              label="Valuation Fee"
                              value={state.valuationFeeAmount}
                              onChange={(v) => update("valuationFeeAmount", v)}
                              placeholder="Auto-calculated"
                            />
                            <CurrencyInput
                              label="Stamp Duty (0.5%)"
                              value={state.stampDutyAmount}
                              onChange={() => {}}
                              readOnly
                            />
                            {(state.legalFeeAmount || state.valuationFeeAmount || state.stampDutyAmount) && (
                              <div className="sm:col-span-3 text-sm font-medium text-amber-800">
                                Total fees: {formatCurrency(
                                  (state.legalFeeAmount ?? 0) +
                                  (state.valuationFeeAmount ?? 0) +
                                  (state.stampDutyAmount ?? 0)
                                )} — will be added to loan amount
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* Cash out (Refinance only) */}
                      {state.loanType === "refinance" && (
                        <div className="sm:col-span-2 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-medium text-[#0A1628]">Cash Out?</p>
                              <p className="text-xs text-gray-500">Additional cash-out on top of refinancing</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => update("hasCashOut", !state.hasCashOut)}
                              className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                state.hasCashOut ? "bg-[#C9A84C]" : "bg-gray-200"
                              )}
                            >
                              <span className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                                state.hasCashOut ? "translate-x-6" : "translate-x-1"
                              )} />
                            </button>
                          </div>

                          {state.hasCashOut && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200"
                            >
                              <CurrencyInput
                                label="Cash Out Amount"
                                value={state.cashOutAmount}
                                onChange={(v) => update("cashOutAmount", v)}
                                placeholder="50,000"
                              />
                              <div>
                                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                                  Cash Out Tenure (months, max 120)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="120"
                                  value={state.cashOutTenureMonths ?? 120}
                                  onChange={(e) => update("cashOutTenureMonths", parseInt(e.target.value) || 120)}
                                  className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">Max 10 years = 120 months</p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ─── STEP 3: Advice Modules ─── */}
              {step === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">Advice Modules</CardTitle>
                    <p className="text-sm text-gray-500">Which insights to include in the report</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Always on */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-[#0A1628] rounded-lg flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-[#C9A84C]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0A1628]">Monthly Payment Comparison</p>
                          <p className="text-xs text-gray-500">Always included</p>
                        </div>
                      </div>
                      <div className="h-6 w-11 bg-[#C9A84C] rounded-full relative">
                        <span className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow" />
                      </div>
                    </div>

                    {/* Interest savings */}
                    <AdviceToggle
                      enabled={state.showInterestSavings}
                      onChange={() => update("showInterestSavings", !state.showInterestSavings)}
                      title="Interest Savings Over Loan Life"
                      hint="Shows total interest saved vs current loan"
                    />

                    {/* Bi-weekly */}
                    <AdviceToggle
                      enabled={state.showBiweekly}
                      onChange={() => update("showBiweekly", !state.showBiweekly)}
                      title="Bi-weekly Payment Strategy"
                      hint={
                        adviceHints && adviceHints.biweeklySavingsPct > 0
                          ? `Saves approx. ${adviceHints.biweeklySavingsPct}% interest`
                          : "Pay half-monthly every 2 weeks to save interest"
                      }
                    />

                    {/* Snowball */}
                    <div className={cn(
                      "p-4 rounded-xl border transition-colors",
                      state.showSnowball ? "bg-white border-[#C9A84C]" : "bg-gray-50 border-gray-200"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-[#0A1628]">Snowball Extra Payment</p>
                          <p className="text-xs text-gray-500">
                            {adviceHints && state.snowballExtra && adviceHints.snowballSaved > 0
                              ? `Saves ${formatCurrency(adviceHints.snowballSaved)} in interest`
                              : "Pay extra each month to reduce total interest"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => update("showSnowball", !state.showSnowball)}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            state.showSnowball ? "bg-[#C9A84C]" : "bg-gray-200"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
                            state.showSnowball ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                      {state.showSnowball && (
                        <CurrencyInput
                          label="Extra monthly payment"
                          value={state.snowballExtra}
                          onChange={(v) => update("snowballExtra", v)}
                          placeholder="500"
                        />
                      )}
                    </div>

                    {/* Break-even (Refinance only) */}
                    {state.loanType === "refinance" && (
                      <AdviceToggle
                        enabled={state.showBreakeven}
                        onChange={() => update("showBreakeven", !state.showBreakeven)}
                        title="Break-even Analysis"
                        hint="How many months to recover refinancing costs"
                      />
                    )}

                    {/* Cash out summary */}
                    {state.hasCashOut && (
                      <AdviceToggle
                        enabled={state.showCashOutSummary}
                        onChange={() => update("showCashOutSummary", !state.showCashOutSummary)}
                        title="Cash Out Summary"
                        hint="Separate breakdown of cash-out costs"
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ─── STEP 4 (Results) ─── */}
              {step === 4 && results && (
                <ResultsPanel
                  state={state}
                  results={results}
                  savedId={savedId}
                  saving={saving}
                  onSave={handleSave}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Live Preview Sidebar (Step 2 only, desktop) */}
        {step === 2 && livePreview && (
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-4">
              <Card className="border-[#C9A84C] border-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-[#0A1628]">Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">New Monthly Payment</p>
                    <p className="text-2xl font-bold text-[#0A1628] font-heading">
                      {formatCurrency(livePreview.mi)}
                    </p>
                  </div>
                  {livePreview.savings !== null && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Monthly Savings</p>
                      <p className={cn(
                        "text-xl font-bold font-heading",
                        livePreview.savings >= 0 ? "text-green-600" : "text-red-500"
                      )}>
                        {livePreview.savings >= 0 ? "+" : ""}{formatCurrency(livePreview.savings)}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Updates as you type. Full results on next step.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={handleBack} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step === 3 ? (
            <Button variant="gold" onClick={handleCalculate} size="lg">
              Calculate
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function NewCalculationPage() {
  return (
    <React.Suspense fallback={
      <div className="space-y-6 max-w-5xl">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-96 bg-white rounded-2xl border animate-pulse" />
      </div>
    }>
      <NewCalculationWizard />
    </React.Suspense>
  )
}

// ─────────────────────────── Sub-components ───────────────────────────

function AdviceToggle({
  enabled,
  onChange,
  title,
  hint,
}: {
  enabled: boolean
  onChange: () => void
  title: string
  hint: string
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl border transition-colors",
      enabled ? "bg-white border-[#C9A84C]" : "bg-gray-50 border-gray-200"
    )}>
      <div>
        <p className="text-sm font-medium text-[#0A1628]">{title}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4",
          enabled ? "bg-[#C9A84C]" : "bg-gray-200"
        )}
      >
        <span className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow",
          enabled ? "translate-x-6" : "translate-x-1"
        )} />
      </button>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={cn(
        "text-2xl font-bold font-heading",
        positive === true ? "text-green-600" :
        positive === false ? "text-red-500" : "text-[#0A1628]"
      )}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ResultsPanel({
  state,
  results,
  savedId,
  saving,
  onSave,
}: {
  state: WizardState
  results: RefinanceResults
  savedId: string | null
  saving: boolean
  onSave: () => void
}) {
  const router = useRouter()
  const isRefinance = state.loanType === "refinance"
  const currentTenureMonths =
    (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
  const proposedTenureMonths =
    (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)

  const snowballResult = React.useMemo(() => {
    if (!state.showSnowball || !state.snowballExtra || !state.proposedLoanAmount || !state.proposedInterestRate) return null
    return calculateSnowball(
      state.proposedLoanAmount,
      state.proposedInterestRate,
      proposedTenureMonths,
      state.snowballExtra
    )
  }, [state.showSnowball, state.snowballExtra, state.proposedLoanAmount, state.proposedInterestRate, proposedTenureMonths])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="font-heading text-xl font-bold text-[#0A1628]">Calculation Results</h2>
        <p className="text-sm text-gray-500 mt-1">
          {state.clientName} · {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Big metric cards */}
      {isRefinance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Monthly Savings"
            value={formatCurrency(results.monthlySavings)}
            sub="per month"
            positive={results.monthlySavings > 0}
          />
          <MetricCard
            label="Tenure Saved"
            value={results.tenureSavedMonths > 0 ? monthsToYearsMonths(results.tenureSavedMonths) : "—"}
            sub="if paying same instalment"
          />
          <MetricCard
            label="Total Interest Saved"
            value={formatCurrency(Math.max(0, results.totalInterestSaved))}
            sub="over loan life"
            positive={results.totalInterestSaved > 0}
          />
        </div>
      )}

      {!isRefinance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Monthly Payment"
            value={formatCurrency(results.proposedMonthlyInstalment)}
            sub="principal + interest"
          />
          <MetricCard
            label="Total Interest"
            value={formatCurrency(results.proposedTotalInterest)}
            sub="over loan life"
          />
        </div>
      )}

      {/* Plan comparison table */}
      {isRefinance && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-medium text-gray-500 w-1/3"></th>
                    <th className="text-right py-2 text-xs font-medium text-gray-500">Current Loan</th>
                    <th className="text-right py-2 text-xs font-medium text-[#0A1628]">New Loan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <CompRow
                    label="Loan Amount"
                    current={formatCurrency(state.currentLoanAmount ?? 0)}
                    proposed={formatCurrency(results.effectiveLoanAmount)}
                  />
                  <CompRow
                    label="Interest Rate"
                    current={`${state.currentInterestRate ?? 0}%`}
                    proposed={`${state.proposedInterestRate ?? 0}%`}
                  />
                  <CompRow
                    label="Monthly Payment"
                    current={formatCurrency(state.currentMonthlyInstalment ?? 0)}
                    proposed={formatCurrency(results.proposedMonthlyInstalment)}
                    highlight
                  />
                  <CompRow
                    label="Remaining Tenure"
                    current={monthsToYearsMonths(currentTenureMonths)}
                    proposed={monthsToYearsMonths(proposedTenureMonths)}
                  />
                  <CompRow
                    label="Total Interest"
                    current={formatCurrency(results.currentRemainingInterest)}
                    proposed={formatCurrency(results.proposedTotalInterest)}
                  />
                  <CompRow
                    label="Total Payment"
                    current={formatCurrency(results.currentTotalRemaining)}
                    proposed={formatCurrency(results.proposedTotalAmount)}
                    highlight
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash out box */}
      {state.hasCashOut && results.cashOutMonthlyInstalment && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-5">
            <p className="font-semibold text-[#0A1628] mb-3">Cash Out Summary</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Cash Out Amount</p>
                <p className="font-bold text-[#0A1628]">{formatCurrency(state.cashOutAmount ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Additional Monthly</p>
                <p className="font-bold text-[#0A1628]">{formatCurrency(results.cashOutMonthlyInstalment)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tenure</p>
                <p className="font-bold text-[#0A1628]">{monthsToYearsMonths(state.cashOutTenureMonths ?? 120)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advice modules */}
      <div className="space-y-4">
        {/* Bi-weekly */}
        {state.showBiweekly && results.biweeklyPayment > 0 && (
          <Card>
            <CardContent className="pt-5">
              <p className="font-semibold text-[#0A1628] mb-2">Bi-weekly Payment Strategy</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Bi-weekly Payment</p>
                  <p className="font-bold text-[#0A1628]">{formatCurrency(results.biweeklyPayment)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">New Tenure</p>
                  <p className="font-bold text-[#0A1628]">{monthsToYearsMonths(results.biweeklyTenureMonths)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Interest Saved</p>
                  <p className="font-bold text-green-600">{formatCurrency(results.biweeklyInterestSaved)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Snowball */}
        {state.showSnowball && snowballResult && (
          <Card>
            <CardContent className="pt-5">
              <p className="font-semibold text-[#0A1628] mb-2">
                Snowball: Extra {formatCurrency(state.snowballExtra ?? 0)}/month
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">New Tenure</p>
                  <p className="font-bold text-[#0A1628]">{monthsToYearsMonths(snowballResult.tenureMonths)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Interest Saved</p>
                  <p className="font-bold text-green-600">{formatCurrency(snowballResult.saved)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Interest</p>
                  <p className="font-bold text-[#0A1628]">{formatCurrency(snowballResult.totalInterest)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Break-even */}
        {state.showBreakeven && isRefinance && results.totalRefinancingCosts > 0 && (
          <Card>
            <CardContent className="pt-5">
              <p className="font-semibold text-[#0A1628] mb-2">Break-even Analysis</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Total Refinancing Costs</p>
                  <p className="font-bold text-[#0A1628]">{formatCurrency(results.totalRefinancingCosts)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Break-even Period</p>
                  <p className="font-bold text-[#0A1628]">
                    {results.breakEvenMonths < 9999 ? monthsToYearsMonths(results.breakEvenMonths) : "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
        {!savedId ? (
          <Button variant="gold" onClick={onSave} loading={saving}>
            <Save className="h-4 w-4" />
            Save Calculation
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            <CheckCircle className="h-4 w-4 text-green-600" />
            Saved
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => toast.info("PDF generation coming soon")}
        >
          <FileText className="h-4 w-4" />
          Generate PDF Report
        </Button>
        {savedId && (
          <Button
            variant="default"
            onClick={() => router.push(`/agent/cases/new?calc=${savedId}`)}
          >
            <ArrowRight className="h-4 w-4" />
            Convert to Case
          </Button>
        )}
      </div>
    </div>
  )
}

function CompRow({
  label,
  current,
  proposed,
  highlight,
}: {
  label: string
  current: string
  proposed: string
  highlight?: boolean
}) {
  return (
    <tr className={cn(highlight && "bg-amber-50")}>
      <td className="py-2.5 text-sm text-gray-500">{label}</td>
      <td className="py-2.5 text-sm text-right text-gray-700">{current}</td>
      <td className={cn("py-2.5 text-sm text-right font-semibold", highlight ? "text-[#0A1628]" : "text-[#0A1628]")}>
        {proposed}
      </td>
    </tr>
  )
}
