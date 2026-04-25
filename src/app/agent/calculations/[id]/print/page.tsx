"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  calculateMonthlyInstalment,
  calculateTotalInterest,
} from "@/lib/calculations/loan"
import { formatCurrency, monthsToYearsMonths } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────

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
  proposed_bank?: { name: string } | null
  created_at: string
}

// ─── Main Component ───────────────────────────────────────────

export default function CalculationPrintPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [calc, setCalc] = React.useState<CalcData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    const supabase = createClient()
    supabase
      .from("calculations")
      .select("*, proposed_bank:banks(name)")
      .eq("id", id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Calculation not found.")
        } else {
          setCalc(data as unknown as CalcData)
        }
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-400 text-sm">Loading report...</div>
      </div>
    )
  }

  if (error || !calc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Not found"}</p>
          <button onClick={() => router.back()} className="text-sm text-gray-500 underline">Go back</button>
        </div>
      </div>
    )
  }

  if (calc.loan_type !== "refinance") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600 mb-2">PDF report is only available for Refinance calculations.</p>
          <button onClick={() => router.back()} className="text-sm text-[#0A1628] underline">Go back</button>
        </div>
      </div>
    )
  }

  // ── Validate required fields ──
  const {
    current_loan_amount: curAmt,
    current_interest_rate: curRate,
    current_monthly_instalment: curInstalment,
    current_tenure_months: curTenure,
    proposed_loan_amount: propAmt,
    proposed_interest_rate: propRate,
    proposed_tenure_months: propTenure,
  } = calc

  if (!curAmt || !curRate || !curInstalment || !curTenure || !propAmt || !propRate || !propTenure) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Incomplete calculation data — missing required refinance fields.</p>
          <button onClick={() => router.back()} className="text-sm text-[#0A1628] underline">Go back</button>
        </div>
      </div>
    )
  }

  // ── Compute scenarios ──
  const legalFee = calc.legal_fee_amount ?? 0
  const valuationFee = calc.valuation_fee_amount ?? 0
  const stampDuty = calc.stamp_duty_amount ?? 0
  const totalRefinancingCosts = legalFee + valuationFee + stampDuty
  const financeInFees = calc.finance_legal_fees ?? false

  const effectiveLoanAmt = financeInFees
    ? propAmt + legalFee + valuationFee + stampDuty
    : propAmt

  // Scenario 1: Pay new lower amount — standard monthly savings
  const newMonthly = calculateMonthlyInstalment(effectiveLoanAmt, propRate, propTenure)
  const monthlySavings = curInstalment - newMonthly
  const currentTotalRemaining = curInstalment * curTenure
  const currentRemainingInterest = Math.max(0, currentTotalRemaining - curAmt)
  const newTotalInterest = calculateTotalInterest(effectiveLoanAmt, propRate, propTenure)
  const totalInterestSaved = currentRemainingInterest - newTotalInterest
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(totalRefinancingCosts / monthlySavings) : 9999

  // Scenario 2: Keep paying old amount (curInstalment) on new loan
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

  // Scenario 3: Pay old amount bi-weekly (most aggressive)
  const biweeklyPayment = curInstalment / 2
  const biweeklyRate = propRate / 100 / 26
  let biweeklyTenurePeriods: number
  if (propRate === 0) {
    biweeklyTenurePeriods = effectiveLoanAmt / biweeklyPayment
  } else {
    const x = 1 - (effectiveLoanAmt * biweeklyRate) / biweeklyPayment
    if (x <= 0) {
      biweeklyTenurePeriods = 1
    } else {
      biweeklyTenurePeriods = -Math.log(x) / Math.log(1 + biweeklyRate)
    }
  }
  const biweeklyTenureMonths = Math.ceil((biweeklyTenurePeriods / 26) * 12)
  const biweeklyTotalInterest = biweeklyPayment * biweeklyTenurePeriods - effectiveLoanAmt
  const biweeklyInterestSaved = newTotalInterest - Math.max(0, biweeklyTotalInterest)
  const biweeklyTenureSaved = Math.max(0, propTenure - biweeklyTenureMonths)

  // Determine best scenario (largest interest saved, must be positive)
  const amounts = [
    Math.max(0, totalInterestSaved),
    Math.max(0, accelInterestSaved),
    Math.max(0, biweeklyInterestSaved),
  ]
  const bestIdx = amounts.indexOf(Math.max(...amounts)) // 0, 1, or 2
  const biggestSaved = amounts[bestIdx]

  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })

  const currentBankName = calc.current_bank || "Current Bank"
  const proposedBankName = calc.proposed_bank?.name || "Proposed Bank"

  // Scenario card data
  const scenarios = [
    {
      number: 1,
      title: "Lower Monthly Payments",
      subtitle: "Pay the new reduced instalment and enjoy immediate cash flow relief every month.",
      keyLabel: "New monthly payment",
      keyValue: formatCurrency(newMonthly),
      outcomeLabel: "Interest saved",
      outcomeValue: formatCurrency(Math.max(0, totalInterestSaved)),
      tableMonthly: formatCurrency(newMonthly),
      tableTenure: monthsToYearsMonths(propTenure),
      tableSaved: Math.max(0, totalInterestSaved),
      best: bestIdx === 0,
    },
    {
      number: 2,
      title: "Pay Off Faster (Same Payment)",
      subtitle: "Keep paying your current instalment on the new lower-rate loan to clear your debt earlier.",
      keyLabel: "Finish loan",
      keyValue: tenureSavedMonths > 0 ? `${monthsToYearsMonths(tenureSavedMonths)} earlier` : monthsToYearsMonths(accelTenureMonths),
      outcomeLabel: "Interest saved",
      outcomeValue: formatCurrency(Math.max(0, accelInterestSaved)),
      tableMonthly: formatCurrency(curInstalment),
      tableTenure: monthsToYearsMonths(accelTenureMonths),
      tableSaved: Math.max(0, accelInterestSaved),
      best: bestIdx === 1,
    },
    {
      number: 3,
      title: "Bi-Weekly Turbo (Same Payment)",
      subtitle: "Split your current payment in half and pay every 2 weeks — 26 payments a year instead of 24.",
      keyLabel: "Finish loan",
      keyValue: biweeklyTenureSaved > 0 ? `${monthsToYearsMonths(biweeklyTenureSaved)} earlier` : monthsToYearsMonths(biweeklyTenureMonths),
      outcomeLabel: "Interest saved",
      outcomeValue: formatCurrency(Math.max(0, biweeklyInterestSaved)),
      tableMonthly: `${formatCurrency(biweeklyPayment)} × 2/wk`,
      tableTenure: monthsToYearsMonths(biweeklyTenureMonths),
      tableSaved: Math.max(0, biweeklyInterestSaved),
      best: bestIdx === 2,
    },
  ]

  return (
    <>
      {/* ── Global styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
          @page { size: A4; margin: 1.5cm; }
        }

        .hero-gradient {
          background: linear-gradient(135deg, #D7263D 0%, #b61f33 60%, #9a1928 100%);
        }
        .gold-gradient {
          background: linear-gradient(135deg, #0A1628 0%, #152340 50%, #0A1628 100%);
        }
        .gold-glow-box {
          background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%);
          border: 1.5px solid rgba(255,255,255,0.4);
        }
        .scenario-best {
          border: 2px solid #D7263D;
          background: linear-gradient(135deg, rgba(215,38,61,0.05) 0%, rgba(255,255,255,1) 60%);
        }
        .scenario-normal {
          border: 1.5px solid #e5e7eb;
          background: #fff;
        }
        .table-best-row {
          background: linear-gradient(90deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.05) 100%);
        }
      `}</style>

      {/* ── Toolbar (screen only) ── */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#0A1628] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#0A1628] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#152340] transition-colors"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* ── Document ── */}
      <div className="max-w-[820px] mx-auto bg-white print:max-w-full">

        {/* ══════════════════════════════════════════════
            SECTION 1: HERO
        ══════════════════════════════════════════════ */}
        <div className="hero-gradient text-white px-10 pt-8 pb-9 print:px-8 print:pt-7 print:pb-8">

          {/* Top bar: logo + date */}
          <div className="flex items-start justify-between mb-7">
            <div className="flex items-center gap-2">
              <div className="bg-white h-6 w-6 rounded-md flex items-center justify-center text-[#D7263D] font-black text-xs">Q</div>
              <span className="font-bold text-sm tracking-widest text-white uppercase">QuantifyAI</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50 uppercase tracking-wider">Prepared on</div>
              <div className="text-xs text-white/80 font-medium mt-0.5">{today}</div>
            </div>
          </div>

          {/* Client name */}
          <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Prepared exclusively for</div>
          <div className="text-xl font-bold text-white mb-6">{calc.client_name || "Valued Client"}</div>

          {/* THE BIG NUMBER */}
          <div className="gold-glow-box rounded-2xl px-7 py-6 mb-5">
            <div className="text-sm text-white/60 font-medium mb-2 tracking-wide">You could save</div>
            <div
              className="font-black leading-none mb-2 tabular-nums"
              style={{ fontSize: "clamp(2.6rem, 7vw, 3.5rem)", color: "#ffffff" }}
            >
              {formatCurrency(biggestSaved)}
            </div>
            <div className="text-sm text-white/70 font-medium">in interest over your loan lifetime</div>

            {monthlySavings > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="text-white/55 text-sm">Starting from </span>
                <span className="text-white font-bold text-sm">{formatCurrency(monthlySavings)} per month</span>
                <span className="text-white/55 text-sm"> from Day 1</span>
              </div>
            )}
          </div>

          {/* Rate change bar */}
          <div className="flex items-center gap-3 bg-white/8 rounded-xl px-5 py-3">
            <div className="text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Current</div>
              <div className="text-sm font-bold text-white/90">{currentBankName}</div>
              <div className="text-xs text-white/50 mt-0.5">{curRate}% p.a.</div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1">
              <div className="h-px flex-1 bg-white/15" />
              <div className="text-white font-bold text-lg px-1">→</div>
              <div className="h-px flex-1 bg-white/15" />
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Proposed</div>
              <div className="text-sm font-bold text-white">{proposedBankName}</div>
              <div className="text-xs text-white/70 mt-0.5">{propRate}% p.a.</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 2: THE 3 PATHS
        ══════════════════════════════════════════════ */}
        <div className="px-10 py-8 print:px-8 print:py-7">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-0.5 w-5 bg-[#D7263D]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#0A1628]">Your 3 Savings Paths</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 print:gap-3">
            {scenarios.map((s) => (
              <div
                key={s.number}
                className={`rounded-xl p-5 print:p-4 relative ${s.best ? "scenario-best" : "scenario-normal"}`}
              >
                {/* Best badge */}
                {s.best && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-[#D7263D] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-sm">
                      ★ Best Deal
                    </div>
                  </div>
                )}

                {/* Number badge */}
                <div className={`h-7 w-7 rounded-full flex items-center justify-center font-black text-xs mb-3 ${s.best ? "bg-[#D7263D] text-white" : "bg-[#0A1628] text-white"}`}>
                  {s.number}
                </div>

                {/* Title */}
                <h3 className={`font-bold text-sm leading-snug mb-1.5 ${s.best ? "text-[#D7263D]" : "text-[#0A1628]"}`}>
                  {s.title}
                </h3>
                <p className="text-[10px] text-gray-400 leading-relaxed mb-4">{s.subtitle}</p>

                {/* Key number */}
                <div className="mb-3">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{s.keyLabel}</div>
                  <div className={`text-lg font-black tabular-nums ${s.best ? "text-[#D7263D]" : "text-[#0A1628]"}`}>
                    {s.keyValue}
                  </div>
                </div>

                {/* Outcome */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{s.outcomeLabel}</div>
                  <div className="text-sm font-bold text-teal-700 tabular-nums">{s.outcomeValue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 3: COMPARISON TABLE
        ══════════════════════════════════════════════ */}
        <div className="px-10 pb-7 print:px-8 print:pb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-0.5 w-5 bg-[#D7263D]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#0A1628]">Scenario Comparison</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#0A1628]">
                <th className="text-left pb-2.5 pr-4 text-[10px] font-bold uppercase tracking-widest text-[#0A1628]">Scenario</th>
                <th className="text-right pb-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-[#0A1628]">Monthly</th>
                <th className="text-right pb-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-[#0A1628]">Loan Tenure</th>
                <th className="text-right pb-2.5 pl-4 text-[10px] font-bold uppercase tracking-widest text-[#0A1628]">Interest Saved</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.number} className={`border-b border-gray-100 ${s.best ? "table-best-row" : ""}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black ${s.best ? "bg-[#D7263D] text-white" : "bg-gray-100 text-gray-500"}`}>
                        {s.number}
                      </div>
                      <span className={`font-semibold text-xs ${s.best ? "text-[#D7263D]" : "text-[#0A1628]"}`}>
                        {s.title}
                      </span>
                      {s.best && (
                        <span className="text-[9px] bg-[#D7263D] text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">Best</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-xs text-gray-700">{s.tableMonthly}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-xs text-gray-700">{s.tableTenure}</td>
                  <td className={`py-3 pl-4 text-right tabular-nums text-xs font-bold ${s.best ? "text-[#D7263D]" : "text-teal-700"}`}>
                    {formatCurrency(s.tableSaved)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 4: CURRENT vs PROPOSED
        ══════════════════════════════════════════════ */}
        <div className="px-10 pb-7 print:px-8 print:pb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-0.5 w-5 bg-[#D7263D]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#0A1628]">Loan Details</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Current */}
            <div className="rounded-xl border border-gray-200 p-5 print:p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Current Loan</div>
              {[
                { label: "Bank", value: currentBankName },
                { label: "Interest Rate", value: `${curRate}% p.a.` },
                { label: "Monthly Instalment", value: formatCurrency(curInstalment) },
                { label: "Remaining Tenure", value: monthsToYearsMonths(curTenure) },
                { label: "Outstanding Amount", value: formatCurrency(curAmt) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-baseline py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <span className="text-xs font-semibold text-[#0A1628] tabular-nums">{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline py-1.5 mt-1 border-t-2 border-gray-200">
                <span className="text-xs text-gray-500">Remaining Interest</span>
                <span className="text-xs font-bold text-red-600 tabular-nums">{formatCurrency(currentRemainingInterest)}</span>
              </div>
            </div>

            {/* Proposed */}
            <div className="rounded-xl border border-[#D7263D]/25 bg-[#D7263D]/4 p-5 print:p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#D7263D] mb-3">Proposed New Loan</div>
              {[
                { label: "Bank", value: proposedBankName },
                { label: "Interest Rate", value: `${propRate}% p.a.` },
                { label: "Monthly Instalment", value: formatCurrency(newMonthly) },
                { label: "New Tenure", value: monthsToYearsMonths(propTenure) },
                { label: "Loan Amount", value: formatCurrency(effectiveLoanAmt) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-baseline py-1.5 border-b border-amber-100/60 last:border-0">
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <span className="text-xs font-semibold text-[#0A1628] tabular-nums">{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline py-1.5 mt-1 border-t-2 border-[#D7263D]/30">
                <span className="text-xs text-gray-500">Total Interest</span>
                <span className="text-xs font-bold text-teal-700 tabular-nums">{formatCurrency(newTotalInterest)}</span>
              </div>
            </div>
          </div>

          {/* Break-even callout — only if positive and under 24 months */}
          {totalRefinancingCosts > 0 && breakEvenMonths < 24 && (
            <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="text-teal-500 text-lg">✓</div>
              <div>
                <span className="text-xs font-bold text-teal-800">You recover all refinancing costs in just </span>
                <span className="text-xs font-black text-teal-700">{monthsToYearsMonths(breakEvenMonths)}</span>
                <span className="text-xs font-bold text-teal-800"> — everything after that is pure savings.</span>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 5: NEXT STEPS + BRANDING
        ══════════════════════════════════════════════ */}
        <div className="hero-gradient text-white px-10 py-8 print:px-8 print:py-7">
          <div className="text-xs font-bold uppercase tracking-widest text-white/70 mb-4">
            Ready to start saving?
          </div>
          <h2 className="text-base font-bold text-white mb-5">Here&apos;s what happens next</h2>

          <div className="grid grid-cols-3 gap-4 mb-7">
            {[
              { step: "1", title: "Accept This Proposal", desc: "Let us know you want to proceed — no paperwork yet." },
              { step: "2", title: "We Prepare Everything", desc: "We handle your bank application from start to finish." },
              { step: "3", title: "Bank Approves, You Save", desc: "Once approved, your lower rate kicks in immediately." },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="bg-white h-7 w-7 rounded-full flex items-center justify-center text-[#D7263D] font-black text-xs shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <div className="text-xs font-bold text-white mb-1">{item.title}</div>
                  <div className="text-[10px] text-white/55 leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Contact + free service */}
          <div className="border-t border-white/10 pt-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">WhatsApp us now</div>
              <div className="text-base font-bold text-white">+601 2618 1683</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50 leading-relaxed max-w-[220px]">
                This analysis is prepared by <span className="text-white/80 font-semibold">QuantifyAI Sdn Bhd</span>.<br />
                Zero fees to you — our service is completely free.
              </div>
            </div>
          </div>
        </div>

        {/* ── Footnotes ── */}
        <div className="px-10 py-5 print:px-8 print:py-4 bg-gray-50 border-t border-gray-100">
          {totalRefinancingCosts > 0 && (
            <p className="text-[9px] text-gray-400 mb-1.5">
              * Estimated refinancing costs: Legal fee {formatCurrency(legalFee)} + Valuation fee {formatCurrency(valuationFee)} + Stamp duty {formatCurrency(stampDuty)} = {formatCurrency(totalRefinancingCosts)} total.
              {financeInFees ? " Costs are financed into the new loan." : " Costs are paid upfront."}
            </p>
          )}
          <p className="text-[9px] text-gray-400 leading-relaxed">
            <strong>Disclaimer:</strong> This report is for illustration purposes only and is based on information provided at the time of preparation.
            Actual savings may vary depending on loan terms, bank policies, and prevailing market conditions.
            All calculations assume standard reducing-balance amortisation. The bi-weekly scenario assumes 26 half-monthly payments per year.
            Please consult a licensed financial advisor before making any financial decisions.
            &nbsp;·&nbsp; Generated by QuantifyAI Portal &nbsp;·&nbsp; {today}
          </p>
        </div>

      </div>
    </>
  )
}
