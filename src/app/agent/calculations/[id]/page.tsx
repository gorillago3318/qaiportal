"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Pencil, Check, X, ArrowRight,
  TrendingDown, Building2, Calendar, User, Phone,
  Loader2, AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, calcMaxTenureMonths, monthsToYearsMonths, cn } from "@/lib/utils"
import type { Bank } from "@/types/database"

// ─── Types ────────────────────────────────────────────────────

interface CalcData {
  id: string
  client_name: string
  client_ic: string | null
  client_phone: string | null
  client_dob: string | null
  loan_type: "refinance" | "subsale" | "developer"
  current_bank: string | null
  current_loan_amount: number | null
  current_interest_rate: number | null
  current_monthly_instalment: number | null
  current_tenure_months: number | null
  proposed_bank_id: string | null
  proposed_loan_amount: number | null
  proposed_interest_rate: number | null
  proposed_tenure_months: number | null
  has_cash_out: boolean
  cash_out_amount: number | null
  cash_out_tenure_months: number | null
  finance_legal_fees: boolean
  legal_fee_amount: number | null
  valuation_fee_amount: number | null
  stamp_duty_amount: number | null
  results: Record<string, number> | null
  referral_code: string | null
  converted_to_case_id: string | null
  created_at: string
  proposed_bank?: { id: string; name: string; commission_rate: number } | null
}

interface EditState {
  client_name: string
  client_ic: string
  client_phone: string
  client_dob: string
  client_age: string          // alternative to DOB — converted to DOB on save
  current_bank: string
  current_loan_amount: string
  current_interest_rate: string
  current_monthly_instalment: string
  current_tenure_years: string
  current_tenure_months_rem: string
  proposed_bank_id: string
  proposed_loan_amount: string
  proposed_interest_rate: string
  proposed_tenure_years: string
  proposed_tenure_months_rem: string
  has_cash_out: boolean
  cash_out_amount: string
  finance_legal_fees: boolean
  legal_fee_amount: string
  valuation_fee_amount: string
  referral_code: string
}

// ─── Helpers ──────────────────────────────────────────────────

const LOAN_TYPE_LABELS: Record<string, string> = {
  refinance: "Refinance",
  subsale: "Subsale",
  developer: "Developer",
}

const LOAN_TYPE_COLORS: Record<string, string> = {
  refinance: "bg-blue-50 text-blue-700 border-blue-200",
  subsale: "bg-green-50 text-green-700 border-green-200",
  developer: "bg-purple-50 text-purple-700 border-purple-200",
}

const MALAYSIAN_BANKS = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank",
  "AmBank", "OCBC Bank", "UOB Malaysia", "Standard Chartered", "HSBC Bank Malaysia",
  "Alliance Bank", "Affin Bank", "Bank Islam", "Bank Muamalat", "BSN",
  "MBSB Bank", "Citibank Malaysia",
]

function fmtTenure(months: number | null): string {
  if (!months) return "—"
  return monthsToYearsMonths(months)
}

function fmtRate(r: number | null): string {
  if (!r) return "—"
  return `${r}% p.a.`
}

function dobFromAge(age: string): string | null {
  const n = parseInt(age)
  if (!n || n < 1 || n > 100) return null
  const year = new Date().getFullYear() - n
  return `${year}-01-01`
}

function ageFromDob(dob: string | null): string {
  if (!dob) return ""
  const birth = new Date(dob + "T00:00:00")
  const age = new Date().getFullYear() - birth.getFullYear()
  return String(age)
}

// ─── Field component ──────────────────────────────────────────

function Field({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {children ?? <p className="text-sm font-medium text-[#0A1628]">{value || "—"}</p>}
    </div>
  )
}

