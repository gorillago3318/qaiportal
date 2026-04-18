'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Calculator, CheckCircle, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { calculateMonthlyInstalment, calculateRefinance } from '@/lib/calculations/loan'
import { formatCurrency, formatDateOnly, calcMaxTenureMonths, monthsToYearsMonths } from '@/lib/utils'
import type { Bank } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────

interface FormState {
  clientName: string
  clientIc: string
  clientPhone: string
  clientDob: string
  loanType: 'refinance' | 'subsale' | 'developer'
  currentBank: string
  currentLoanAmount: number | undefined
  currentInterestRate: number | undefined
  currentTenureYears: number | undefined
  proposedBankId: string
  proposedLoanAmount: number | undefined
  proposedInterestRate: number | undefined
  proposedTenureYears: number | undefined
}

const MALAYSIAN_BANKS = [
  'Maybank', 'CIMB', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'OCBC', 'UOB', 'Standard Chartered', 'HSBC',
  'Affin Bank', 'Alliance Bank', 'Bank Islam', 'Bank Muamalat', 'BSN',
]

// ─── Main Page ────────────────────────────────────────────────

function PublicCalculatorInner() {
  const searchParams = useSearchParams()
  const referralCode = searchParams.get('ref') || ''

  const [step, setStep] = React.useState(0) // 0 = info, 1 = current loan, 2 = new loan, 3 = results
  const [form, setForm] = React.useState<FormState>({
    clientName: '',
    clientIc: '',
    clientPhone: '+60',
    clientDob: '',
    loanType: 'refinance',
    currentBank: '',
    currentLoanAmount: undefined,
    currentInterestRate: undefined,
    currentTenureYears: undefined,
    proposedBankId: '',
    proposedLoanAmount: undefined,
    proposedInterestRate: undefined,
    proposedTenureYears: undefined,
  })
  const [banks, setBanks] = React.useState<Bank[]>([])
  const [result, setResult] = React.useState<null | { monthlySavings: number; newMonthly: number; totalInterestSaved: number }>(null)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [attribution, setAttribution] = React.useState<{ agent_code: string; full_name: string } | null>(null)

  const maxTenure = form.clientDob ? calcMaxTenureMonths(form.clientDob) : undefined

  React.useEffect(() => {
    createClient().from('banks').select('*').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setBanks(data as Bank[])
    })
  }, [])

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(s => ({ ...s, [key]: val }))
  }

  function canProceed() {
    if (step === 0) return form.clientName.trim().length > 0
    if (step === 1) return !!(form.currentLoanAmount && form.currentInterestRate && form.currentTenureYears)
    if (step === 2) return !!(form.proposedBankId && form.proposedLoanAmount && form.proposedInterestRate && form.proposedTenureYears)
    return true
  }

  function calculate() {
    const currentMonths = (form.currentTenureYears ?? 0) * 12
    const proposedMonths = (form.proposedTenureYears ?? 0) * 12
    const currentMI = calculateMonthlyInstalment(form.currentLoanAmount ?? 0, form.currentInterestRate ?? 0, currentMonths)
    const r = calculateRefinance({
      currentLoanAmount: form.currentLoanAmount ?? 0,
      currentInterestRate: form.currentInterestRate ?? 0,
      currentMonthlyInstalment: currentMI,
      currentTenureMonths: currentMonths,
      proposedLoanAmount: form.proposedLoanAmount ?? 0,
      proposedInterestRate: form.proposedInterestRate ?? 0,
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
      totalInterestSaved: r.totalInterestSaved,
    })
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/public/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: referralCode || null,
          client_name: form.clientName,
          client_ic: form.clientIc || null,
          client_phone: form.clientPhone || null,
          client_dob: form.clientDob || null,
          loan_type: form.loanType,
          current_bank: form.currentBank || null,
          current_loan_amount: form.currentLoanAmount ?? null,
          current_interest_rate: form.currentInterestRate ?? null,
          current_monthly_instalment: form.currentLoanAmount && form.currentInterestRate && form.currentTenureYears
            ? calculateMonthlyInstalment(form.currentLoanAmount, form.currentInterestRate, form.currentTenureYears * 12)
            : null,
          current_tenure_months: form.currentTenureYears ? form.currentTenureYears * 12 : null,
          proposed_bank_id: form.proposedBankId || null,
          proposed_loan_amount: form.proposedLoanAmount ?? null,
          proposed_interest_rate: form.proposedInterestRate ?? null,
          proposed_tenure_months: form.proposedTenureYears ? form.proposedTenureYears * 12 : null,
          results: result,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSaved(true)
        setAttribution(json.attributed_to)
        toast.success('Your results have been saved! A consultant will reach out to you shortly.')
      } else {
        toast.error(json.error || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedBank = banks.find(b => b.id === form.proposedBankId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-white/5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-tight">QuantifyAI</p>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Mortgage Calculator</p>
            </div>
          </div>
          {referralCode && (
            <span className="text-xs text-white/50 bg-white/10 border border-white/10 px-3 py-1 rounded-full">
              Ref: <span className="text-white/80 font-mono font-semibold">{referralCode}</span>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Progress */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-8">
            {['Your Info', 'Current Loan', 'New Loan'].map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-1.5">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < step ? 'bg-blue-500 text-white' : i === step ? 'bg-white text-slate-900' : 'bg-white/10 text-white/40'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block ${i === step ? 'text-white' : 'text-white/40'}`}>{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px ${i < step ? 'bg-blue-500' : 'bg-white/10'}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {/* Step 0: Personal Info */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Free Mortgage Calculator</h1>
                  <p className="text-white/60 text-sm mt-2">Find out how much you can save by refinancing. Takes 2 minutes.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <Field label="Your Name *" hint="">
                    <input type="text" value={form.clientName} onChange={e => update('clientName', e.target.value)} placeholder="Full name as per IC" className={inputCls} />
                  </Field>
                  <Field label="IC Number" hint="DOB will auto-fill from your IC">
                    <input
                      type="text"
                      value={form.clientIc}
                      onChange={e => {
                        const ic = e.target.value
                        update('clientIc', ic)
                        const d = ic.replace(/\D/g, '')
                        if (d.length >= 6) {
                          const yy = parseInt(d.substring(0, 2))
                          const mm = d.substring(2, 4)
                          const dd = d.substring(4, 6)
                          const cent = yy > new Date().getFullYear() % 100 ? 1900 : 2000
                          update('clientDob', `${cent + yy}-${mm}-${dd}`)
                        }
                      }}
                      placeholder="901231011234"
                      maxLength={14}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Phone Number" hint="">
                    <input type="tel" value={form.clientPhone} onChange={e => update('clientPhone', e.target.value)} placeholder="+60 12-345 6789" className={inputCls} />
                  </Field>
                  <Field
                    label="Date of Birth (DD/MM/YYYY)"
                    hint={form.clientDob
                      ? `✓ ${(() => { const [y,m,d] = form.clientDob.split('-'); return `${d}/${m}/${y}` })()}${maxTenure ? ` · Max tenure: ${monthsToYearsMonths(maxTenure)}` : ''}`
                      : 'Auto-filled from IC'}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="DD/MM/YYYY"
                      value={form.clientDob ? (() => { const [y,m,d] = form.clientDob.split('-'); return `${d}/${m}/${y}` })() : ""}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^\d/]/g, "")
                        if (raw.length === 10 && raw.includes('/')) {
                          const parts = raw.split('/')
                          if (parts.length === 3) {
                            const [dd, mm, yyyy] = parts
                            const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
                            if (!isNaN(new Date(iso + "T00:00:00").getTime())) update('clientDob', iso)
                          }
                        }
                      }}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 1: Current Loan */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">Current Loan</h2>
                  <p className="text-white/60 text-sm mt-1">Tell us about your existing mortgage</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <Field label="Current Bank" hint="">
                    <input type="text" list="banks-dl" value={form.currentBank} onChange={e => update('currentBank', e.target.value)} placeholder="e.g. Maybank" className={inputCls} />
                    <datalist id="banks-dl">{MALAYSIAN_BANKS.map(b => <option key={b} value={b} />)}</datalist>
                  </Field>
                  <Field label="Outstanding Loan Amount (RM) *" hint="">
                    <input type="number" value={form.currentLoanAmount ?? ''} onChange={e => update('currentLoanAmount', parseFloat(e.target.value) || undefined)} placeholder="500000" className={inputCls} />
                  </Field>
                  <Field label="Current Interest Rate (% p.a.) *" hint="">
                    <input type="number" step="0.01" value={form.currentInterestRate ?? ''} onChange={e => update('currentInterestRate', parseFloat(e.target.value) || undefined)} placeholder="4.50" className={inputCls} />
                  </Field>
                  <Field label="Remaining Tenure (years) *" hint={maxTenure ? `Max: ${Math.floor(maxTenure / 12)} years` : ''}>
                    <input type="number" min="1" max="35" value={form.currentTenureYears ?? ''} onChange={e => update('currentTenureYears', parseInt(e.target.value) || undefined)} placeholder="25" className={inputCls} />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 2: New Loan */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">New Loan</h2>
                  <p className="text-white/60 text-sm mt-1">Enter the proposed loan details</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <Field label="Proposed Bank *" hint="">
                    <select value={form.proposedBankId} onChange={e => {
                      const b = banks.find(b => b.id === e.target.value)
                      update('proposedBankId', e.target.value)
                      if (b?.interest_rate) update('proposedInterestRate', b.interest_rate)
                    }} className={inputCls}>
                      <option value="">Select bank...</option>
                      {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                  <Field label="New Loan Amount (RM) *" hint={form.currentLoanAmount ? `Current: RM ${form.currentLoanAmount.toLocaleString()}` : ''}>
                    <input type="number" value={form.proposedLoanAmount ?? ''} onChange={e => update('proposedLoanAmount', parseFloat(e.target.value) || undefined)} placeholder={String(form.currentLoanAmount ?? '500000')} className={inputCls} />
                  </Field>
                  <Field label="New Interest Rate (% p.a.) *" hint={selectedBank?.interest_rate ? `${selectedBank.name} rate: ${selectedBank.interest_rate}%` : ''}>
                    <input type="number" step="0.01" value={form.proposedInterestRate ?? ''} onChange={e => update('proposedInterestRate', parseFloat(e.target.value) || undefined)} placeholder="3.85" className={inputCls} />
                  </Field>
                  <Field label="New Tenure (years) *" hint={maxTenure ? `Max: ${Math.floor(maxTenure / 12)} years based on your age` : ''}>
                    <div className="space-y-2">
                      <input type="number" min="1" max="35" value={form.proposedTenureYears ?? ''} onChange={e => update('proposedTenureYears', parseInt(e.target.value) || undefined)} placeholder="35" className={inputCls} />
                      <div className="flex gap-2">
                        {[35, 30, 25].map(y => (
                          <button key={y} type="button" onClick={() => update('proposedTenureYears', y)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.proposedTenureYears === y ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-white/60 hover:border-white/40'}`}>
                            {y}y
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {/* Step 3: Results */}
            {step === 3 && result && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Your Results</h2>
                  <p className="text-white/60 text-sm mt-1">Here&apos;s how much you could save by refinancing</p>
                </div>

                {/* Big savings cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`rounded-2xl p-5 text-center ${result.monthlySavings > 0 ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-white/5 border border-white/10'}`}>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Monthly Savings</p>
                    <p className={`text-3xl font-bold ${result.monthlySavings > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {result.monthlySavings > 0 ? '+' : ''}{formatCurrency(result.monthlySavings)}
                    </p>
                    <p className="text-white/40 text-xs mt-1">per month</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">New Monthly Payment</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(result.newMonthly)}</p>
                    <p className="text-white/40 text-xs mt-1">per month</p>
                  </div>
                  <div className={`rounded-2xl p-5 text-center ${result.totalInterestSaved > 0 ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-white/5 border border-white/10'}`}>
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Total Interest Saved</p>
                    <p className="text-blue-300 text-3xl font-bold">{formatCurrency(Math.max(0, result.totalInterestSaved))}</p>
                    <p className="text-white/40 text-xs mt-1">over loan life</p>
                  </div>
                </div>

                {!saved ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                    <p className="text-white font-semibold">Want a free consultation?</p>
                    <p className="text-white/60 text-sm">Save your results and one of our consultants will reach out to discuss your options.</p>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save & Get Free Consultation'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-5 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-emerald-300 font-semibold">Results saved successfully!</p>
                      <p className="text-emerald-300/70 text-sm mt-1">
                        {attribution
                          ? `Your consultant ${attribution.full_name} (${attribution.agent_code}) has been notified and will reach out to you shortly.`
                          : 'Our team will reach out to you shortly.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        {step < 3 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => { setStep(s => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/60 border border-white/10 hover:border-white/30 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {step < 2 ? (
              <button
                onClick={() => { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={calculate}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Calculator className="h-4 w-4" /> Calculate
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-white/20 text-xs">
        © {new Date().getFullYear()} QuantifyAI Sdn Bhd · Free Mortgage Calculator
      </footer>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full h-10 px-3 text-sm rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors'

// ─── Page wrapper with Suspense ───────────────────────────────

export default function PublicCalculatorPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    }>
      <PublicCalculatorInner />
    </React.Suspense>
  )
}
