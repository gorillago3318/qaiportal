"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, User, Building2, MapPin, Landmark, Clock, MessageSquare, CheckCircle2, Send,
  FileText, Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatCurrency, formatDate, formatDateTime, monthsToYearsMonths } from "@/lib/utils"
import { CASE_STATUS_LABELS, LOAN_TYPE_LABELS, type CaseStatus } from "@/types/database"

const STATUS_COLORS: Record<CaseStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  bank_processing: "bg-amber-100 text-amber-700",
  kiv: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-600",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
  pending_execution: "bg-indigo-100 text-indigo-700",
  executed: "bg-cyan-100 text-cyan-700",
  payment_pending: "bg-purple-100 text-purple-700",
  paid: "bg-teal-100 text-teal-700",
}

const STATUS_FLOW: CaseStatus[] = [
  "draft", "submitted", "bank_processing", "kiv", "approved", "declined",
  "accepted", "rejected", "pending_execution", "executed", "payment_pending", "paid",
]

type CaseDetail = {
  id: string
  case_code: string
  status: CaseStatus
  loan_type: string
  current_bank: string | null
  current_loan_amount: number | null
  current_interest_rate: number | null
  current_monthly_instalment: number | null
  current_tenure_months: number | null
  is_islamic: boolean
  has_lock_in: boolean
  property_address: string | null
  property_type: string | null
  property_title: string | null
  property_tenure: string | null
  property_value: number | null
  proposed_loan_amount: number | null
  proposed_interest_rate: number | null
  proposed_tenure_months: number | null
  has_cash_out: boolean
  cash_out_amount: number | null
  finance_legal_fees: boolean
  lawyer_quotation_url: string | null
  valuer_1_firm: string | null
  valuer_1_name: string | null
  valuer_1_date: string | null
  valuer_1_amount: number | null
  valuer_2_firm: string | null
  valuer_2_name: string | null
  valuer_2_date: string | null
  valuer_2_amount: number | null
  admin_remarks: string | null
  created_at: string
  client: { full_name: string; ic_number: string; phone: string; email: string | null; monthly_income: number | null } | null
  agent: { full_name: string; agent_code: string | null; email: string; phone: string | null } | null
  proposed_bank: { name: string } | null
  status_history: {
    id: string; from_status: string | null; to_status: string; notes: string | null; created_at: string
    changed_by_profile: { full_name: string; role: string } | null
  }[]
  comments: {
    id: string; content: string; is_admin: boolean; created_at: string
    author: { full_name: string; role: string } | null
  }[]
  case_documents: { id: string; document_type: string; file_name: string; file_url: string; created_at: string }[]
  has_lawyer_discount: boolean
  lawyer_discount_amount: number | null
  lawyer_name_other: string | null
  lawyer_firm_other: string | null
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 min-w-[140px]">{label}</span>
      <span className="text-sm font-medium text-[#0A1628] text-right">{value || "—"}</span>
    </div>
  )
}

