"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, CheckCircle, FileText, Loader2, Plus, Save, X } from "lucide-react"
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
  type RefinanceResults,
} from "@/lib/calculations/loan"
import {
  formatCurrency,
  formatDate,
  formatDateOnly,
  calcMaxTenureMonths,
  monthsToYearsMonths,
  cn,
} from "@/lib/utils"
import type { LoanType, Bank } from "@/types/database"

// ─────────────────────────── Types ───────────────────────────

interface CoBorrowerState {
  name: string
  ic: string
  phone: string
  email: string
  dob: string
  employer: string
  monthlyIncome: string
}

interface WizardState {
  // Step 1
  loanType: LoanType | null
  clientName: string
  clientIc: string
  clientAge: string           // alternative to IC/DOB — used only if no DOB derived
  clientPhone: string
  clientDob: string
  clientEmail: string
  clientEmployer: string
  clientMonthlyIncome: string
  referralCode: string
  coBorrowers: CoBorrowerState[]

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
  feesHasQuotation: boolean | null
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
  snowballScenario: "maintain_old" | "custom"
  showBreakeven: boolean
  showCashOutSummary: boolean
}

const initialState: WizardState = {
  loanType: null,
  clientName: "",
  clientIc: "",
  clientAge: "",
  clientPhone: "+60",
  clientDob: "",
  clientEmail: "",
  clientEmployer: "",
  clientMonthlyIncome: "",
  referralCode: "",
  coBorrowers: [],
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
  feesHasQuotation: null,
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
  snowballScenario: "custom",
  showBreakeven: true,
  showCashOutSummary: true,
}

const STEP_LABELS = ["Loan Type", "Current Loan", "New Loan", "Modules", "Results"]

