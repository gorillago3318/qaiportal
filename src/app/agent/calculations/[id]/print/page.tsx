"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Printer, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  calculateMonthlyInstalment,
  calculateTotalInterest,
} from "@/lib/calculations/loan"
import { formatCurrency, monthsToYearsMonths } from "@/lib/utils"

interface CalcData {
  id: string
  client_name: string
  client_ic: string | null
  loan_type: string
  current_bank: string | null
  current_loan_amount: number | null
  current_interest_rate: number | null
  current_monthly_instalment: number | null
  current_tenure_months: number | null
  proposed_loan_amount: number | null
  proposed_interest_rate: number | null
  proposed_tenure_months: number | null
  finance_legal_fees: boolean
  legal_fee_amount: number | null
  valuation_fee_amount: number | null
  stamp_duty_amount: number | null
  has_cash_out: boolean
  cash_out_amount: number | null
  cash_out_tenure_months: number | null
  converted_to_case_id: string | null
  proposed_bank?: { name: string } | null
  created_at: string
}

export default function CalculationPrintPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [calc, setCalc] = React.useState<CalcData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [agentName, setAgentName] = React.useState('')
  const [agentPhone, setAgentPhone] = React.useState('')
  const [aiText, setAiText] = React.useState<string | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).single()
        .then(({ data: p }) => {
          if (!p) return
          const prof = p as { full_name?: string; phone?: string }
          setAgentName(prof.full_name || '')
          setAgentPhone(prof.phone || '')
        })
    })
  }, [])

  React.useEffect(() => {
    if (!calc?.client_name) return
    const original = document.title
    document.title = calc.client_name
    return () => { document.title = original }
  }, [calc?.client_name])

  React.useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase
      .from("calculations")
      .select("*, proposed_bank:banks(name)")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError("Calculation not found.")
        else setCalc(data as unknown as CalcData)
        setLoading(false)
      })
  }, [id])

  // Fetch AI analysis once calc data is ready
  React.useEffect(() => {
    if (!calc || calc.loan_type !== 'refinance') return
    const { current_loan_amount: curAmt, current_interest_rate: curRate,
      current_monthly_instalment: curInstalment, current_tenure_months: curTenure,
      proposed_loan_amount: propAmt, proposed_interest_rate: propRate, proposed_tenure_months: propTenure } = calc
    if (!curAmt || !curRate || !curInstalment || !curTenure || !propAmt || !propRate || !propTenure) return

    const legalFee = calc.legal_fee_amount ?? 0
    const valuationFee = calc.valuation_fee_amount ?? 0
    const stampDuty = calc.stamp_duty_amount ?? 0
    const financeInFees = calc.finance_legal_fees ?? false
    const effectiveLoanAmt = financeInFees ? propAmt + legalFee + valuationFee + stampDuty : propAmt

    const newMonthly = calculateMonthlyInstalment(effectiveLoanAmt, propRate, propTenure)
    const monthlySavings = curInstalment - newMonthly
    const currentRemainingInterest = Math.max(0, curInstalment * curTenure - curAmt)
    const newTotalInterest = calculateTotalInterest(effectiveLoanAmt, propRate, propTenure)
    const totalInterestSaved = currentRemainingInterest - newTotalInterest

    const accelTenureMonths = (() => {
      if (propRate === 0) return Math.ceil(effectiveLoanAmt / curInstalment)
      const r = propRate / 100 / 12
      const x = 1 - (effectiveLoanAmt * r) / curInstalment
      if (x <= 0) return 1
      return Math.ceil(-Math.log(x) / Math.log(1 + r))
    })()
    const accelTotalInterest = curInstalment * accelTenureMonths - effectiveLoanAmt
    const accelInterestSaved = newTotalInterest - Math.max(0, accelTotalInterest)

    const biweeklyPayment = curInstalment / 2
    const biweeklyRate = propRate / 100 / 26
    let biweeklyTenurePeriods: number
    if (propRate === 0) {
      biweeklyTenurePeriods = effectiveLoanAmt / biweeklyPayment
    } else {
      const x = 1 - (effectiveLoanAmt * biweeklyRate) / biweeklyPayment
      biweeklyTenurePeriods = x <= 0 ? 1 : -Math.log(x) / Math.log(1 + biweeklyRate)
    }
    const biweeklyTenureMonths = Math.ceil((biweeklyTenurePeriods / 26) * 12)
    const biweeklyTotalInterest = biweeklyPayment * biweeklyTenurePeriods - effectiveLoanAmt
    const biweeklyInterestSaved = newTotalInterest - Math.max(0, biweeklyTotalInterest)

    const amounts = [Math.max(0, totalInterestSaved), Math.max(0, accelInterestSaved), Math.max(0, biweeklyInterestSaved)]
    const bestIdx = amounts.indexOf(Math.max(...amounts))
    const noSavings = Math.max(...amounts) <= 0

    setAiLoading(true)
    fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentBank: calc.current_bank || 'Current Bank',
        proposedBank: calc.proposed_bank?.name || 'Proposed Bank',
        currentRate: curRate,
        propRate,
        monthlySavings,
        totalInterestSaved: Math.max(0, totalInterestSaved),
        accelInterestSaved: Math.max(0, accelInterestSaved),
        biweeklyInterestSaved: Math.max(0, biweeklyInterestSaved),
        accelTenureMonths,
        biweeklyTenureMonths,
        propTenure,
        noSavings,
        bestIdx,
        curInstalment,
        effectiveLoanAmt,
      }),
    })
      .then(r => r.json())
      .then(j => { if (j.text) setAiText(j.text) })
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [calc])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-gray-400 text-sm">Loading report…</div>
    </div>
  )
  if (error || !calc) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error || "Not found"}</p>
        <button onClick={() => router.back()} className="text-sm text-gray-500 underline">Go back</button>
      </div>
    </div>
  )
  if (calc.loan_type !== "refinance") return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-gray-600 mb-2">PDF report is only available for Refinance calculations.</p>
        <button onClick={() => router.back()} className="text-sm text-[#0A1628] underline">Go back</button>
      </div>
    </div>
  )

  const { current_loan_amount: curAmt, current_interest_rate: curRate,
    current_monthly_instalment: curInstalment, current_tenure_months: curTenure,
    proposed_loan_amount: propAmt, proposed_interest_rate: propRate, proposed_tenure_months: propTenure } = calc

  if (!curAmt || !curRate || !curInstalment || !curTenure || !propAmt || !propRate || !propTenure) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-gray-600 mb-2">Incomplete calculation data.</p>
        <button onClick={() => router.back()} className="text-sm text-[#0A1628] underline">Go back</button>
      </div>
    </div>
  )

  // ── Compute ───────────────────────────────────────────────────────
  const legalFee = calc.legal_fee_amount ?? 0
  const valuationFee = calc.valuation_fee_amount ?? 0
  const stampDuty = calc.stamp_duty_amount ?? 0
  const totalRefinancingCosts = legalFee + valuationFee + stampDuty
  const financeInFees = calc.finance_legal_fees ?? false
  const effectiveLoanAmt = financeInFees ? propAmt + legalFee + valuationFee + stampDuty : propAmt

  const newMonthly = calculateMonthlyInstalment(effectiveLoanAmt, propRate, propTenure)
  const monthlySavings = curInstalment - newMonthly
  const currentRemainingInterest = Math.max(0, curInstalment * curTenure - curAmt)
  const newTotalInterest = calculateTotalInterest(effectiveLoanAmt, propRate, propTenure)
  const totalInterestSaved = currentRemainingInterest - newTotalInterest
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(totalRefinancingCosts / monthlySavings) : 9999

  const accelTenureMonths = (() => {
    if (propRate === 0) return Math.ceil(effectiveLoanAmt / curInstalment)
    const r = propRate / 100 / 12
    const x = 1 - (effectiveLoanAmt * r) / curInstalment
    if (x <= 0) return 1
    return Math.ceil(-Math.log(x) / Math.log(1 + r))
  })()
  const tenureSavedMonths = Math.max(0, propTenure - accelTenureMonths)
  const accelTotalInterest = curInstalment * accelTenureMonths - effectiveLoanAmt
  const accelInterestSaved = newTotalInterest - Math.max(0, accelTotalInterest)

  const biweeklyPayment = curInstalment / 2
  const biweeklyRate = propRate / 100 / 26
  let biweeklyTenurePeriods: number
  if (propRate === 0) {
    biweeklyTenurePeriods = effectiveLoanAmt / biweeklyPayment
  } else {
    const x = 1 - (effectiveLoanAmt * biweeklyRate) / biweeklyPayment
    biweeklyTenurePeriods = x <= 0 ? 1 : -Math.log(x) / Math.log(1 + biweeklyRate)
  }
  const biweeklyTenureMonths = Math.ceil((biweeklyTenurePeriods / 26) * 12)
  const biweeklyTotalInterest = biweeklyPayment * biweeklyTenurePeriods - effectiveLoanAmt
  const biweeklyInterestSaved = newTotalInterest - Math.max(0, biweeklyTotalInterest)
  const biweeklyTenureSaved = Math.max(0, propTenure - biweeklyTenureMonths)

  const amounts = [Math.max(0, totalInterestSaved), Math.max(0, accelInterestSaved), Math.max(0, biweeklyInterestSaved)]
  const bestIdx = amounts.indexOf(Math.max(...amounts))
  const biggestSaved = amounts[bestIdx]
  const rateDiff = (curRate - propRate).toFixed(2)

  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })
  const currentBankName = calc.current_bank || "Current Bank"
  const proposedBankName = calc.proposed_bank?.name || "Proposed Bank"
  const noSavings = biggestSaved <= 0

  const scenarios = [
    {
      number: 1,
      title: "Lower Monthly Payments",
      desc: "Pay the new reduced instalment and enjoy immediate cash flow relief every month.",
      monthly: formatCurrency(newMonthly),
      tenure: monthsToYearsMonths(propTenure),
      saved: Math.max(0, totalInterestSaved),
      highlight: "RM " + newMonthly.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "/mo",
      highlightLabel: "New monthly",
      best: bestIdx === 0,
    },
    {
      number: 2,
      title: "Pay Off Faster",
      desc: "Keep paying the same amount on the lower-rate loan — clear your debt years earlier.",
      monthly: formatCurrency(curInstalment),
      tenure: monthsToYearsMonths(accelTenureMonths),
      saved: Math.max(0, accelInterestSaved),
      highlight: tenureSavedMonths > 0 ? monthsToYearsMonths(tenureSavedMonths) + " earlier" : monthsToYearsMonths(accelTenureMonths),
      highlightLabel: "Finish loan",
      best: bestIdx === 1,
    },
    {
      number: 3,
      title: "Bi-Weekly Turbo",
      desc: "Pay half your instalment every 2 weeks — 26 payments a year instead of 24.",
      monthly: formatCurrency(biweeklyPayment) + " × 2/wk",
      tenure: monthsToYearsMonths(biweeklyTenureMonths),
      saved: Math.max(0, biweeklyInterestSaved),
      highlight: biweeklyTenureSaved > 0 ? monthsToYearsMonths(biweeklyTenureSaved) + " earlier" : monthsToYearsMonths(biweeklyTenureMonths),
      highlightLabel: "Finish loan",
      best: bestIdx === 2,
    },
  ]

  const waLink = "https://wa.me/60126181683"
  const RED = "#E30613"

  const accelTotalInterestClean = Math.max(0, accelTotalInterest)
  const biweeklyTotalInterestClean = Math.max(0, biweeklyTotalInterest)
  const maxChartInterest = Math.max(currentRemainingInterest, newTotalInterest, accelTotalInterestClean, biweeklyTotalInterestClean, 1)
  const maxChartTenure = Math.max(curTenure, propTenure, accelTenureMonths, biweeklyTenureMonths, 1)

  const interestBars = [
    { label: `Current · ${currentBankName}`, val: currentRemainingInterest,   color: RED,       saving: null as number | null },
    { label: "Option 1 · Lower Payments",    val: newTotalInterest,           color: "#059669", saving: Math.max(0, totalInterestSaved) },
    { label: "Option 2 · Pay Faster",        val: accelTotalInterestClean,    color: "#059669", saving: Math.max(0, accelInterestSaved) },
    { label: "Option 3 · Bi-Weekly Turbo",   val: biweeklyTotalInterestClean, color: "#059669", saving: Math.max(0, biweeklyInterestSaved) },
  ]

  const timelineBars = [
    { label: `Current · ${currentBankName}`, months: curTenure,            color: RED       },
    { label: "Option 1 · Lower Payments",    months: propTenure,           color: "#94a3b8" },
    { label: "Option 2 · Pay Faster",        months: accelTenureMonths,    color: "#059669" },
    { label: "Option 3 · Bi-Weekly Turbo",   months: biweeklyTenureMonths, color: "#059669" },
  ]

  const disclaimerText = `For illustration purposes only. Actual results may vary based on loan terms and bank policies. Assumes reducing-balance amortisation. Bi-weekly scenario assumes 26 payments/year. Please consult a licensed financial advisor before making any financial decisions. Generated by QuantifyAI Portal · ${today}`

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          aside, header { display: none !important; }
          .portal-layout { overflow: visible !important; height: auto !important; }
          .portal-main   { overflow: visible !important; }
          .portal-content{ padding: 0 !important; overflow: visible !important; height: auto !important; }
          .no-print      { display: none !important; }
          html, body     { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pdf-wrapper   { background: transparent !important; padding: 0 !important; gap: 0 !important; }
          .print-page    { width: 210mm; max-width: 210mm; margin: 0; box-shadow: none !important; }
          .page-2        { page-break-before: always; }
          a              { text-decoration: none !important; }
          .bar-track     { background: #e5e7eb !important; }
        }
        .doc-shadow { box-shadow: 0 12px 48px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06); }
        .pdf-wrapper { background: #d1d5db; padding: 2rem 1rem; min-height: calc(100vh - 52px); display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
        .bar-track { background: #f1f5f9; border-radius: 9999px; overflow: hidden; }
        .card-rec  { border: 2px solid #E30613; box-shadow: 0 6px 24px rgba(227,6,19,0.13); }
        .card-std  { border: 1.5px solid #E5E7EB; }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="no-print sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">2-page A4 · no margins · &ldquo;{calc.client_name}.pdf&rdquo;</span>
          {/* Create Case CTA */}
          {calc.converted_to_case_id ? (
            <Link
              href={`/agent/cases/${calc.converted_to_case_id}`}
              className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              View Case <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href={`/agent/cases/new?from_calculation=${calc.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#0A1628] bg-amber-50 border border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Create Case <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 text-white px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: RED }}>
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>
      <div className="no-print py-1.5 text-center text-[10px] uppercase tracking-widest text-gray-400 bg-[#d1d5db]">Page 1 of 2</div>

      <div className="pdf-wrapper">

        {/* ══════════════════════════════════════
            PAGE 1 — Hero + 3 Scenarios + AI Analysis
        ══════════════════════════════════════ */}
        <div className="print-page w-full max-w-[794px] bg-white doc-shadow flex flex-col">

          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-8 py-4 print:px-7 print:py-3.5" style={{ borderBottom: `3px solid ${RED}` }}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-md shrink-0" style={{ background: RED }}>
                <span className="text-white font-black text-[15px]">Q</span>
              </div>
              <div>
                <div className="text-[14px] font-black text-gray-900 tracking-tight leading-none">QuantifyAI</div>
                <div className="text-[8.5px] font-bold uppercase tracking-[0.16em] mt-0.5" style={{ color: RED }}>Refinance Intelligence</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[8px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Personalised Report For</div>
              <div className="text-[16px] font-black text-gray-900">{calc.client_name}</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-gray-400 uppercase tracking-[0.12em] mb-0.5">Report Date</div>
              <div className="text-[12px] font-bold text-gray-700">{today}</div>
            </div>
          </div>

          {/* Hero */}
          <div className="shrink-0 px-8 pt-8 pb-7 print:px-7 print:pt-7 print:pb-6" style={{ background: RED }}>
            {noSavings ? (
              <div className="text-center py-2">
                <div className="inline-block text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 bg-white/10 px-3 py-1 rounded-full mb-3">Loan Analysis Report</div>
                <div className="text-[3rem] print:text-[2.5rem] font-black text-white leading-none tabular-nums mt-1">{formatCurrency(effectiveLoanAmt)}</div>
                <div className="text-[10px] text-white/55 mt-2">proposed loan at {propRate}% p.a. over {monthsToYearsMonths(propTenure)}</div>
                <div className="mt-4 inline-block bg-white/15 rounded-xl px-4 py-2 text-[10px] text-white/80">
                  Your current rate is already competitive — see payment options below
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-2">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-[0.22em] text-white/60 bg-white/10 px-3 py-1 rounded-full">
                    You Could Save Up To
                  </span>
                </div>
                <div className="text-center mb-7 print:mb-6">
                  <div className="text-[4rem] print:text-[3.3rem] font-black text-white leading-none tabular-nums tracking-tight">
                    {formatCurrency(biggestSaved)}
                  </div>
                  <div className="text-[10px] text-white/55 mt-2">in total interest over your loan lifetime</div>
                </div>
              </>
            )}

            {/* Metric chips */}
            <div className={`grid gap-4 print:gap-3 ${calc.has_cash_out && calc.cash_out_amount ? "grid-cols-3" : "grid-cols-2"} ${noSavings ? "mt-6" : ""}`}>
              <div className="rounded-2xl px-5 py-4 print:py-3.5" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/55 mb-2">
                  {noSavings ? "New Monthly Payment" : monthlySavings > 0 ? "Monthly Cash Savings" : "Loan Cleared"}
                </div>
                {noSavings ? (
                  <div className="text-[1.9rem] print:text-[1.6rem] font-black text-white tabular-nums leading-none">{formatCurrency(newMonthly)}</div>
                ) : monthlySavings > 0 ? (
                  <>
                    <div className="text-[1.9rem] print:text-[1.6rem] font-black text-white tabular-nums leading-none">{formatCurrency(monthlySavings)}</div>
                    <div className="text-[9px] text-white/50 mt-1.5">every month from Day 1</div>
                  </>
                ) : (
                  <>
                    <div className="text-[1.6rem] print:text-[1.35rem] font-black text-white leading-none">{monthsToYearsMonths(tenureSavedMonths)} sooner</div>
                    <div className="text-[9px] text-white/50 mt-1.5">with same monthly payment</div>
                  </>
                )}
              </div>

              <div className="rounded-2xl px-5 py-4 print:py-3.5" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/55 mb-2.5">Interest Rate</div>
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="text-[7.5px] text-white/40 truncate max-w-[65px] mb-1">{currentBankName}</div>
                    <div className="text-[1.65rem] print:text-[1.35rem] font-black text-white/65 tabular-nums leading-none">{curRate}%</div>
                  </div>
                  <div className="text-white/30 text-xl mt-1">→</div>
                  <div>
                    <div className="text-[7.5px] text-white/40 truncate max-w-[65px] mb-1">{proposedBankName}</div>
                    <div className="text-[1.65rem] print:text-[1.35rem] font-black text-white tabular-nums leading-none">{propRate}%</div>
                  </div>
                  <div className="ml-auto text-right shrink-0">
                    <div className="text-[7.5px] text-white/40 mb-1">Saving</div>
                    <div className="text-[1.05rem] font-black text-white">−{rateDiff}%</div>
                  </div>
                </div>
              </div>

              {calc.has_cash_out && calc.cash_out_amount ? (
                <div className="rounded-2xl px-5 py-4 print:py-3.5" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/55 mb-2">Cash Released</div>
                  <div className="text-[1.9rem] print:text-[1.6rem] font-black text-white tabular-nums leading-none">{formatCurrency(calc.cash_out_amount)}</div>
                  <div className="text-[9px] text-white/50 mt-1.5">in your hands at signing</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* 3 Scenarios */}
          <div className="px-8 py-7 print:px-7 print:py-6 bg-[#F8F9FB]">
            <div className="flex items-center gap-2.5 mb-6 print:mb-5">
              <div className="h-[3px] w-7 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                {noSavings ? "Your Payment Options" : "Your 3 Paths to Save"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 print:gap-3.5">
              {scenarios.map((s) => (
                <div key={s.number} className={`rounded-2xl bg-white relative ${s.best ? "card-rec" : "card-std shadow-sm"}`}>
                  {s.best && (
                    <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                      <span className="text-white text-[8px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-md whitespace-nowrap" style={{ background: RED }}>
                        ★ RECOMMENDED
                      </span>
                    </div>
                  )}
                  <div className="rounded-t-2xl px-5 py-3.5 print:py-3" style={s.best ? { background: RED } : { background: "#F9FAFB" }}>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                        style={s.best
                          ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                          : { background: "#fff", border: "1.5px solid #e5e7eb", color: "#374151" }}>
                        {s.number}
                      </div>
                      <span className={`text-[11.5px] font-black leading-tight ${s.best ? "text-white" : "text-gray-800"}`}>{s.title}</span>
                    </div>
                  </div>

                  <div className="px-5 py-4 print:px-4 print:py-4">
                    <div className="mb-4 print:mb-3.5">
                      <div className="text-[8.5px] text-gray-400 uppercase tracking-[0.12em] mb-1.5 font-semibold">{s.highlightLabel}</div>
                      <div className="text-[1.5rem] print:text-[1.25rem] font-black tabular-nums leading-none" style={{ color: s.best ? RED : "#111827" }}>
                        {s.highlight}
                      </div>
                    </div>
                    <div className="space-y-2.5 print:space-y-2 border-t border-gray-100 pt-3.5 print:pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] text-gray-400">Monthly payment</span>
                        <span className="text-[10.5px] font-semibold text-gray-800 tabular-nums">{s.monthly}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9.5px] text-gray-400">Loan tenure</span>
                        <span className="text-[10.5px] font-semibold text-gray-800 tabular-nums">{s.tenure}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-[9.5px] font-bold text-gray-600">Interest saved</span>
                        <span className="text-[12px] font-black text-emerald-600 tabular-nums">{formatCurrency(s.saved)}</span>
                      </div>
                    </div>
                    <p className="text-[8.5px] text-gray-400 mt-3 print:mt-2.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="shrink-0 px-8 py-5 print:px-7 print:py-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-[3px] w-7 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">AI Analysis</span>
              <div className="ml-auto flex items-center gap-1 text-[8.5px] text-gray-400">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z"/><path d="M12 6v6l4 2"/></svg>
                Powered by DeepSeek AI
              </div>
            </div>
            {aiLoading ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 flex items-center gap-3">
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin shrink-0" />
                <span className="text-[10px] text-gray-400">Generating personalised analysis…</span>
              </div>
            ) : aiText ? (
              <div className="rounded-2xl px-5 py-4 print:py-4" style={{ background: "rgba(227,6,19,0.03)", border: "1.5px solid rgba(227,6,19,0.14)" }}>
                <p className="text-[10px] text-gray-700 leading-[1.75] whitespace-pre-line">{aiText}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-4 text-center">
                <p className="text-[10px] text-gray-400">AI analysis unavailable — add <code className="text-[9px] bg-gray-100 px-1 rounded">DEEPSEEK_API_KEY</code> to enable.</p>
              </div>
            )}
          </div>

          {/* Page 1 Disclaimer */}
          <div className="shrink-0 px-8 pb-5 pt-1 print:px-7">
            {totalRefinancingCosts > 0 && (
              <p className="text-[7.5px] text-gray-400 mb-0.5">
                * Refinancing costs: Legal {formatCurrency(legalFee)} + Valuation {formatCurrency(valuationFee)} + Stamp duty {formatCurrency(stampDuty)} = {formatCurrency(totalRefinancingCosts)}.{" "}
                {financeInFees ? "Financed into loan." : "Paid upfront."}
              </p>
            )}
            <p className="text-[7.5px] text-gray-400 leading-relaxed">
              <strong>Disclaimer:</strong> {disclaimerText}
            </p>
          </div>

        </div>

        {/* Page label on screen */}
        <div className="no-print w-full max-w-[794px] py-1.5 text-center text-[10px] uppercase tracking-widest text-gray-400 bg-[#d1d5db]">
          Page 2 of 2
        </div>

        {/* ══════════════════════════════════════
            PAGE 2 — Snapshot + Charts + Agent
        ══════════════════════════════════════ */}
        <div className="print-page page-2 w-full max-w-[794px] bg-white doc-shadow flex flex-col">

          {/* Thin red page-2 header */}
          <div className="shrink-0 flex items-center justify-between px-8 py-3 print:px-7" style={{ background: RED }}>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-white flex items-center justify-center shrink-0">
                <span className="font-black text-[11px]" style={{ color: RED }}>Q</span>
              </div>
              <span className="text-[11px] font-black text-white">QuantifyAI</span>
              <span className="text-[9px] text-white/45 ml-1">Refinance Intelligence</span>
            </div>
            <div className="text-[9px] font-semibold text-white/70">{calc.client_name} — Detailed Analysis</div>
            <div className="text-[9px] text-white/45">Page 2 of 2</div>
          </div>

          {/* Loan Snapshot */}
          <div className="shrink-0 px-8 py-6 print:px-7 print:py-5">
            <div className="flex items-center gap-2.5 mb-4 print:mb-3.5">
              <div className="h-[3px] w-7 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Loan Snapshot</span>
            </div>
            <div className="grid grid-cols-2 gap-4 print:gap-3">
              {/* Current */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 print:py-2.5 border-b border-gray-200 flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                  <div>
                    <div className="text-[8px] text-gray-400 uppercase tracking-wider">Current Loan</div>
                    <div className="text-[12px] font-black text-gray-800">{currentBankName}</div>
                  </div>
                </div>
                <div className="px-5 py-3.5 print:py-3 space-y-2 print:space-y-1.5">
                  {([
                    { label: "Interest Rate",      value: `${curRate}% p.a.`,        hi: "red" },
                    { label: "Monthly Instalment", value: formatCurrency(curInstalment) },
                    { label: "Remaining Tenure",   value: monthsToYearsMonths(curTenure) },
                    { label: "Outstanding Amount", value: formatCurrency(curAmt) },
                  ] as { label: string; value: string; hi?: string }[]).map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">{r.label}</span>
                      <span className="text-[11px] font-bold tabular-nums"
                        style={r.hi === "red" ? { color: RED, fontWeight: 900 } : { color: "#1f2937" }}>{r.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2.5 mt-0.5 border-t-2 border-gray-200">
                    <span className="text-[10px] font-semibold text-gray-600">Remaining Interest</span>
                    <span className="text-[12.5px] font-black tabular-nums" style={{ color: RED }}>{formatCurrency(currentRemainingInterest)}</span>
                  </div>
                </div>
              </div>

              {/* Proposed */}
              <div className="rounded-2xl overflow-hidden" style={{ border: `2px solid rgba(227,6,19,0.22)`, background: "rgba(227,6,19,0.025)" }}>
                <div className="px-5 py-3 print:py-2.5 border-b flex items-center gap-2.5"
                  style={{ borderColor: "rgba(227,6,19,0.12)", background: "rgba(227,6,19,0.055)" }}>
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: RED }} />
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-wider" style={{ color: RED }}>Proposed Loan</div>
                    <div className="text-[12px] font-black text-gray-800">{proposedBankName}</div>
                  </div>
                </div>
                <div className="px-5 py-3.5 print:py-3 space-y-2 print:space-y-1.5">
                  {([
                    { label: "Interest Rate",      value: `${propRate}% p.a.`,         hi: "green" },
                    { label: "Monthly Instalment", value: formatCurrency(newMonthly),   hi: "green" },
                    { label: "New Tenure",         value: monthsToYearsMonths(propTenure) },
                    { label: "Loan Amount",        value: formatCurrency(effectiveLoanAmt) },
                  ] as { label: string; value: string; hi?: string }[]).map(r => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">{r.label}</span>
                      <span className="text-[11px] font-bold tabular-nums"
                        style={r.hi === "green" ? { color: "#059669", fontWeight: 900 } : { color: "#1f2937" }}>{r.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2.5 mt-0.5 border-t-2" style={{ borderColor: "rgba(227,6,19,0.18)" }}>
                    <span className="text-[10px] font-semibold text-gray-600">Total Interest</span>
                    <span className="text-[12.5px] font-black text-emerald-600 tabular-nums">{formatCurrency(newTotalInterest)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interest comparison chart */}
          <div className="shrink-0 px-8 py-5 print:px-7 print:py-4 bg-[#F8F9FB]">
            <div className="flex items-center gap-2.5 mb-4 print:mb-3.5">
              <div className="h-[3px] w-7 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Total Interest Paid — Scenario Comparison</span>
            </div>
            <div className="space-y-3.5 print:space-y-3">
              {interestBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <div className="w-[148px] shrink-0 text-[9px] text-gray-500 leading-tight">{bar.label}</div>
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <div className="flex-1 bar-track h-[18px]">
                      <div className="h-full rounded-full" style={{ width: `${(bar.val / maxChartInterest) * 100}%`, background: bar.color }} />
                    </div>
                    <span className="text-[9.5px] font-bold text-gray-700 tabular-nums w-[78px] shrink-0 text-right">{formatCurrency(bar.val)}</span>
                    {bar.saving !== null && bar.saving > 0
                      ? <span className="text-[8.5px] font-black text-emerald-600 tabular-nums w-[72px] shrink-0">−{formatCurrency(bar.saving)}</span>
                      : <span className="w-[72px] shrink-0" />
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payoff timeline */}
          <div className="shrink-0 px-8 py-5 print:px-7 print:py-4">
            <div className="flex items-center gap-2.5 mb-4 print:mb-3.5">
              <div className="h-[3px] w-7 rounded-full shrink-0" style={{ background: RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Payoff Timeline</span>
            </div>
            <div className="space-y-3 print:space-y-2.5">
              {timelineBars.map((bar) => {
                const saved = curTenure - bar.months
                return (
                  <div key={bar.label} className="flex items-center gap-3">
                    <div className="w-[148px] shrink-0 text-[9px] text-gray-500 leading-tight">{bar.label}</div>
                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      <div className="flex-1 bar-track h-[18px]">
                        <div className="h-full rounded-full" style={{ width: `${(bar.months / maxChartTenure) * 100}%`, background: bar.color, opacity: 0.85 }} />
                      </div>
                      <span className="text-[9.5px] font-bold text-gray-700 w-[68px] shrink-0 text-right tabular-nums">{monthsToYearsMonths(bar.months)}</span>
                      {saved > 0
                        ? <span className="text-[8.5px] font-black text-emerald-600 w-[76px] shrink-0">{monthsToYearsMonths(saved)} sooner</span>
                        : <span className="w-[76px] shrink-0" />
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Break-even */}
            {totalRefinancingCosts > 0 && breakEvenMonths < 48 && (
              <div className="mt-4 print:mt-3.5 flex items-start gap-3 rounded-xl px-5 py-3 print:py-2.5"
                style={{ background: "rgba(227,6,19,0.04)", border: "1.5px solid rgba(227,6,19,0.16)" }}>
                <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: RED }}>
                  <span className="text-white text-[9px] font-black">✓</span>
                </div>
                <p className="text-[10px] text-gray-700 leading-relaxed">
                  Refinancing costs of <strong>{formatCurrency(totalRefinancingCosts)}</strong> recovered in <strong>{monthsToYearsMonths(breakEvenMonths)}</strong> — every month after is pure savings.
                </p>
              </div>
            )}
          </div>

          {/* Agent + WhatsApp */}
          <div className="flex-1 px-8 py-5 print:px-7 print:py-4 flex flex-col justify-end">
            <div className="h-px bg-gray-100 mb-5 print:mb-4 shrink-0" />
            <div className="grid grid-cols-2 gap-4 print:gap-3">

              {/* Prepared by */}
              <div className="rounded-2xl border border-gray-200 px-5 py-4 print:py-3.5 flex flex-col justify-center">
                <div className="text-[8px] text-gray-400 uppercase tracking-[0.14em] mb-1.5">Report Prepared By</div>
                <div className="text-[14px] font-black text-gray-900 leading-snug">{agentName || "Your QuantifyAI Consultant"}</div>
                {agentPhone && <div className="text-[11px] font-semibold text-gray-500 mt-1">{agentPhone}</div>}
                <div className="text-[8.5px] text-gray-400 mt-2">QuantifyAI Sdn Bhd · SSM: 202501001318</div>
              </div>

              {/* WhatsApp */}
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="rounded-2xl flex items-center gap-3.5 px-5 py-4 print:py-3.5 cursor-pointer transition-colors"
                style={{ border: "1.5px solid rgba(37,211,102,0.35)", background: "rgba(37,211,102,0.07)", textDecoration: "none" }}>
                <div className="h-10 w-10 print:h-9 print:w-9 rounded-full bg-white shadow flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 print:h-5 print:w-5" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[8.5px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Zero fees · Completely free</div>
                  <div className="text-[13px] print:text-[11.5px] font-black text-gray-900 leading-snug">Ready to save?<br/>WhatsApp us now</div>
                </div>
                <div className="text-[20px] font-black shrink-0 ml-1" style={{ color: "#25D366" }}>›</div>
              </a>

            </div>
          </div>

          {/* Footnote */}
          <div className="shrink-0 px-8 py-3 print:px-7 print:py-2 border-t border-gray-100">
            {totalRefinancingCosts > 0 && (
              <p className="text-[8px] text-gray-400 mb-0.5">
                * Refinancing costs: Legal {formatCurrency(legalFee)} + Valuation {formatCurrency(valuationFee)} + Stamp duty {formatCurrency(stampDuty)} = {formatCurrency(totalRefinancingCosts)}.{" "}
                {financeInFees ? "Financed into loan." : "Paid upfront."}
              </p>
            )}
            <p className="text-[8px] text-gray-400 leading-relaxed">
              <strong>Disclaimer:</strong> {disclaimerText}
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