export default function AdminCaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [caseData, setCaseData] = React.useState<CaseDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [newStatus, setNewStatus] = React.useState<CaseStatus | "">("")
  const [statusNotes, setStatusNotes] = React.useState("")
  const [adminRemarks, setAdminRemarks] = React.useState("")
  const [updatingStatus, setUpdatingStatus] = React.useState(false)
  const [savingRemarks, setSavingRemarks] = React.useState(false)
  const [comment, setComment] = React.useState("")
  const [sendingComment, setSendingComment] = React.useState(false)

  const [commissionGross, setCommissionGross] = React.useState("0")
  const [commissionDiscount, setCommissionDiscount] = React.useState("0")
  const [commissionNotes, setCommissionNotes] = React.useState("")
  const [calculatingComms, setCalculatingComms] = React.useState(false)
  const [commissionPreview, setCommissionPreview] = React.useState<Record<string,{name:string;role:string;percentage:number;amount:number}> | null>(null)
  const [loadingCommPreview, setLoadingCommPreview] = React.useState(false)
  const [isPanelLawyer, setIsPanelLawyer] = React.useState(false)
  const [lawyerGross, setLawyerGross] = React.useState("0")
  
  const [valuationData, setValuationData] = React.useState({
    valuer_1_firm: "", valuer_1_name: "", valuer_1_date: "", valuer_1_amount: "" as string | number,
    valuer_2_firm: "", valuer_2_name: "", valuer_2_date: "", valuer_2_amount: "" as string | number,
  })
  const [savingValuation, setSavingValuation] = React.useState(false)
  const [sendingToLawyer, setSendingToLawyer] = React.useState(false)
  const [laPreparationSent, setLaPreparationSent] = React.useState<string | null>(null)

  const fetchCase = React.useCallback(async () => {
    const res = await fetch(`/api/cases/${id}`)
    if (res.ok) {
      const json = await res.json()
      setCaseData(json.data)
      setAdminRemarks(json.data.admin_remarks || "")
      setNewStatus(json.data.status)
      // Check if LA prep already sent
      const bfd = json.data.bank_form_data as Record<string, unknown> | null
      if (bfd?.la_preparation_sent) {
        const entry = bfd.la_preparation_sent as { sent_at: string }
        setLaPreparationSent(entry.sent_at)
      }
      setValuationData({
        valuer_1_firm: json.data.valuer_1_firm || "",
        valuer_1_name: json.data.valuer_1_name || "",
        valuer_1_date: json.data.valuer_1_date || "",
        valuer_1_amount: json.data.valuer_1_amount || "",
        valuer_2_firm: json.data.valuer_2_firm || "",
        valuer_2_name: json.data.valuer_2_name || "",
        valuer_2_date: json.data.valuer_2_date || "",
        valuer_2_amount: json.data.valuer_2_amount || "",
      })
      // Auto-preview commission if case is accepted or beyond
      const commissionStatuses: CaseStatus[] = ['accepted', 'pending_execution', 'executed', 'payment_pending', 'paid']
      if (commissionStatuses.includes(json.data.status)) {
        // Check if panel lawyer
        const panelLawyer = !json.data.lawyer_name_other
        setIsPanelLawyer(panelLawyer)
        // Pre-fill professional fee from case data
        if (json.data.professional_fee) {
          setLawyerGross(String(json.data.professional_fee))
        }
        // Auto-load preview (GET endpoint — auto-computes from loan amount × bank rate)
        setLoadingCommPreview(true)
        try {
          const prevRes = await fetch(`/api/cases/${id}/commission/preview`)
          if (prevRes.ok) {
            const prevJson = await prevRes.json()
            // New response: { bank: { gross, net_distributable, rows: [...] }, lawyer: { ... } }
            if (prevJson.bank) {
              // Use bank gross from preview
              setCommissionGross(prevJson.bank.gross?.toFixed(2) ?? "0")
              // Build commissionPreview map from rows array
              if (prevJson.bank.rows) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const map: Record<string, {name:string;role:string;percentage:number;amount:number}> = {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                prevJson.bank.rows.forEach((row: any) => { map[row.id] = row })
                setCommissionPreview(map)
              }
            }
          }
        } catch {/* silent */} finally { setLoadingCommPreview(false) }
      }
    } else {
      toast.error("Case not found")
      router.push("/admin/cases")
    }
    setLoading(false)
  }, [id, router])

  React.useEffect(() => { fetchCase() }, [fetchCase])

  const handleSendToLawyer = async () => {
    setSendingToLawyer(true)
    try {
      const res = await fetch(`/api/cases/${id}/send-to-lawyer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || "Failed to send"); return }
      if (j.email_sent) {
        toast.success("Documents sent to lawyer for LA preparation")
      } else {
        toast.success(`Logged — ${j.email_error || "email not configured"}`)
      }
      setLaPreparationSent(new Date().toISOString())
      fetchCase()
    } catch {
      toast.error("Request failed")
    } finally {
      setSendingToLawyer(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === caseData?.status) return
    setUpdatingStatus(true)
    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, notes: statusNotes }),
    })
    if (res.ok) { toast.success("Status updated"); setStatusNotes(""); fetchCase() }
    else { const j = await res.json(); toast.error(j.error || "Failed to update") }
    setUpdatingStatus(false)
  }

  const handleSaveRemarks = async () => {
    setSavingRemarks(true)
    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_remarks: adminRemarks }),
    })
    if (res.ok) toast.success("Remarks saved")
    else toast.error("Failed to save remarks")
    setSavingRemarks(false)
  }

  const handleSaveValuation = async () => {
    setSavingValuation(true)
    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valuer_1_firm: valuationData.valuer_1_firm || null,
        valuer_1_name: valuationData.valuer_1_name || null,
        valuer_1_date: valuationData.valuer_1_date || null,
        valuer_1_amount: valuationData.valuer_1_amount ? Number(valuationData.valuer_1_amount) : null,
        valuer_2_firm: valuationData.valuer_2_firm || null,
        valuer_2_name: valuationData.valuer_2_name || null,
        valuer_2_date: valuationData.valuer_2_date || null,
        valuer_2_amount: valuationData.valuer_2_amount ? Number(valuationData.valuer_2_amount) : null,
      }),
    })
    if (res.ok) {
      toast.success("Valuation saved")
      fetchCase()
    } else toast.error("Failed to save valuation")
    setSavingValuation(false)
  }

  const handleGenerateCommission = async () => {
    if (!caseData?.agent?.agent_code) return
    setCalculatingComms(true)
    try {
      const payload = {
        bank_gross: parseFloat(commissionGross) || 0,
        bank_discount: parseFloat(commissionDiscount) || 0,
        professional_fee: !caseData.lawyer_name_other && parseFloat(lawyerGross) > 0
          ? parseFloat(lawyerGross)
          : undefined,
        notes: commissionNotes,
      }

      const res = await fetch(`/api/cases/${id}/commission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success("Commission finalized and paid!")
        fetchCase()
      } else {
        const j = await res.json()
        toast.error(j.error || "Failed to finalize commission")
      }
    } catch {
      toast.error("An error occurred")
    }
    setCalculatingComms(false)
  }

  const handleSendComment = async () => {
    if (!comment.trim()) return
    setSendingComment(true)
    const res = await fetch(`/api/cases/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    })
    if (res.ok) { setComment(""); fetchCase() }
    else toast.error("Failed to send comment")
    setSendingComment(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-7xl">
        <div className="h-8 w-64 bg-gray-100 rounded" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="h-48 bg-gray-100 rounded-2xl" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!caseData) return null

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/cases">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-bold text-[#0A1628] font-mono">{caseData.case_code}</h1>
            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[caseData.status]}`}>
              {CASE_STATUS_LABELS[caseData.status]}
            </span>
            <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {LOAN_TYPE_LABELS[caseData.loan_type as keyof typeof LOAN_TYPE_LABELS] || caseData.loan_type}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            Created {formatDate(caseData.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-[#C9A84C]" /> Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Full Name" value={caseData.client?.full_name} />
              <InfoRow label="IC Number" value={caseData.client?.ic_number} />
              <InfoRow label="Phone" value={caseData.client?.phone} />
              <InfoRow label="Email" value={caseData.client?.email} />
              <InfoRow label="Monthly Income" value={caseData.client?.monthly_income ? formatCurrency(caseData.client.monthly_income) : null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4 text-[#C9A84C]" /> Current Loan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Current Bank" value={caseData.current_bank} />
              <InfoRow label="Loan Amount" value={caseData.current_loan_amount ? formatCurrency(caseData.current_loan_amount) : null} />
              <InfoRow label="Interest Rate" value={caseData.current_interest_rate ? `${caseData.current_interest_rate}% p.a.` : null} />
              <InfoRow label="Monthly Instalment" value={caseData.current_monthly_instalment ? formatCurrency(caseData.current_monthly_instalment) : null} />
              <InfoRow label="Remaining Tenure" value={caseData.current_tenure_months ? monthsToYearsMonths(caseData.current_tenure_months) : null} />
              <InfoRow label="Islamic" value={caseData.is_islamic ? "Yes" : "No"} />
              <InfoRow label="Lock-in Period" value={caseData.has_lock_in ? "Yes" : "No"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-[#C9A84C]" /> Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Address" value={caseData.property_address} />
              <InfoRow label="Type" value={caseData.property_type} />
              <InfoRow label="Title" value={caseData.property_title} />
              <InfoRow label="Tenure" value={caseData.property_tenure} />
              <InfoRow label="Market Value" value={caseData.property_value ? formatCurrency(caseData.property_value) : null} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-[#C9A84C]" /> Proposed Loan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Bank" value={caseData.proposed_bank?.name} />
              <InfoRow label="Loan Amount" value={caseData.proposed_loan_amount ? formatCurrency(caseData.proposed_loan_amount) : null} />
              <InfoRow label="Interest Rate" value={caseData.proposed_interest_rate ? `${caseData.proposed_interest_rate}% p.a.` : null} />
              <InfoRow label="Tenure" value={caseData.proposed_tenure_months ? monthsToYearsMonths(caseData.proposed_tenure_months) : null} />
              {caseData.has_cash_out && <InfoRow label="Cash Out" value={caseData.cash_out_amount ? formatCurrency(caseData.cash_out_amount) : null} />}
              <InfoRow label="Finance Legal Fees" value={caseData.finance_legal_fees ? "Yes" : "No"} />
              <InfoRow label="Lawyer Quotation URL" value={caseData.lawyer_quotation_url ? <a href={caseData.lawyer_quotation_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Document</a> : null} />
            </CardContent>
          </Card>

          {/* Valuation Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Valuation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0A1628]">Valuer 1 (Required)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Firm Name" value={valuationData.valuer_1_firm} onChange={e => setValuationData(d => ({ ...d, valuer_1_firm: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="text" placeholder="Valuer Name" value={valuationData.valuer_1_name} onChange={e => setValuationData(d => ({ ...d, valuer_1_name: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="date" value={valuationData.valuer_1_date} onChange={e => setValuationData(d => ({ ...d, valuer_1_date: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="number" placeholder="Amount (RM)" value={valuationData.valuer_1_amount} onChange={e => setValuationData(d => ({ ...d, valuer_1_amount: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#0A1628]">Valuer 2 (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Firm Name" value={valuationData.valuer_2_firm} onChange={e => setValuationData(d => ({ ...d, valuer_2_firm: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="text" placeholder="Valuer Name" value={valuationData.valuer_2_name} onChange={e => setValuationData(d => ({ ...d, valuer_2_name: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="date" value={valuationData.valuer_2_date} onChange={e => setValuationData(d => ({ ...d, valuer_2_date: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                  <input type="number" placeholder="Amount (RM)" value={valuationData.valuer_2_amount} onChange={e => setValuationData(d => ({ ...d, valuer_2_amount: e.target.value }))} className="w-full text-sm h-10 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
                </div>
              </div>

              <Button onClick={handleSaveValuation} disabled={savingValuation} variant="outline" size="sm" className="w-full">
                {savingValuation ? "Saving..." : "Save Valuation"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-[#C9A84C]" /> Assigned Agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Name" value={caseData.agent?.full_name} />
              <InfoRow label="Agent Code" value={caseData.agent?.agent_code} />
              <InfoRow label="Email" value={caseData.agent?.email} />
              <InfoRow label="Phone" value={caseData.agent?.phone} />
            </CardContent>
          </Card>

          {caseData.case_documents && caseData.case_documents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Case Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {caseData.case_documents.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#C9A84C] hover:bg-amber-50/40 transition-all group"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0A1628] group-hover:text-[#C9A84C]">{doc.document_type}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{doc.file_name}</p>
                    </div>
                    <span className="text-xs text-[#C9A84C] font-medium">View →</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {(['accepted','pending_execution','executed','payment_pending'] as CaseStatus[]).includes(caseData.status) && (
            <Card className="border-[#C9A84C]/40 bg-gradient-to-br from-amber-50/50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#0A1628] flex items-center gap-2">
                  💰 Commission Payout
                </CardTitle>
                <div className="space-y-0.5 mt-1">
                  {caseData.has_lawyer_discount && (
                    <p className="text-xs text-amber-600">⚠ Lawyer discount: RM {caseData.lawyer_discount_amount?.toFixed(2)}</p>
                  )}
                  {caseData.lawyer_name_other ? (
                    <p className="text-xs text-gray-500">External Lawyer: {caseData.lawyer_name_other} — no lawyer commission</p>
                  ) : (
                    <p className="text-xs text-emerald-600">✓ Panel Lawyer — both Bank & Lawyer commissions apply</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* ── BANK COMMISSION ── */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">Bank Commission</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Bank Gross (RM) <span className="text-gray-400 font-normal">— loan × rate</span>
                      </label>
                      <input type="number" value={commissionGross} onChange={e => setCommissionGross(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Admin Adjustment (RM)</label>
                      <input type="number" value={commissionDiscount} onChange={e => setCommissionDiscount(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                    </div>
                  </div>
                  {/* Auto-deduction summary */}
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                    <div className="flex justify-between"><span>Bank Gross</span><span className="font-medium">RM {(parseFloat(commissionGross)||0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-red-500"><span>— RM50 flat fee (always)</span><span>– RM 50.00</span></div>
                    {!caseData.lawyer_name_other && (
                      <div className="flex justify-between text-red-500"><span>— RM200 loan agreement (panel lawyer)</span><span>– RM 200.00</span></div>
                    )}
                    {parseFloat(commissionDiscount) > 0 && (
                      <div className="flex justify-between text-red-500"><span>— Admin adjustment</span><span>– RM {(parseFloat(commissionDiscount)||0).toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold text-[#0A1628] border-t pt-1 mt-1">
                      <span>Net Distributable (Bank)</span>
                      <span>RM {Math.max(0, (parseFloat(commissionGross)||0) - 50 - (!caseData.lawyer_name_other ? 200 : 0) - (parseFloat(commissionDiscount)||0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* ── LAWYER COMMISSION ── */}
                {!caseData.lawyer_name_other && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">Lawyer Commission</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Professional Fees (RM) <span className="text-gray-400 font-normal">— from lawyer quotation</span>
                      </label>
                      <input type="number" value={lawyerGross} onChange={e => setLawyerGross(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                        placeholder="e.g. 6250.00"
                      />
                    </div>
                    {parseFloat(lawyerGross) > 0 && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                        <div className="flex justify-between"><span>Professional Fee</span><span className="font-medium">RM {(parseFloat(lawyerGross)||0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-amber-700"><span>QAI share (70%)</span><span>RM {((parseFloat(lawyerGross)||0)*0.7).toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-500"><span>— Company override (10%)</span><span>– RM {((parseFloat(lawyerGross)||0)*0.7*0.10).toFixed(2)}</span></div>
                        <div className="flex justify-between font-semibold text-[#0A1628] border-t pt-1 mt-1">
                          <span>Net Distributable (Lawyer)</span>
                          <span>RM {Math.max(0, (parseFloat(lawyerGross)||0)*0.7*0.9).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {loadingCommPreview && <p className="text-xs text-gray-400 animate-pulse">Loading breakdown…</p>}
                {commissionPreview && (
                  <div className="rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-3 py-2 text-gray-500">Recipient</th>
                          <th className="text-right px-3 py-2 text-gray-500">%</th>
                          <th className="text-right px-3 py-2 text-gray-500">Bank RM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(commissionPreview).map(([uid, row]) => (
                          <tr key={uid} className="border-b border-gray-50 last:border-0">
                            <td className="px-3 py-2 font-medium text-[#0A1628]">{row.name}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{row.percentage.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700">RM {row.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes (visible to agent)</label>
                  <textarea rows={2} value={commissionNotes} onChange={e => setCommissionNotes(e.target.value)}
                    className="w-full text-xs p-2 rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none" />
                </div>
                <Button onClick={handleGenerateCommission} disabled={calculatingComms}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" size="sm">
                  {calculatingComms ? "Processing…" : "Finalize & Mark Paid"}
                </Button>
              </CardContent>
            </Card>
          )}


          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-[#C9A84C]" /> Case Thread
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseData.comments.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
                : (
                  <div className="space-y-3">
                    {caseData.comments.map((c) => (
                      <div key={c.id} className={`p-3 rounded-xl text-sm ${c.is_admin ? "bg-[#FFF9EC] border-l-2 border-[#C9A84C]" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-[#0A1628] text-xs">{c.author?.full_name || "Unknown"}</span>
                          {c.is_admin && <span className="text-[10px] text-[#C9A84C] font-semibold uppercase tracking-wide">Admin</span>}
                          <span className="text-xs text-gray-400 ml-auto">
                            {formatDateTime(c.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-700">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )
              }
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                  className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
                <Button onClick={handleSendComment} disabled={sendingComment || !comment.trim()} size="sm" className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              >
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <textarea
                placeholder="Notes (optional)..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C] resize-none"
              />
              <Button
                onClick={handleStatusUpdate}
                disabled={updatingStatus || newStatus === caseData.status}
                className="w-full bg-[#0A1628] text-white hover:bg-[#0d1f38]"
                size="sm"
              >
                {updatingStatus ? "Updating..." : "Update Status"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Admin Remarks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea
                placeholder="Internal notes..."
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C] resize-none"
              />
              <Button onClick={handleSaveRemarks} disabled={savingRemarks} variant="outline" size="sm" className="w-full">
                {savingRemarks ? "Saving..." : "Save Remarks"}
              </Button>
            </CardContent>
          </Card>

          {caseData.status === "accepted" && (
            <Card className="border-teal-200 bg-teal-50/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-teal-800">
                  <FileText className="h-4 w-4 text-teal-600" /> LA Preparation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {laPreparationSent ? (
                  <div className="flex items-start gap-2 text-xs text-teal-700">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Sent for LA prep on {new Date(laPreparationSent).toLocaleDateString("en-GB")}</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Send the document package to the lawyer to begin Loan Agreement preparation.
                  </p>
                )}
                <Button
                  onClick={handleSendToLawyer}
                  disabled={sendingToLawyer || !!laPreparationSent}
                  size="sm"
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white"
                >
                  {sendingToLawyer
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Sending…</>
                    : laPreparationSent
                      ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Already Sent</>
                      : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send for LA Preparation</>
                  }
                </Button>
              </CardContent>
            </Card>
          )}


          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[#C9A84C]" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {caseData.status_history.length === 0
                ? <p className="text-sm text-gray-400">No history yet</p>
                : (
                  <div className="space-y-3">
                    {[...caseData.status_history].reverse().map((h) => (
                      <div key={h.id} className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-[#0A1628]">
                            {CASE_STATUS_LABELS[h.to_status as CaseStatus] || h.to_status}
                          </p>
                          {h.notes && <p className="text-xs text-gray-500">{h.notes}</p>}
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {h.changed_by_profile?.full_name} · {formatDateTime(h.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