const MALAYSIAN_BANKS = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "OCBC Bank", "UOB Malaysia", "Standard Chartered", "HSBC Bank Malaysia",
  "Alliance Bank", "Affin Bank", "Bank Islam", "Bank Muamalat", "BSN",
  "MBSB Bank", "Citibank Malaysia",
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
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isSavingCalcRef = React.useRef(false)

  const allDobs = [state.clientDob, ...state.coBorrowers.map(c => c.dob)].filter(Boolean)
  const maxTenureMonths = allDobs.length > 0
    ? Math.max(...allDobs.map(d => calcMaxTenureMonths(d)))
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

  // Auto-calc fees when no quotation: estimate 4% of loan amount
  React.useEffect(() => {
    if (state.financeInFees && state.feesHasQuotation === false && state.proposedLoanAmount) {
      const totalFees = Math.round(state.proposedLoanAmount * 0.04 * 100) / 100
      setState((s) => ({ ...s, legalFeeAmount: totalFees, valuationFeeAmount: 0 }))
    }
  }, [state.financeInFees, state.feesHasQuotation, state.proposedLoanAmount])

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // Auto-save to DB: 2 s after any state change (client name + loan type required)
  React.useEffect(() => {
    if (!state.clientName.trim() || !state.loanType) return
    const timer = setTimeout(async () => {
      if (isSavingCalcRef.current) return
      isSavingCalcRef.current = true
      setAutoSaveStatus('saving')
      try {
        const currentTenureMonths = (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
        const proposedTenureMonths = (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)
        const body = {
          client_name: state.clientName,
          client_ic: state.clientIc || null,
          client_phone: state.clientPhone || null,
          client_dob: state.clientDob || (state.clientAge ? `${new Date().getFullYear() - parseInt(state.clientAge)}-01-01` : null),
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
          results: results ?? null,
          referral_code: state.referralCode || null,
        }
        if (savedId) {
          const res = await fetch(`/api/calculations/${savedId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error()
        } else {
          const res = await fetch('/api/calculations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error()
          const data = await res.json()
          setSavedId(data.id)
        }
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 3000)
      } catch {
        setAutoSaveStatus('error')
      } finally {
        isSavingCalcRef.current = false
      }
    }, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, savedId, results])

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
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (step < 4) {
      setStep((s) => s + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  function handleBack() {
    if (step === 2 && state.loanType !== "refinance") {
      setStep(0)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (step > 0) {
      setStep((s) => s - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
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
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const currentTenureMonths =
        (state.currentTenureYears ?? 0) * 12 + (state.currentTenureMonths ?? 0)
      const proposedTenureMonths =
        (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)

      const body = {
        client_name: state.clientName,
        client_ic: state.clientIc || null,
        client_phone: state.clientPhone || null,
        client_dob: state.clientDob || (state.clientAge ? `${new Date().getFullYear() - parseInt(state.clientAge)}-01-01` : null),
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
      }

      // If auto-save already created the record, just PATCH with the final results
      if (savedId) {
        const response = await fetch(`/api/calculations/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Failed to save")
        }
        toast.success("Calculation saved!")
      } else {
        const response = await fetch("/api/calculations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || "Failed to save")
        }
        const data = await response.json()
        setSavedId(data.id)
        toast.success("Calculation saved successfully!")
      }
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

  // ── Proposed MI + snowball extras for refinancing scenarios ──
  const proposedMI = React.useMemo(() => {
    const tenureMonths = (state.proposedTenureYears ?? 0) * 12 + (state.proposedTenureMonths ?? 0)
    if (!state.proposedLoanAmount || !state.proposedInterestRate || tenureMonths === 0) return 0
    return calculateMonthlyInstalment(state.proposedLoanAmount, state.proposedInterestRate, tenureMonths)
  }, [state.proposedLoanAmount, state.proposedInterestRate, state.proposedTenureYears, state.proposedTenureMonths])

  const maintainOldExtra = state.loanType === "refinance" && state.currentMonthlyInstalment && proposedMI > 0
    ? Math.max(0, Math.round((state.currentMonthlyInstalment - proposedMI) * 100) / 100)
    : 0

  const effectiveSnowballExtra = state.showSnowball
    ? (state.snowballScenario === "maintain_old" && maintainOldExtra > 0 ? maintainOldExtra : state.snowballExtra)
    : undefined

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
      const sb = calculateSnowball(state.proposedLoanAmount, state.proposedInterestRate, tenureMonths, state.snowballExtra)
      snowballSaved = totalInterest > 0 ? (totalInterest - sb.totalInterest) : 0
    }

    return { biweeklySavingsPct, snowballSaved }
  }, [
    step,
    state.proposedLoanAmount,
    state.proposedInterestRate,
    state.proposedTenureYears,
    state.proposedTenureMonths,
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
                              onChange={(e) => {
                                const ic = e.target.value
                                update("clientIc", ic)
                                const digits = ic.replace(/\D/g, "")
                                if (digits.length >= 6) {
                                  const yy = parseInt(digits.substring(0, 2))
                                  const mm = digits.substring(2, 4)
                                  const dd = digits.substring(4, 6)
                                  const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000
                                  const dob = `${century + yy}-${mm}-${dd}`
                                  const age = String(new Date().getFullYear() - (century + yy))
                                  setState(s => ({ ...s, clientIc: ic, clientDob: dob, clientAge: age }))
                                }
                              }}
                              placeholder="901231011234 (without dashes)"
                              maxLength={14}
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">Enter 12 digits without dashes — DOB will auto-fill</p>
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
                            {/* Text input always shows DD/MM/YYYY — avoids browser locale MM/DD/YYYY confusion */}
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="DD/MM/YYYY"
                              value={state.clientDob ? (() => { const [y,m,d] = state.clientDob.split('-'); return `${d}/${m}/${y}` })() : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d/]/g, "")
                                // Accept free typing; parse when full DD/MM/YYYY is entered
                                if (raw.length === 10 && raw.includes('/')) {
                                  const parts = raw.split('/')
                                  if (parts.length === 3) {
                                    const [dd, mm, yyyy] = parts
                                    const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
                                    const parsed = new Date(iso + "T00:00:00")
                                    if (!isNaN(parsed.getTime())) {
                                      const age = String(new Date().getFullYear() - parsed.getFullYear())
                                      setState(s => ({ ...s, clientDob: iso, clientAge: age }))
                                      return
                                    }
                                  }
                                }
                                // Partial entry — keep as-is (don't wipe clientDob)
                              }}
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                            {state.clientDob ? (
                              <p className="text-xs text-green-600 mt-1 font-medium">
                                ✓ DOB: {(() => { const [y,m,d] = state.clientDob.split('-'); return `${d}/${m}/${y}` })()}
                                {maxTenureMonths !== undefined && ` · Max tenure: ${monthsToYearsMonths(maxTenureMonths)}`}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-1">Auto-filled from IC · or enter age below</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                              Age (years)
                              <span className="text-xs text-gray-400 ml-1">(if no IC/DOB yet)</span>
                            </label>
                            <input
                              type="number"
                              min={18}
                              max={70}
                              value={state.clientAge}
                              onChange={(e) => {
                                const age = e.target.value
                                update("clientAge", age)
                                // Only derive DOB from age if IC/DOB not already set
                                if (age && !state.clientDob) {
                                  const year = new Date().getFullYear() - parseInt(age)
                                  if (!isNaN(year)) update("clientDob", `${year}-01-01`)
                                }
                              }}
                              placeholder="e.g. 35"
                              className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent placeholder:text-gray-400"
                            />
                            <p className="text-xs text-gray-400 mt-1">Used for 70-year max tenure check</p>
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

                      {/* Co-Borrowers Card */}
                      <Card className="mt-6">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="font-heading text-lg">Co-Borrowers</CardTitle>
                            <p className="text-gray-500 text-xs mt-1">Add up to 3 co-borrowers</p>
                          </div>
                          {state.coBorrowers.length < 3 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                update("coBorrowers", [
                                  ...state.coBorrowers,
                                  { name: "", ic: "", phone: "", email: "", dob: "", employer: "", monthlyIncome: "" }
                                ])
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Co-Borrower
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {state.coBorrowers.length === 0 ? (
                            <p className="text-sm text-gray-400">No co-borrowers added.</p>
                          ) : (
                            state.coBorrowers.map((cb, idx) => (
                              <div key={idx} className="p-4 border border-gray-100 rounded-lg relative bg-gray-50/50">
                                <button
                                  onClick={() => {
                                    const newCb = [...state.coBorrowers]
                                    newCb.splice(idx, 1)
                                    update("coBorrowers", newCb)
                                  }}
                                  className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                                <h4 className="text-sm font-semibold mb-4">Co-Borrower {idx + 1}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-[#0A1628] mb-1.5">Full Name</label>
                                    <input
                                      type="text"
                                      value={cb.name}
                                      onChange={(e) => {
                                        const newCb = [...state.coBorrowers]; newCb[idx].name = e.target.value; update("coBorrowers", newCb)
                                      }}
                                      className="w-full h-9 px-3 text-xs rounded-md border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-[#0A1628] mb-1.5">IC Number</label>
                                    <input
                                      type="text"
                                      value={cb.ic}
                                      onChange={(e) => {
                                        const newCb = [...state.coBorrowers]
                                        const ic = e.target.value
                                        newCb[idx].ic = ic
                                        const digits = ic.replace(/\D/g, "")
                                        if (digits.length >= 6) {
                                          const yy = parseInt(digits.substring(0, 2))
                                          const mm = digits.substring(2, 4)
                                          const dd = digits.substring(4, 6)
                                          const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000
                                          newCb[idx].dob = `${century + yy}-${mm}-${dd}`
                                        }
                                        update("coBorrowers", newCb)
                                      }}
                                      className="w-full h-9 px-3 text-xs rounded-md border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-[#0A1628] mb-1.5">Date of Birth</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="DD/MM/YYYY"
                                      value={cb.dob ? (() => { const [y,m,d] = cb.dob.split('-'); return `${d}/${m}/${y}` })() : ""}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^\d/]/g, "")
                                        if (raw.length === 10 && raw.includes('/')) {
                                          const parts = raw.split('/')
                                          if (parts.length === 3) {
                                            const [dd, mm, yyyy] = parts
                                            const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
                                            if (!isNaN(new Date(iso + "T00:00:00").getTime())) {
                                              const newCb = [...state.coBorrowers]; newCb[idx].dob = iso; update("coBorrowers", newCb)
                                            }
                                          }
                                        }
                                      }}
                                      className="w-full h-9 px-3 text-xs rounded-md border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-1 focus:ring-[#C9A84C] placeholder:text-gray-400"
                                    />
                                    {cb.dob && <p className="text-xs text-green-600 mt-0.5">✓ {(() => { const [y,m,d] = cb.dob.split('-'); return `${d}/${m}/${y}` })()}</p>}
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-[#0A1628] mb-1.5">Phone</label>
                                    <input
                                      type="tel"
                                      value={cb.phone}
                                      onChange={(e) => {
                                        const newCb = [...state.coBorrowers]; newCb[idx].phone = e.target.value; update("coBorrowers", newCb)
                                      }}
                                      className="w-full h-9 px-3 text-xs rounded-md border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
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
                          <select
                            value={state.currentBank}
                            onChange={(e) => update("currentBank", e.target.value)}
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          >
                            <option value="">Select a bank...</option>
                            {MALAYSIAN_BANKS.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
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
                              if (bank?.interest_rate) {
                                update("proposedInterestRate", bank.interest_rate)
                              }
                            }}
                            className="w-full h-10 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                          >
                            <option value="">Select a bank...</option>
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
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
                            className="p-4 bg-amber-50 rounded-xl border border-amber-200 mt-3"
                          >
                            <div className="mb-4">
                              <p className="text-sm font-medium text-[#0A1628] mb-2">Do you have a quotation from a valuer/lawyer?</p>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="feesQuotation" checked={state.feesHasQuotation === true} onChange={() => update("feesHasQuotation", true)} className="accent-[#C9A84C]" />
                                  <span className="text-sm">Yes, exact quote</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" name="feesQuotation" checked={state.feesHasQuotation === false} onChange={() => update("feesHasQuotation", false)} className="accent-[#C9A84C]" />
                                  <span className="text-sm">No, estimate (4%)</span>
                                </label>
                              </div>
                            </div>
                            
                            {state.feesHasQuotation === true && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <CurrencyInput
                                  label="Legal Fee"
                                  value={state.legalFeeAmount}
                                  onChange={(v) => update("legalFeeAmount", v)}
                                  placeholder="Exact amount"
                                />
                                <CurrencyInput
                                  label="Valuation Fee"
                                  value={state.valuationFeeAmount}
                                  onChange={(v) => update("valuationFeeAmount", v)}
                                  placeholder="Exact amount"
                                />
                              </div>
                            )}

                            {state.feesHasQuotation === false && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-amber-800">
                                  Estimated Total Fees (4% of loan):{' '}
                                  {state.proposedLoanAmount
                                    ? `RM ${(state.proposedLoanAmount * 0.04).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
                                    : 'Enter loan amount above'}
                                </div>
                                {state.proposedLoanAmount && (
                                  <p className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
                                    Effective Loan Amount with Fees:{' '}
                                    RM {(state.proposedLoanAmount * 1.04).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>
                            )}

                            {state.feesHasQuotation === true && (state.legalFeeAmount || state.valuationFeeAmount) && (
                              <div className="mt-3 space-y-1">
                                <div className="text-sm font-medium text-amber-800">
                                  Total fees to add: {formatCurrency((state.legalFeeAmount ?? 0) + (state.valuationFeeAmount ?? 0))}
                                </div>
                                {state.proposedLoanAmount && (
                                  <p className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
                                    Effective Loan Amount with Fees:{' '}
                                    RM {(state.proposedLoanAmount + (state.legalFeeAmount ?? 0) + (state.valuationFeeAmount ?? 0)).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
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
                            {adviceHints && effectiveSnowballExtra && adviceHints.snowballSaved > 0
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
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          {state.loanType === "refinance" && maintainOldExtra > 0 && (
                            <div className="flex gap-4 mb-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={state.snowballScenario === "maintain_old"} onChange={() => update("snowballScenario", "maintain_old")} className="accent-[#C9A84C]" />
                                <span className="text-sm">Maintain old instalment (+{formatCurrency(maintainOldExtra)})</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={state.snowballScenario === "custom"} onChange={() => update("snowballScenario", "custom")} className="accent-[#C9A84C]" />
                                <span className="text-sm">Custom extra</span>
                              </label>
                            </div>
                          )}
                          {state.snowballScenario === "maintain_old" && state.loanType === "refinance" ? (
                            <div className="text-sm text-[#0A1628]">
                              Extra: <span className="font-semibold">{formatCurrency(maintainOldExtra)}/mo</span>
                            </div>
                          ) : (
                            <CurrencyInput
                              label="Extra monthly payment"
                              value={state.snowballExtra}
                              onChange={(v) => update("snowballExtra", v)}
                              placeholder="500"
                            />
                          )}
                        </div>
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
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleBack} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />Saving…
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle className="w-3 h-3" />Saved
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-xs text-red-400">Auto-save failed</span>
            )}
          </div>

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
    const proposedMI = state.proposedLoanAmount && state.proposedInterestRate && proposedTenureMonths > 0
      ? calculateMonthlyInstalment(state.proposedLoanAmount, state.proposedInterestRate, proposedTenureMonths)
      : 0
      
    const maintainOldExtra = state.loanType === "refinance" && state.currentMonthlyInstalment && proposedMI > 0
      ? Math.max(0, Math.round((state.currentMonthlyInstalment - proposedMI) * 100) / 100)
      : 0

    const effectiveSnowballExtra = state.showSnowball
      ? (state.snowballScenario === "maintain_old" && maintainOldExtra > 0 ? maintainOldExtra : state.snowballExtra)
      : undefined

    if (!state.showSnowball || !effectiveSnowballExtra || !state.proposedLoanAmount || !state.proposedInterestRate) return null
    return calculateSnowball(
      state.proposedLoanAmount,
      state.proposedInterestRate,
      proposedTenureMonths,
      effectiveSnowballExtra
    )
  }, [state.showSnowball, state.snowballScenario, state.loanType, state.currentMonthlyInstalment, state.snowballExtra, state.proposedLoanAmount, state.proposedInterestRate, proposedTenureMonths])

  const effectiveSnowballExtra = state.showSnowball
    ? (state.snowballScenario === "maintain_old" && state.loanType === "refinance" && state.currentMonthlyInstalment
        ? Math.max(0, state.currentMonthlyInstalment - (state.proposedLoanAmount && state.proposedInterestRate && proposedTenureMonths > 0 ? calculateMonthlyInstalment(state.proposedLoanAmount, state.proposedInterestRate, proposedTenureMonths) : 0))
        : state.snowballExtra)
    : undefined

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
                Snowball: Extra {formatCurrency(effectiveSnowballExtra ?? 0)}/month
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
          onClick={() => {
            if (!savedId) {
              toast.info("Save the calculation first, then generate the PDF report.")
            } else {
              window.open(`/agent/calculations/${savedId}/print`, "_blank")
            }
          }}
          disabled={state.loanType !== "refinance"}
          title={state.loanType !== "refinance" ? "PDF report only available for Refinance" : undefined}
        >
          <FileText className="h-4 w-4" />
          Generate PDF Report
        </Button>
        {savedId && (
          <Button
            variant="default"
            onClick={() => router.push(`/agent/cases/new?from_calculation=${savedId}`)}
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
