'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, CheckCircle, ChevronRight, TrendingDown, Wallet, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { calculateMonthlyInstalment, calculateRefinance } from '@/lib/calculations/loan'
import { formatCurrency } from '@/lib/utils'

// ─── Rate logic ────────────────────────────────────────────────
function getDefaultRate(loanAmount: number): number {
  return loanAmount >= 300000 ? 3.60 : 3.85
}

// ─── Animated count-up ────────────────────────────────────────
function CountUp({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number
}) {
  const [display, setDisplay] = React.useState(0)
  const startRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    startRef.current = null
    const duration = 900
    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(ease * value)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  const formatted = display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return <>{prefix}{formatted}{suffix}</>
}

// ─── Types ─────────────────────────────────────────────────────
interface LoanForm {
  currentBank: string
  currentLoanAmount: number | undefined
  currentInterestRate: number | undefined
  currentTenureYears: number | undefined
}

interface LeadForm {
  name: string
  whatsapp: string
  email: string
}

interface CalcResult {
  monthlySavings: number
  newMonthly: number
  currentMonthly: number
  totalInterestSaved: number
  proposedRate: number
}

// ─── Main ──────────────────────────────────────────────────────
function FreeAnalysisInner() {
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref') || ''

  // 0 = loan form, 1 = results + lead form, 2 = thank you
  const [step, setStep] = React.useState(0)

  const [loan, setLoan] = React.useState<LoanForm>({
    currentBank: '',
    currentLoanAmount: undefined,
    currentInterestRate: undefined,
    currentTenureYears: undefined,
  })

  const [lead, setLead] = React.useState<LeadForm>({ name: '', whatsapp: '+60', email: '' })
  const [result, setResult] = React.useState<CalcResult | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [attribution, setAttribution] = React.useState<{ agent_code: string; full_name: string } | null>(null)

  function updateLoan<K extends keyof LoanForm>(k: K, v: LoanForm[K]) {
    setLoan(s => ({ ...s, [k]: v }))
  }

  function canCalculate() {
    return !!(loan.currentLoanAmount && loan.currentInterestRate && loan.currentTenureYears)
  }

  function canSubmitLead() {
    return lead.name.trim().length > 0 && lead.whatsapp.trim().length > 4 && lead.email.trim().length > 3
  }

  function doCalculate() {
    const currentMonths = (loan.currentTenureYears ?? 0) * 12
    const proposedRate = getDefaultRate(loan.currentLoanAmount ?? 0)
    const proposedLoanAmount = loan.currentLoanAmount ?? 0
    const proposedMonths = currentMonths // keep same tenure for fair comparison

    const currentMI = calculateMonthlyInstalment(
      loan.currentLoanAmount ?? 0,
      loan.currentInterestRate ?? 0,
      currentMonths
    )
    const r = calculateRefinance({
      currentLoanAmount: loan.currentLoanAmount ?? 0,
      currentInterestRate: loan.currentInterestRate ?? 0,
      currentMonthlyInstalment: currentMI,
      currentTenureMonths: currentMonths,
      proposedLoanAmount,
      proposedInterestRate: proposedRate,
      proposedTenureMonths: proposedMonths,
      financeInFees: false,
      legalFeeAmount: 0,
      valuationFeeAmount: 0,
      stampDutyAmount: 0,
      cashOutAmount: 0,
      cashOutTenureMonths: 120,
    })

    setResult({
      monthlySavings: r.monthlySavings,
      newMonthly: r.proposedMonthlyInstalment,
      currentMonthly: currentMI,
      totalInterestSaved: r.totalInterestSaved,
      proposedRate,
    })
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmitLead() {
    setSaving(true)
    try {
      const res = await fetch('/api/public/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: referralCode || null,
          client_name: lead.name,
          client_phone: lead.whatsapp,
          loan_type: 'refinance',
          current_bank: loan.currentBank || null,
          current_loan_amount: loan.currentLoanAmount ?? null,
          current_interest_rate: loan.currentInterestRate ?? null,
          current_monthly_instalment: result?.currentMonthly ?? null,
          current_tenure_months: loan.currentTenureYears ? loan.currentTenureYears * 12 : null,
          proposed_loan_amount: loan.currentLoanAmount ?? null,
          proposed_interest_rate: result?.proposedRate ?? null,
          proposed_tenure_months: loan.currentTenureYears ? loan.currentTenureYears * 12 : null,
          results: result,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setAttribution(json.attributed_to)
        setStep(2)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        toast.error(json.error || 'Something went wrong, please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Variants ─────────────────────────────────────────────────
  const fadeUp: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } } }
  const stagger: Variants = { show: { transition: { staggerChildren: 0.08 } } }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #fff5f6 0%, #f6f6f7 60%, #f6f6f7 100%)' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[#111113]/8 bg-white/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-xl bg-[#D7263D] shadow-[0_4px_12px_rgba(215,38,61,0.35)] flex items-center justify-center">
              <span className="text-white font-black text-sm">Q</span>
            </div>
            <div className="leading-none">
              <p className="font-bold text-[#0A1628] text-base tracking-tight">
                quantify<span className="text-[#D7263D]">.</span>
              </p>
              <p className="text-[#7C7C85] text-[9px] uppercase tracking-widest">AI · Mortgage Analysis</p>
            </div>
          </Link>
          {referralCode && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#5F5F67] bg-[#D7263D]/6 border border-[#D7263D]/15 px-3 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D7263D] animate-pulse" />
              Shared by your consultant
            </span>
          )}
        </div>
      </header>

      {/* ── Hero band ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="relative overflow-hidden bg-[#D7263D]">
          {/* grid pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-10" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-3"
            >
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 text-xs text-white/90 font-medium mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                100% Free · No obligation
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                How Much Could You Save<br className="hidden sm:block" /> on Your Mortgage?
              </h1>
              <p className="text-white/75 text-base max-w-md mx-auto">
                Enter your current loan details. We&apos;ll show you your potential savings in seconds — no sign-up required.
              </p>
            </motion.div>
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">

          {/* ── STEP 0: Loan Form ──────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step0" variants={stagger} initial="hidden" animate="show" className="space-y-5">

              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#111113]/8 shadow-[0_8px_32px_rgba(17,17,19,0.06)] p-6 space-y-5">
                <div className="space-y-0.5">
                  <h2 className="text-lg font-bold text-[#0A1628]">Your Current Loan</h2>
                  <p className="text-sm text-[#5F5F67]">Fill in what you know — all fields marked * are required</p>
                </div>

                <FormField label="Current Bank / Financier" hint="Optional">
                  <input
                    type="text"
                    value={loan.currentBank}
                    onChange={e => updateLoan('currentBank', e.target.value)}
                    placeholder="e.g. Maybank, CIMB, Public Bank…"
                    className={inputCls}
                  />
                </FormField>

                <FormField label="Outstanding Loan Amount (RM) *" hint="">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6A6A73] text-sm font-medium">RM</span>
                    <input
                      type="number"
                      value={loan.currentLoanAmount ?? ''}
                      onChange={e => updateLoan('currentLoanAmount', parseFloat(e.target.value) || undefined)}
                      placeholder="500,000"
                      className={inputCls + ' pl-10'}
                    />
                  </div>
                  {loan.currentLoanAmount && loan.currentLoanAmount >= 300000 && (
                    <p className="text-xs text-[#D7263D] mt-1.5 font-medium">
                      ✓ Eligible for best market rate
                    </p>
                  )}
                </FormField>

                <FormField label="Current Interest Rate (% p.a.) *" hint="Check your latest bank statement">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={loan.currentInterestRate ?? ''}
                      onChange={e => updateLoan('currentInterestRate', parseFloat(e.target.value) || undefined)}
                      placeholder="4.50"
                      className={inputCls + ' pr-8'}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6A6A73] text-sm">%</span>
                  </div>
                </FormField>

                <FormField label="Remaining Tenure (years) *" hint="Years left on your loan">
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="1"
                      max="35"
                      value={loan.currentTenureYears ?? ''}
                      onChange={e => updateLoan('currentTenureYears', parseInt(e.target.value) || undefined)}
                      placeholder="25"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      {[35, 30, 25, 20, 15].map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => updateLoan('currentTenureYears', y)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            loan.currentTenureYears === y
                              ? 'bg-[#D7263D] border-[#D7263D] text-white shadow-[0_2px_8px_rgba(215,38,61,0.3)]'
                              : 'border-[#D8D8DE] text-[#5F5F67] hover:border-[#D7263D]/40 hover:text-[#D7263D]'
                          }`}
                        >
                          {y}y
                        </button>
                      ))}
                    </div>
                  </div>
                </FormField>
              </motion.div>

              {/* Quick estimate preview */}
              {canCalculate() && (
                <motion.div
                  variants={fadeUp}
                  className="bg-[#D7263D]/5 border border-[#D7263D]/15 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-xl bg-[#D7263D]/10 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="h-4 w-4 text-[#D7263D]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0A1628] font-medium">Ready to calculate!</p>
                    <p className="text-xs text-[#5F5F67]">We&apos;ll compare your loan against the best available market rate.</p>
                  </div>
                </motion.div>
              )}

              <motion.div variants={fadeUp}>
                <motion.button
                  onClick={doCalculate}
                  disabled={!canCalculate()}
                  whileHover={canCalculate() ? { scale: 1.015 } : {}}
                  whileTap={canCalculate() ? { scale: 0.985 } : {}}
                  className="w-full h-12 bg-[#D7263D] hover:bg-[#B61F33] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(215,38,61,0.35)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Show My Savings <ArrowRight className="h-4 w-4" />
                </motion.button>
                <p className="text-center text-xs text-[#7C7C85] mt-2">
                  Free analysis · No credit check · No sign-up needed
                </p>
              </motion.div>

            </motion.div>
          )}

          {/* ── STEP 1: Results + Lead Capture ────────────────── */}
          {step === 1 && result && (
            <motion.div key="step1" variants={stagger} initial="hidden" animate="show" className="space-y-5">

              {/* Big savings hero */}
              <motion.div
                variants={fadeUp}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #D7263D 0%, #b61f33 100%)' }}
              >
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />
                <div className="relative p-6 text-center">
                  <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Estimated monthly savings</p>
                  <div className="text-5xl sm:text-6xl font-black text-white leading-none mb-1">
                    <CountUp value={result.monthlySavings} prefix="RM " decimals={0} />
                  </div>
                  <p className="text-white/60 text-sm">per month</p>
                </div>

                <div className="grid grid-cols-2 divide-x divide-white/15 border-t border-white/15">
                  <div className="p-4 text-center">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">New Monthly</p>
                    <p className="text-white font-bold text-lg">
                      <CountUp value={result.newMonthly} prefix="RM " decimals={0} />
                    </p>
                    <p className="text-white/50 text-xs mt-0.5 line-through">
                      {formatCurrency(result.currentMonthly)}
                    </p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-0.5">Total Interest Saved</p>
                    <p className="text-white font-bold text-lg">
                      <CountUp value={Math.max(0, result.totalInterestSaved)} prefix="RM " decimals={0} />
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">over loan life</p>
                  </div>
                </div>

                <div className="px-6 py-3 border-t border-white/15 flex items-center justify-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-white/50" />
                  <p className="text-white/60 text-xs">
                    Based on best available market rate of <span className="text-white font-semibold">{result.proposedRate}% p.a.</span>
                  </p>
                </div>
              </motion.div>

              {/* Comparison breakdown */}
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#111113]/8 shadow-[0_8px_32px_rgba(17,17,19,0.06)] overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-[#111113]/6">
                  <h3 className="text-sm font-semibold text-[#0A1628]">Loan Comparison</h3>
                </div>
                <div className="divide-y divide-[#111113]/5">
                  {[
                    { label: 'Monthly Payment', current: formatCurrency(result.currentMonthly), proposed: formatCurrency(result.newMonthly), better: true },
                    { label: 'Interest Rate', current: `${loan.currentInterestRate}% p.a.`, proposed: `${result.proposedRate}% p.a.`, better: true },
                    { label: 'Loan Amount', current: formatCurrency(loan.currentLoanAmount ?? 0), proposed: formatCurrency(loan.currentLoanAmount ?? 0), better: false },
                    { label: 'Tenure', current: `${loan.currentTenureYears} years`, proposed: `${loan.currentTenureYears} years`, better: false },
                  ].map(row => (
                    <div key={row.label} className="grid grid-cols-3 px-5 py-3 text-xs">
                      <span className="text-[#7C7C85] font-medium">{row.label}</span>
                      <span className="text-[#5F5F67] text-center">{row.current}</span>
                      <span className={`text-right font-semibold ${row.better ? 'text-[#D7263D]' : 'text-[#5F5F67]'}`}>{row.proposed}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 px-5 py-2 bg-[#f6f6f7] border-t border-[#111113]/6">
                  <span className="text-[9px] text-[#9C9CA8] uppercase tracking-widest font-semibold"></span>
                  <span className="text-[9px] text-[#9C9CA8] uppercase tracking-widest text-center font-semibold">Current</span>
                  <span className="text-[9px] text-[#D7263D] uppercase tracking-widest text-right font-semibold">With QAI</span>
                </div>
              </motion.div>

              {/* Lead capture */}
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#111113]/8 shadow-[0_8px_32px_rgba(17,17,19,0.06)] p-6 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[#0A1628]">Get Your Full Free Report</h3>
                  <p className="text-sm text-[#5F5F67] mt-1">
                    Enter your details and a consultant will send you the complete analysis — including all costs, savings, and next steps.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField label="Your Name *" hint="">
                    <input
                      type="text"
                      value={lead.name}
                      onChange={e => setLead(s => ({ ...s, name: e.target.value }))}
                      placeholder="Full name"
                      className={inputCls}
                    />
                  </FormField>

                  <FormField label="WhatsApp Number *" hint="Your consultant will contact you here">
                    <input
                      type="tel"
                      value={lead.whatsapp}
                      onChange={e => setLead(s => ({ ...s, whatsapp: e.target.value }))}
                      placeholder="+60 12-345 6789"
                      className={inputCls}
                    />
                  </FormField>

                  <FormField label="Email Address *" hint="We'll email your savings report">
                    <input
                      type="email"
                      value={lead.email}
                      onChange={e => setLead(s => ({ ...s, email: e.target.value }))}
                      placeholder="you@example.com"
                      className={inputCls}
                    />
                  </FormField>
                </div>

                <motion.button
                  onClick={handleSubmitLead}
                  disabled={!canSubmitLead() || saving}
                  whileHover={canSubmitLead() ? { scale: 1.015 } : {}}
                  whileTap={canSubmitLead() ? { scale: 0.985 } : {}}
                  className="w-full h-12 bg-[#D7263D] hover:bg-[#B61F33] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(215,38,61,0.3)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending…
                    </span>
                  ) : (
                    <>Send Me My Free Report <ChevronRight className="h-4 w-4" /></>
                  )}
                </motion.button>

                <p className="text-center text-xs text-[#9C9CA8]">
                  Your information is kept strictly confidential and will only be used to prepare your analysis.
                </p>
              </motion.div>

              <motion.div variants={fadeUp}>
                <button
                  onClick={() => { setStep(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="w-full text-sm text-[#7C7C85] hover:text-[#111113] transition-colors py-2"
                >
                  ← Start over with different figures
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── STEP 2: Thank You ──────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" variants={stagger} initial="hidden" animate="show" className="space-y-5 py-8">

              <motion.div variants={fadeUp} className="text-center space-y-4">
                <div className="mx-auto h-20 w-20 rounded-full bg-[#D7263D]/8 border-2 border-[#D7263D]/20 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-[#D7263D]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#0A1628]">You&apos;re all set!</h2>
                  <p className="text-[#5F5F67] mt-2 text-sm max-w-xs mx-auto">
                    {attribution
                      ? `${attribution.full_name} has been notified and will reach out to you shortly on WhatsApp.`
                      : 'Our team has been notified and will reach out to you shortly on WhatsApp.'}
                  </p>
                </div>
              </motion.div>

              {/* Summary reminder */}
              {result && (
                <motion.div
                  variants={fadeUp}
                  className="rounded-2xl p-5 text-center"
                  style={{ background: 'linear-gradient(135deg, #D7263D 0%, #b61f33 100%)' }}
                >
                  <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Your estimated monthly savings</p>
                  <p className="text-4xl font-black text-white">{formatCurrency(result.monthlySavings)}</p>
                  <p className="text-white/60 text-sm mt-1">per month · based on {result.proposedRate}% market rate</p>
                </motion.div>
              )}

              {/* What to expect */}
              <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-[#111113]/8 shadow-[0_8px_32px_rgba(17,17,19,0.06)] p-5 space-y-3">
                <p className="text-sm font-semibold text-[#0A1628]">What happens next?</p>
                {[
                  { icon: '📲', text: 'Your consultant will WhatsApp you to introduce themselves' },
                  { icon: '📊', text: 'They\'ll send your personalised savings report as a PDF' },
                  { icon: '🏦', text: 'If you\'d like to proceed, they\'ll guide you through the refinancing process — fully managed' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                    <p className="text-sm text-[#5F5F67]">{item.text}</p>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={fadeUp} className="text-center">
                <div className="inline-flex items-center gap-2 text-xs text-[#7C7C85]">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>100% free service — QAI is paid by the bank, not you.</span>
                </div>
              </motion.div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="text-center py-8 text-[#9C9CA8] text-xs border-t border-[#111113]/6 mt-8">
        <p>© {new Date().getFullYear()} Quantify AI Sdn Bhd · SSM: 202501001318</p>
        <p className="mt-1">Malaysia&apos;s premier AI-powered mortgage refinance platform</p>
      </footer>
    </div>
  )
}

// ─── Field helper ──────────────────────────────────────────────
function FormField({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#7C7C85] mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full h-11 px-3.5 text-sm rounded-xl border border-[#D8D8DE] bg-white text-[#111113] placeholder:text-[#9C9CA8] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/25 focus:border-[#D7263D] transition-all'

// ─── Page wrapper with Suspense ────────────────────────────────
export default function FreeAnalysisPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[#D7263D]/30 border-t-[#D7263D] animate-spin" />
      </div>
    }>
      <FreeAnalysisInner />
    </React.Suspense>
  )
}