function EditInput({
  label, value, onChange, type = "text", placeholder, note, required,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; note?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#0A1628] mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
      />
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function CalculationDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [calc, setCalc] = React.useState<CalcData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [edit, setEdit] = React.useState<EditState | null>(null)
  const [banks, setBanks] = React.useState<Bank[]>([])

  // Fetch banks for the proposed bank dropdown
  React.useEffect(() => {
    const supabase = createClient()
    supabase.from("banks").select("*").eq("is_active", true).order("name")
      .then(({ data }) => { if (data) setBanks(data as Bank[]) })
  }, [])

  // Fetch calculation
  React.useEffect(() => {
    if (!id) return
    fetch(`/api/calculations/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) setCalc(json.data)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  function startEdit() {
    if (!calc) return
    const cy = calc.current_tenure_months ? Math.floor(calc.current_tenure_months / 12) : 0
    const cm = calc.current_tenure_months ? calc.current_tenure_months % 12 : 0
    const py = calc.proposed_tenure_months ? Math.floor(calc.proposed_tenure_months / 12) : 0
    const pm = calc.proposed_tenure_months ? calc.proposed_tenure_months % 12 : 0
    setEdit({
      client_name: calc.client_name,
      client_ic: calc.client_ic || "",
      client_phone: calc.client_phone || "",
      client_dob: calc.client_dob || "",
      client_age: ageFromDob(calc.client_dob),
      current_bank: calc.current_bank || "",
      current_loan_amount: calc.current_loan_amount?.toString() || "",
      current_interest_rate: calc.current_interest_rate?.toString() || "",
      current_monthly_instalment: calc.current_monthly_instalment?.toString() || "",
      current_tenure_years: cy.toString(),
      current_tenure_months_rem: cm.toString(),
      proposed_bank_id: calc.proposed_bank_id || "",
      proposed_loan_amount: calc.proposed_loan_amount?.toString() || "",
      proposed_interest_rate: calc.proposed_interest_rate?.toString() || "",
      proposed_tenure_years: py.toString(),
      proposed_tenure_months_rem: pm.toString(),
      has_cash_out: calc.has_cash_out,
      cash_out_amount: calc.cash_out_amount?.toString() || "",
      finance_legal_fees: calc.finance_legal_fees,
      legal_fee_amount: calc.legal_fee_amount?.toString() || "",
      valuation_fee_amount: calc.valuation_fee_amount?.toString() || "",
      referral_code: calc.referral_code || "",
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEdit(null)
  }

  function up(field: keyof EditState, value: string | boolean) {
    setEdit(prev => prev ? { ...prev, [field]: value } : prev)
  }

  // When IC changes, auto-fill DOB + age
  function handleIcChange(ic: string) {
    up("client_ic", ic)
    const digits = ic.replace(/\D/g, "")
    if (digits.length >= 6) {
      const yy = parseInt(digits.substring(0, 2))
      const mm = digits.substring(2, 4)
      const dd = digits.substring(4, 6)
      const century = yy > new Date().getFullYear() % 100 ? 1900 : 2000
      const dob = `${century + yy}-${mm}-${dd}`
      setEdit(prev => prev ? { ...prev, client_ic: ic, client_dob: dob, client_age: ageFromDob(dob) } : prev)
    }
  }

  // When age changes, derive DOB estimate
  function handleAgeChange(age: string) {
    up("client_age", age)
    if (age && !edit?.client_dob) {
      const dob = dobFromAge(age)
      if (dob) up("client_dob", dob)
    }
  }

  async function handleSave() {
    if (!edit || !calc) return
    if (!edit.client_name.trim()) { toast.error("Client name is required"); return }

    setSaving(true)
    try {
      // Resolve DOB: IC auto-fills it; if only age provided, use dobFromAge
      let clientDob = edit.client_dob || null
      if (!clientDob && edit.client_age) clientDob = dobFromAge(edit.client_age)

      const currentTenure = (parseInt(edit.current_tenure_years) || 0) * 12 + (parseInt(edit.current_tenure_months_rem) || 0)
      const proposedTenure = (parseInt(edit.proposed_tenure_years) || 0) * 12 + (parseInt(edit.proposed_tenure_months_rem) || 0)

      const payload = {
        client_name: edit.client_name.trim(),
        client_ic: edit.client_ic || null,
        client_phone: edit.client_phone || null,
        client_dob: clientDob,
        current_bank: edit.current_bank || null,
        current_loan_amount: parseFloat(edit.current_loan_amount) || null,
        current_interest_rate: parseFloat(edit.current_interest_rate) || null,
        current_monthly_instalment: parseFloat(edit.current_monthly_instalment) || null,
        current_tenure_months: currentTenure || null,
        proposed_bank_id: edit.proposed_bank_id || null,
        proposed_loan_amount: parseFloat(edit.proposed_loan_amount) || null,
        proposed_interest_rate: parseFloat(edit.proposed_interest_rate) || null,
        proposed_tenure_months: proposedTenure || null,
        has_cash_out: edit.has_cash_out,
        cash_out_amount: edit.has_cash_out ? parseFloat(edit.cash_out_amount) || null : null,
        finance_legal_fees: edit.finance_legal_fees,
        legal_fee_amount: edit.finance_legal_fees ? parseFloat(edit.legal_fee_amount) || null : null,
        valuation_fee_amount: edit.finance_legal_fees ? parseFloat(edit.valuation_fee_amount) || null : null,
        referral_code: edit.referral_code || null,
      }

      const res = await fetch(`/api/calculations/${calc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save")

      setCalc(prev => prev ? { ...prev, ...json.data, proposed_bank: prev.proposed_bank } : prev)
      // Refresh proposed bank name if bank changed
      if (edit.proposed_bank_id !== calc.proposed_bank_id) {
        const bank = banks.find(b => b.id === edit.proposed_bank_id)
        if (bank) setCalc(prev => prev ? { ...prev, proposed_bank: bank } : prev)
      }
      toast.success("Calculation updated")
      cancelEdit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // ── Computed for display ──────────────────────────────────────

  const maxTenureMonths = React.useMemo(() => {
    if (!calc?.client_dob) return undefined
    return calcMaxTenureMonths(calc.client_dob)
  }, [calc?.client_dob])

  const results = calc?.results as Record<string, number> | null

  // ─── Loading / not found ──────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (notFound || !calc) {
    return (
      <div className="max-w-4xl py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
        <h2 className="font-heading text-xl font-bold text-[#0A1628] mb-2">Calculation not found</h2>
        <p className="text-gray-500 text-sm mb-6">This calculation may have been deleted or you don't have access.</p>
        <Button variant="outline" asChild>
          <Link href="/agent/calculations"><ArrowLeft className="h-4 w-4 mr-2" />Back to Calculations</Link>
        </Button>
      </div>
    )
  }

  // ── Edit form ──────────────────────────────────────────────────

  if (editing && edit) {
    const dobForMax = edit.client_dob || (edit.client_age ? dobFromAge(edit.client_age) : null)
    const editMaxTenure = dobForMax ? calcMaxTenureMonths(dobForMax) : undefined

    return (
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-heading text-xl font-bold text-[#0A1628]">Edit Calculation</h1>
              <p className="text-xs text-gray-500">Changes will not recalculate results — use &ldquo;New Calculation&rdquo; to recompute</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Client Info */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <EditInput label="Client Name" value={edit.client_name} onChange={v => up("client_name", v)}
                placeholder="Full name as per IC" required />
            </div>
            <EditInput label="IC Number" value={edit.client_ic} onChange={handleIcChange}
              placeholder="901231011234 (without dashes)"
              note="Auto-fills date of birth and age" />
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Date of Birth</label>
              <input type="date" value={edit.client_dob}
                onChange={e => setEdit(prev => prev ? { ...prev, client_dob: e.target.value, client_age: ageFromDob(e.target.value) } : prev)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
              {editMaxTenure !== undefined && (
                <p className="text-xs text-gray-500 mt-0.5">Max tenure: {monthsToYearsMonths(editMaxTenure)}</p>
              )}
            </div>
            <EditInput label="Age (years)" value={edit.client_age} onChange={handleAgeChange}
              type="number" placeholder="e.g. 35"
              note={edit.client_dob ? "" : "Used for max tenure if no DOB/IC entered"} />
            <EditInput label="Phone Number" value={edit.client_phone} onChange={v => up("client_phone", v)}
              placeholder="+601X-XXXXXXX" />
            <EditInput label="Referral Code" value={edit.referral_code} onChange={v => up("referral_code", v)}
              placeholder="Optional" />
          </CardContent>
        </Card>

        {/* Current Loan (refinance only) */}
        {calc.loan_type === "refinance" && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Current Loan</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#0A1628] mb-1">Current Bank</label>
                <select value={edit.current_bank} onChange={e => up("current_bank", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]">
                  <option value="">Select bank</option>
                  {MALAYSIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <EditInput label="Outstanding Amount (RM)" value={edit.current_loan_amount} onChange={v => up("current_loan_amount", v)} type="number" placeholder="e.g. 400000" />
              <EditInput label="Interest Rate (%)" value={edit.current_interest_rate} onChange={v => up("current_interest_rate", v)} type="number" placeholder="e.g. 4.5" />
              <EditInput label="Monthly Instalment (RM)" value={edit.current_monthly_instalment} onChange={v => up("current_monthly_instalment", v)} type="number" placeholder="Auto-calculated" />
              <div>
                <label className="block text-xs font-medium text-[#0A1628] mb-1">Remaining Tenure</label>
                <div className="flex gap-2">
                  <input type="number" min={0} max={35} value={edit.current_tenure_years}
                    onChange={e => up("current_tenure_years", e.target.value)} placeholder="Years"
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="number" min={0} max={11} value={edit.current_tenure_months_rem}
                    onChange={e => up("current_tenure_months_rem", e.target.value)} placeholder="Months"
                    className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proposed Loan */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Proposed Loan</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Proposed Bank</label>
              <select value={edit.proposed_bank_id} onChange={e => up("proposed_bank_id", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]">
                <option value="">Select bank</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <EditInput label="Loan Amount (RM)" value={edit.proposed_loan_amount} onChange={v => up("proposed_loan_amount", v)} type="number" placeholder="e.g. 500000" />
            <EditInput label="Interest Rate (%)" value={edit.proposed_interest_rate} onChange={v => up("proposed_interest_rate", v)} type="number" placeholder="e.g. 3.85" />
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">
                Tenure
                {editMaxTenure !== undefined && (
                  <span className="text-gray-400 font-normal ml-1">(max {monthsToYearsMonths(editMaxTenure)})</span>
                )}
              </label>
              <div className="flex gap-2">
                <input type="number" min={0} max={35} value={edit.proposed_tenure_years}
                  onChange={e => up("proposed_tenure_years", e.target.value)} placeholder="Years"
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                <input type="number" min={0} max={11} value={edit.proposed_tenure_months_rem}
                  onChange={e => up("proposed_tenure_months_rem", e.target.value)} placeholder="Months"
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
              </div>
            </div>
            {/* Finance Fees toggle */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={edit.finance_legal_fees}
                  onChange={e => up("finance_legal_fees", e.target.checked)}
                  className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]" />
                <span className="text-sm text-[#0A1628]">Finance legal &amp; valuation fees into loan</span>
              </label>
            </div>
            {edit.finance_legal_fees && (
              <>
                <EditInput label="Legal Fee (RM)" value={edit.legal_fee_amount} onChange={v => up("legal_fee_amount", v)} type="number" placeholder="e.g. 5000" />
                <EditInput label="Valuation Fee (RM)" value={edit.valuation_fee_amount} onChange={v => up("valuation_fee_amount", v)} type="number" placeholder="e.g. 2000" />
              </>
            )}
            {/* Cash out */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={edit.has_cash_out}
                  onChange={e => up("has_cash_out", e.target.checked)}
                  className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]" />
                <span className="text-sm text-[#0A1628]">Include cash-out</span>
              </label>
            </div>
            {edit.has_cash_out && (
              <EditInput label="Cash-Out Amount (RM)" value={edit.cash_out_amount} onChange={v => up("cash_out_amount", v)} type="number" placeholder="e.g. 50000" />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── View mode ─────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/agent/calculations")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading text-xl font-bold text-[#0A1628]">{calc.client_name}</h1>
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", LOAN_TYPE_COLORS[calc.loan_type])}>
                {LOAN_TYPE_LABELS[calc.loan_type]}
              </span>
              {calc.converted_to_case_id && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                  Converted to Case
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Created {formatDate(calc.created_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          {!calc.converted_to_case_id && (
            <Button size="sm" className="bg-[#0A1628] text-white hover:bg-[#0d1f38]" asChild>
              <Link href={`/agent/cases/new?from_calculation=${calc.id}`}>
                Create Case <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" /> Client Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Full Name" value={calc.client_name} />
          <Field label="IC Number" value={calc.client_ic} />
          <Field label="Date of Birth">
            {calc.client_dob ? (
              <div>
                <p className="text-sm font-medium text-[#0A1628]">
                  {new Date(calc.client_dob + "T00:00:00").toLocaleDateString("en-GB")}
                </p>
                {maxTenureMonths !== undefined && (
                  <p className="text-xs text-gray-500">Max tenure: {monthsToYearsMonths(maxTenureMonths)}</p>
                )}
              </div>
            ) : <p className="text-sm text-gray-400">—</p>}
          </Field>
          <Field label="Phone" value={calc.client_phone} />
        </CardContent>
      </Card>

      {/* Current Loan (refinance) */}
      {calc.loan_type === "refinance" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" /> Current Loan
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Bank" value={calc.current_bank} />
            <Field label="Outstanding Amount" value={calc.current_loan_amount ? formatCurrency(calc.current_loan_amount) : null} />
            <Field label="Interest Rate" value={fmtRate(calc.current_interest_rate)} />
            <Field label="Monthly Instalment" value={calc.current_monthly_instalment ? formatCurrency(calc.current_monthly_instalment) : null} />
            <Field label="Remaining Tenure" value={fmtTenure(calc.current_tenure_months)} />
          </CardContent>
        </Card>
      )}

      {/* Proposed Loan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-gray-400" /> Proposed Loan
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Bank" value={calc.proposed_bank?.name} />
          <Field label="Loan Amount" value={calc.proposed_loan_amount ? formatCurrency(calc.proposed_loan_amount) : null} />
          <Field label="Interest Rate" value={fmtRate(calc.proposed_interest_rate)} />
          <Field label="Tenure" value={fmtTenure(calc.proposed_tenure_months)} />
          {calc.has_cash_out && <Field label="Cash-Out Amount" value={calc.cash_out_amount ? formatCurrency(calc.cash_out_amount) : null} />}
          {calc.finance_legal_fees && (
            <>
              <Field label="Legal Fee" value={calc.legal_fee_amount ? formatCurrency(calc.legal_fee_amount) : null} />
              <Field label="Valuation Fee" value={calc.valuation_fee_amount ? formatCurrency(calc.valuation_fee_amount) : null} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (results.monthlySavings > 0 || results.proposedMonthlyInstalment > 0) && (
        <Card className="border-[#C9A84C]/30 bg-[#FFFDF5]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#C9A84C]" /> Calculation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="New Monthly Instalment">
              <p className="text-lg font-bold text-[#0A1628]">{formatCurrency(results.proposedMonthlyInstalment)}</p>
            </Field>
            {results.monthlySavings > 0 && (
              <Field label="Monthly Savings">
                <p className="text-lg font-bold text-green-700">+{formatCurrency(results.monthlySavings)}</p>
              </Field>
            )}
            {results.totalInterestSaved > 0 && (
              <Field label="Total Interest Saved">
                <p className="text-sm font-semibold text-green-700">{formatCurrency(results.totalInterestSaved)}</p>
              </Field>
            )}
            {results.tenureSavedMonths > 0 && (
              <Field label="Tenure Saved" value={monthsToYearsMonths(results.tenureSavedMonths)} />
            )}
            {results.breakEvenMonths > 0 && (
              <Field label="Break Even" value={monthsToYearsMonths(results.breakEvenMonths)} />
            )}
            {results.biweeklyPayment > 0 && (
              <Field label="Bi-Weekly Payment">
                <p className="text-sm font-medium text-[#0A1628]">{formatCurrency(results.biweeklyPayment)}</p>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      {/* Referral */}
      {calc.referral_code && (
        <div className="text-xs text-gray-400">Referral: {calc.referral_code}</div>
      )}
    </div>
  )
}
