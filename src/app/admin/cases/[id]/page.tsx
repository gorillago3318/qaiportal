"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, User, Building2, MapPin, Landmark, Clock, MessageSquare, CheckCircle2, Send,
  FileText, Loader2, Pencil,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatCurrency, formatDate, formatDateTime, monthsToYearsMonths } from "@/lib/utils"
import { CASE_STATUS_LABELS, LOAN_TYPE_LABELS, type CaseStatus } from "@/types/database"
import { createBrowserClient } from '@supabase/ssr'

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
  lawyer_professional_fee: number | null
  proposed_bank_id: string | null
  /** Top-level JSONB with every agent-entered form field */
  bank_form_data: Record<string, unknown> | null
  /** Joined from lawyers table via lawyer_id FK */
  lawyer: { id: string; name: string; firm: string; is_panel: boolean } | null
  proposed_bank: { name: string; commission_rate: number } | null
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
  const [calculatingComms, setCalculatingComms] = React.useState<'bank' | 'lawyer' | null>(null)
  const [commissionPreview, setCommissionPreview] = React.useState<Record<string,{name:string;role:string;percentage:number;amount:number}> | null>(null)
  const [loadingCommPreview, setLoadingCommPreview] = React.useState(false)
  /** Current status per commission type. */
  const [bankCommStatus, setBankCommStatus] = React.useState<string | null>(null)
  const [lawyerCommStatus, setLawyerCommStatus] = React.useState<string | null>(null)
  const [isPanelLawyer, setIsPanelLawyer] = React.useState(false)
  const [lawyerGross, setLawyerGross] = React.useState("0")
  
  const [valuationData, setValuationData] = React.useState({
    valuer_1_firm: "", valuer_1_name: "", valuer_1_date: "", valuer_1_amount: "" as string | number,
    valuer_2_firm: "", valuer_2_name: "", valuer_2_date: "", valuer_2_amount: "" as string | number,
  })
  const [savingValuation, setSavingValuation] = React.useState(false)
  const [savingFee, setSavingFee] = React.useState(false)
  const [sendingToLawyer, setSendingToLawyer] = React.useState(false)
  const [editingCase, setEditingCase] = React.useState(false)
  const [caseEditForm, setCaseEditForm] = React.useState({
    client_name: '', client_ic: '', client_phone: '', client_email: '',
    coborrower_name: '', coborrower_ic: '', coborrower_phone: '',
    proposed_bank_id: '',
    home_loan_amount: '', home_loan_tenure: '',
    finance_legal_cost: false, legal_cost_amount: '',
    finance_valuation_cost: false, valuation_cost_amount: '',
    cashout_amount: '',
    selected_lawyer_type: '' as 'panel' | 'others' | '',
    lawyer_id: '', lawyer_name_other: '', lawyer_firm_other: '',
    lawyer_professional_fee: '', special_arrangement_discount: '',
  })
  const [savingCase, setSavingCase] = React.useState(false)
  const [availableLawyers, setAvailableLawyers] = React.useState<{ id: string; name: string; firm: string }[]>([])
  const [availableBanks, setAvailableBanks] = React.useState<{ id: string; name: string; commission_rate: number }[]>([])
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
      // Pre-fill professional fee — top-level column is authoritative, bfd is fallback
      const fee = json.data.lawyer_professional_fee ?? bfd?.lawyer_professional_fee
      if (fee) setLawyerGross(String(fee))

      // Panel detection — use joined lawyer object (both old and new cases after GET fallback)
      // Secondary fallback: bank_form_data.selected_lawyer_type for cases where lawyer fetch fails
      const isPanel =
        json.data.lawyer?.is_panel === true ||
        (bfd?.selected_lawyer_type === 'panel' && !!bfd?.lawyer_id)
      setIsPanelLawyer(isPanel)

      // Auto-preview commission if case is accepted or beyond
      const commissionStatuses: CaseStatus[] = ['accepted', 'pending_execution', 'executed', 'payment_pending', 'paid']
      if (commissionStatuses.includes(json.data.status)) {
        // Sync bank gross display from auto-calc
        const loan = parseFloat(String(json.data.proposed_loan_amount || 0)) || 0
        const rate = json.data.proposed_bank?.commission_rate ?? 0
        setCommissionGross((loan * rate).toFixed(2))
        // Fetch existing commission rows (status + tier breakdown)
        setLoadingCommPreview(true)
        try {
          const [prevRes, commRes] = await Promise.all([
            fetch(`/api/cases/${id}/commission/preview`),
            fetch(`/api/commissions?case_id=${id}`),
          ])
          if (prevRes.ok) {
            const prevJson = await prevRes.json()
            if (prevJson.bank) {
              setCommissionGross(prevJson.bank.gross?.toFixed(2) ?? "0")
              if (prevJson.bank.rows) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const map: Record<string, {name:string;role:string;percentage:number;amount:number}> = {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                prevJson.bank.rows.forEach((row: any) => { map[row.id] = row })
                setCommissionPreview(map)
              }
            }
          }
          if (commRes.ok) {
            const commJson = await commRes.json()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows: any[] = commJson.data || []
            const bankRow = rows.find((r) => r.type === 'bank')
            const lawyerRow = rows.find((r) => r.type === 'lawyer')
            setBankCommStatus(bankRow?.status ?? null)
            setLawyerCommStatus(lawyerRow?.status ?? null)
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

  // Fetch dropdown data for the edit form
  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.from('lawyers').select('id, name, firm').eq('is_panel', true).order('name')
      .then(({ data }) => { if (data) setAvailableLawyers(data) })
    supabase.from('banks').select('id, name, commission_rate').order('name')
      .then(({ data }) => { if (data) setAvailableBanks(data) })
  }, [])

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

  const handleSaveFee = async () => {
    if (!caseData) return
    setSavingFee(true)
    const fee = parseFloat(lawyerGross) || 0
    const acceptedStatuses: CaseStatus[] = ['accepted', 'pending_execution', 'executed', 'payment_pending', 'paid']
    const shouldRecalc = acceptedStatuses.includes(caseData.status)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      // Update JSONB field (for legacy reads) AND top-level column (for joins/commission calc)
      bank_form_data: { ...(caseData.bank_form_data || {}), lawyer_professional_fee: fee },
      lawyer_professional_fee: fee,
    }
    if (shouldRecalc) body.recalculate_commission = true

    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) toast.success(shouldRecalc ? "Fee saved — commission recalculated" : "Professional fee saved")
    else { const j = await res.json(); toast.error(j.error || "Failed to save") }
    setSavingFee(false)
    fetchCase()
  }

  const openEdit = () => {
    if (!caseData) return
    const bfd = caseData.bank_form_data || {}
    const lawyerType = (bfd.selected_lawyer_type as string) ||
      (caseData.lawyer ? 'panel' : caseData.lawyer_name_other ? 'others' : '')
    setCaseEditForm({
      client_name: String(bfd.client_name ?? ''),
      client_ic: String(bfd.client_ic ?? ''),
      client_phone: String(bfd.client_phone ?? ''),
      client_email: String(bfd.client_email ?? ''),
      coborrower_name: String(bfd.coborrower_name ?? ''),
      coborrower_ic: String(bfd.coborrower_ic ?? ''),
      coborrower_phone: String(bfd.coborrower_phone ?? ''),
      proposed_bank_id: String(caseData.proposed_bank_id ?? bfd.proposed_bank_id ?? ''),
      home_loan_amount: String(bfd.home_loan_amount ?? ''),
      home_loan_tenure: String(bfd.home_loan_tenure ?? ''),
      finance_legal_cost: Boolean(bfd.finance_legal_cost),
      legal_cost_amount: String(bfd.legal_cost_amount ?? ''),
      finance_valuation_cost: Boolean(bfd.finance_valuation_cost),
      valuation_cost_amount: String(bfd.valuation_cost_amount ?? ''),
      cashout_amount: String(bfd.cashout_amount ?? ''),
      selected_lawyer_type: lawyerType as 'panel' | 'others' | '',
      lawyer_id: String(caseData.lawyer?.id ?? bfd.lawyer_id ?? ''),
      lawyer_name_other: String(caseData.lawyer_name_other ?? bfd.lawyer_name_other ?? ''),
      lawyer_firm_other: String(caseData.lawyer_firm_other ?? bfd.lawyer_firm_other ?? ''),
      lawyer_professional_fee: String(caseData.lawyer_professional_fee ?? bfd.lawyer_professional_fee ?? ''),
      special_arrangement_discount: String(bfd.special_arrangement_discount ?? ''),
    })
    setEditingCase(true)
  }

  const handleSaveCase = async () => {
    if (!caseData) return
    setSavingCase(true)
    const acceptedStatuses: CaseStatus[] = ['accepted', 'pending_execution', 'executed', 'payment_pending', 'paid']
    const shouldRecalc = acceptedStatuses.includes(caseData.status)

    const base = parseFloat(caseEditForm.home_loan_amount) || 0
    const legal = caseEditForm.finance_legal_cost ? (parseFloat(caseEditForm.legal_cost_amount) || 0) : 0
    const valuation = caseEditForm.finance_valuation_cost ? (parseFloat(caseEditForm.valuation_cost_amount) || 0) : 0
    const cashout = parseFloat(caseEditForm.cashout_amount) || 0
    const proposedLoanAmount = Math.round((base + legal + valuation + cashout) * 100) / 100

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      proposed_bank_id: caseEditForm.proposed_bank_id || null,
      proposed_loan_amount: proposedLoanAmount || null,
      lawyer_id: caseEditForm.selected_lawyer_type === 'panel' ? (caseEditForm.lawyer_id || null) : null,
      lawyer_name_other: caseEditForm.selected_lawyer_type === 'others' ? (caseEditForm.lawyer_name_other || null) : null,
      lawyer_firm_other: caseEditForm.selected_lawyer_type === 'others' ? (caseEditForm.lawyer_firm_other || null) : null,
      lawyer_professional_fee: caseEditForm.lawyer_professional_fee ? parseFloat(caseEditForm.lawyer_professional_fee) : null,
      bank_form_data: {
        ...(caseData.bank_form_data || {}),
        client_name: caseEditForm.client_name,
        client_ic: caseEditForm.client_ic,
        client_phone: caseEditForm.client_phone,
        client_email: caseEditForm.client_email,
        coborrower_name: caseEditForm.coborrower_name || null,
        coborrower_ic: caseEditForm.coborrower_ic || null,
        coborrower_phone: caseEditForm.coborrower_phone || null,
        proposed_bank_id: caseEditForm.proposed_bank_id || null,
        home_loan_amount: caseEditForm.home_loan_amount,
        home_loan_tenure: caseEditForm.home_loan_tenure,
        finance_legal_cost: caseEditForm.finance_legal_cost,
        legal_cost_amount: caseEditForm.legal_cost_amount,
        finance_valuation_cost: caseEditForm.finance_valuation_cost,
        valuation_cost_amount: caseEditForm.valuation_cost_amount,
        cashout_amount: caseEditForm.cashout_amount,
        selected_lawyer_type: caseEditForm.selected_lawyer_type,
        lawyer_id: caseEditForm.selected_lawyer_type === 'panel' ? (caseEditForm.lawyer_id || null) : null,
        lawyer_name_other: caseEditForm.selected_lawyer_type === 'others' ? (caseEditForm.lawyer_name_other || null) : null,
        lawyer_firm_other: caseEditForm.selected_lawyer_type === 'others' ? (caseEditForm.lawyer_firm_other || null) : null,
        lawyer_professional_fee: caseEditForm.lawyer_professional_fee ? parseFloat(caseEditForm.lawyer_professional_fee) : null,
        special_arrangement_discount: caseEditForm.special_arrangement_discount ? parseFloat(caseEditForm.special_arrangement_discount) : null,
      },
    }
    if (shouldRecalc) body.recalculate_commission = true

    const res = await fetch(`/api/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(shouldRecalc ? 'Case updated — commission recalculated' : 'Case details saved')
      setEditingCase(false)
      fetchCase()
    } else {
      const j = await res.json()
      toast.error(j.error || 'Failed to save')
    }
    setSavingCase(false)
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

  const handleAdvanceCommission = async (type: 'bank' | 'lawyer') => {
    setCalculatingComms(type)
    try {
      const res = await fetch(`/api/cases/${id}/commission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, notes: commissionNotes }),
      })
      const j = await res.json()
      if (res.ok) {
        const label = type === 'bank' ? 'Bank' : 'Lawyer'
        toast.success(`${label} commission → ${j.advanced_to?.replace(/_/g, ' ')}`)
        fetchCase()
      } else {
        toast.error(j.error || "Failed to advance commission")
      }
    } catch {
      toast.error("An error occurred")
    }
    setCalculatingComms(null)
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

          {/* ── Application Details (editable by admin) ── */}
          {(() => {
            const bfd = caseData.bank_form_data || {}
            // bv: safely coerce any bfd field to string (bfd values are `unknown`)
            const bv = (k: string): string => String(bfd[k] ?? '')
            // bb: safely coerce bfd field to boolean
            const bb = (k: string): boolean => Boolean(bfd[k])
            const inp = (label: string, field: keyof typeof caseEditForm, type = 'text') => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <input
                  type={type}
                  value={String(caseEditForm[field])}
                  onChange={e => setCaseEditForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                />
              </div>
            )
            return (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Application Details</CardTitle>
                    {!editingCase ? (
                      <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingCase(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveCase} disabled={savingCase} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                          {savingCase ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* ── BORROWER ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Main Borrower</p>
                    {editingCase ? (
                      <div className="grid grid-cols-2 gap-3">
                        {inp('Full Name', 'client_name')}
                        {inp('IC / Passport No.', 'client_ic')}
                        {inp('Phone', 'client_phone')}
                        {inp('Email', 'client_email')}
                      </div>
                    ) : (
                      <div>
                        {bv('client_name') && <InfoRow label="Full Name" value={bv('client_name')} />}
                        {bv('client_ic') && <InfoRow label="IC / Passport" value={bv('client_ic')} />}
                        {bv('client_phone') && <InfoRow label="Phone" value={bv('client_phone')} />}
                        {bv('client_email') && <InfoRow label="Email" value={bv('client_email')} />}
                      </div>
                    )}
                  </div>

                  {/* ── CO-BORROWER ── */}
                  {(bv('coborrower_name') || editingCase) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Co-Borrower</p>
                      {editingCase ? (
                        <div className="grid grid-cols-2 gap-3">
                          {inp('Full Name', 'coborrower_name')}
                          {inp('IC / Passport No.', 'coborrower_ic')}
                          {inp('Phone', 'coborrower_phone')}
                        </div>
                      ) : (
                        <div>
                          {bv('coborrower_name') && <InfoRow label="Full Name" value={bv('coborrower_name')} />}
                          {bv('coborrower_ic') && <InfoRow label="IC / Passport" value={bv('coborrower_ic')} />}
                          {bv('coborrower_phone') && <InfoRow label="Phone" value={bv('coborrower_phone')} />}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NEW LOAN ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">New Loan</p>
                    {editingCase ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Proposed Bank</label>
                          <select
                            value={caseEditForm.proposed_bank_id}
                            onChange={e => setCaseEditForm(f => ({ ...f, proposed_bank_id: e.target.value }))}
                            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                          >
                            <option value="">— Select bank —</option>
                            {availableBanks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {inp('Loan Amount (RM)', 'home_loan_amount', 'number')}
                          {inp('Tenure (years)', 'home_loan_tenure', 'number')}
                          {inp('Cash Out (RM)', 'cashout_amount', 'number')}
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={caseEditForm.finance_legal_cost}
                              onChange={e => setCaseEditForm(f => ({ ...f, finance_legal_cost: e.target.checked }))}
                              className="rounded" />
                            Finance Legal Fees
                          </label>
                          {caseEditForm.finance_legal_cost && inp('Legal Cost (RM)', 'legal_cost_amount', 'number')}
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={caseEditForm.finance_valuation_cost}
                              onChange={e => setCaseEditForm(f => ({ ...f, finance_valuation_cost: e.target.checked }))}
                              className="rounded" />
                            Finance Valuation Fees
                          </label>
                          {caseEditForm.finance_valuation_cost && inp('Valuation Cost (RM)', 'valuation_cost_amount', 'number')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <InfoRow label="Bank" value={caseData.proposed_bank?.name || (availableBanks.find(b => b.id === bv('proposed_bank_id'))?.name) || null} />
                        {bv('home_loan_amount') && <InfoRow label="Loan Amount" value={formatCurrency(parseFloat(bv('home_loan_amount')))} />}
                        {bv('home_loan_tenure') && <InfoRow label="Tenure" value={`${bv('home_loan_tenure')} years`} />}
                        {bv('cashout_amount') && parseFloat(bv('cashout_amount')) > 0 && (
                          <InfoRow label="Cash Out" value={formatCurrency(parseFloat(bv('cashout_amount')))} />
                        )}
                        {bb('finance_legal_cost') && (
                          <InfoRow label="Finance Legal Fees" value={`Yes${bv('legal_cost_amount') ? ` — ${formatCurrency(parseFloat(bv('legal_cost_amount')))}` : ''}`} />
                        )}
                        {bb('finance_valuation_cost') && (
                          <InfoRow label="Finance Valuation Fees" value={`Yes${bv('valuation_cost_amount') ? ` — ${formatCurrency(parseFloat(bv('valuation_cost_amount')))}` : ''}`} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── LAWYER ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lawyer</p>
                    {editingCase ? (
                      <div className="space-y-3">
                        <div className="flex gap-4">
                          {(['panel', 'others'] as const).map(t => (
                            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="radio" name="lawyer_type" value={t}
                                checked={caseEditForm.selected_lawyer_type === t}
                                onChange={() => setCaseEditForm(f => ({ ...f, selected_lawyer_type: t }))}
                              />
                              {t === 'panel' ? 'Panel Lawyer' : 'External / Others'}
                            </label>
                          ))}
                        </div>
                        {caseEditForm.selected_lawyer_type === 'panel' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Select Panel Lawyer</label>
                            <select
                              value={caseEditForm.lawyer_id}
                              onChange={e => setCaseEditForm(f => ({ ...f, lawyer_id: e.target.value }))}
                              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                            >
                              <option value="">— Select lawyer —</option>
                              {availableLawyers.map(l => (
                                <option key={l.id} value={l.id}>{l.name} — {l.firm}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {caseEditForm.selected_lawyer_type === 'others' && (
                          <div className="grid grid-cols-2 gap-3">
                            {inp('Lawyer Name', 'lawyer_name_other')}
                            {inp('Firm / Company', 'lawyer_firm_other')}
                          </div>
                        )}
                        {caseEditForm.selected_lawyer_type && (
                          <div className="grid grid-cols-2 gap-3">
                            {inp('Professional Fee (RM)', 'lawyer_professional_fee', 'number')}
                            {inp('Special Discount (RM)', 'special_arrangement_discount', 'number')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {caseData.lawyer ? (
                          <>
                            <InfoRow label="Type" value={<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">Panel</span>} />
                            <InfoRow label="Name" value={caseData.lawyer.name} />
                            <InfoRow label="Firm" value={caseData.lawyer.firm} />
                          </>
                        ) : caseData.lawyer_name_other ? (
                          <>
                            <InfoRow label="Type" value={<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">External</span>} />
                            <InfoRow label="Name" value={caseData.lawyer_name_other} />
                            {caseData.lawyer_firm_other && <InfoRow label="Firm" value={caseData.lawyer_firm_other} />}
                          </>
                        ) : bfd.selected_lawyer_type ? (
                          <p className="text-sm text-gray-400">Lawyer info incomplete — click Edit to update</p>
                        ) : (
                          <p className="text-sm text-gray-400">No lawyer selected</p>
                        )}
                        {(caseData.lawyer_professional_fee || bfd.lawyer_professional_fee) ? (
                          <InfoRow label="Professional Fee" value={formatCurrency(Number(caseData.lawyer_professional_fee ?? bfd.lawyer_professional_fee))} />
                        ) : null}
                        {bfd.special_arrangement_discount && Number(bfd.special_arrangement_discount) > 0 ? (
                          <InfoRow label="Agent Discount" value={<span className="text-amber-600">– {formatCurrency(Number(bfd.special_arrangement_discount))}</span>} />
                        ) : null}
                      </div>
                    )}
                  </div>

                </CardContent>
              </Card>
            )
          })()}

          {/* ── Loan Breakdown ── */}
          {caseData.bank_form_data && (() => {
            const bfd = caseData.bank_form_data
            const base    = parseFloat(String(bfd.home_loan_amount || 0)) || 0
            const legal   = bfd.finance_legal_cost   ? parseFloat(String(bfd.legal_cost_amount || 0))    || 0 : 0
            const valuer  = bfd.finance_valuation_cost? parseFloat(String(bfd.valuation_cost_amount || 0)) || 0 : 0
            const cashout = parseFloat(String(bfd.cashout_amount || 0)) || 0
            const total   = parseFloat(String(caseData.proposed_loan_amount || base + legal + valuer + cashout)) || 0
            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-[#C9A84C]" /> Loan Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow label="Base Loan" value={formatCurrency(base)} />
                  {legal > 0 && <InfoRow label="Legal Fees (financed)" value={formatCurrency(legal)} />}
                  {valuer > 0 && <InfoRow label="Valuation Fees (financed)" value={formatCurrency(valuer)} />}
                  {cashout > 0 && <InfoRow label="Cash Out" value={formatCurrency(cashout)} />}
                  <div className="flex items-start justify-between py-2.5 border-t border-gray-200 mt-1">
                    <span className="text-sm font-semibold text-[#0A1628] min-w-[140px]">Total Financing</span>
                    <span className="text-sm font-bold text-[#0A1628]">{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* ── Lawyer & Fees ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-[#C9A84C]" /> Lawyer &amp; Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              {caseData.lawyer ? (
                <>
                  <InfoRow label="Lawyer" value={caseData.lawyer.name} />
                  <InfoRow label="Firm" value={caseData.lawyer.firm} />
                  <InfoRow label="Type" value={<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">Panel</span>} />
                </>
              ) : caseData.lawyer_name_other ? (
                <>
                  <InfoRow label="Lawyer" value={caseData.lawyer_name_other} />
                  <InfoRow label="Firm" value={caseData.lawyer_firm_other} />
                  <InfoRow label="Type" value={<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">External</span>} />
                </>
              ) : (
                <p className="text-sm text-gray-400">No lawyer selected</p>
              )}
              {(caseData.lawyer_professional_fee ?? (caseData.bank_form_data?.lawyer_professional_fee as number | undefined)) ? (
                <InfoRow
                  label="Professional Fee"
                  value={formatCurrency(caseData.lawyer_professional_fee ?? (caseData.bank_form_data?.lawyer_professional_fee as number))}
                />
              ) : null}
              {caseData.bank_form_data?.special_arrangement_discount ? (
                <InfoRow
                  label="Agent Discount"
                  value={<span className="text-amber-600">– {formatCurrency(caseData.bank_form_data.special_arrangement_discount as number)}</span>}
                />
              ) : null}
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

          {(['submitted','approved','accepted','pending_execution','executed','payment_pending'] as CaseStatus[]).includes(caseData.status) && (
            <Card className="border-[#C9A84C]/40 bg-gradient-to-br from-amber-50/50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#0A1628] flex items-center gap-2">
                  💰 Commission Payout
                </CardTitle>
                <div className="space-y-0.5 mt-1">
                  {caseData.has_lawyer_discount && (
                    <p className="text-xs text-amber-600">⚠ Lawyer discount: RM {caseData.lawyer_discount_amount?.toFixed(2)}</p>
                  )}
                  {isPanelLawyer ? (
                    <p className="text-xs text-emerald-600">✓ Panel Lawyer ({caseData.lawyer?.name || '—'}) — Bank &amp; Lawyer commissions apply</p>
                  ) : caseData.lawyer_name_other ? (
                    <p className="text-xs text-gray-500">External Lawyer: {caseData.lawyer_name_other} — no lawyer commission</p>
                  ) : (
                    <p className="text-xs text-gray-400">No lawyer selected</p>
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
                      {/* Auto-calculated — read-only. Loan amount × bank commission rate. */}
                      <div className="w-full h-9 px-3 rounded-md border border-gray-100 bg-gray-50 text-sm flex items-center font-mono text-[#0A1628]">
                        {(() => {
                          const loan = parseFloat(String(caseData.proposed_loan_amount || 0)) || 0
                          const rate = caseData.proposed_bank?.commission_rate ?? 0
                          return (loan * rate).toFixed(2)
                        })()}
                      </div>
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
                    <div className="flex justify-between text-red-500"><span>— RM50 admin fee</span><span>– RM 50.00</span></div>
                    {parseFloat(commissionDiscount) > 0 && (
                      <div className="flex justify-between text-red-500"><span>— Admin adjustment</span><span>– RM {(parseFloat(commissionDiscount)||0).toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold text-[#0A1628] border-t pt-1 mt-1">
                      <span>Agent receives (100%)</span>
                      <span>RM {Math.max(0, (parseFloat(commissionGross)||0) - 50 - (parseFloat(commissionDiscount)||0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* ── LAWYER COMMISSION ── */}
                {isPanelLawyer && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">Lawyer Commission</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Professional Fees (RM) <span className="text-gray-400 font-normal">— from lawyer quotation</span>
                      </label>
                      <div className="flex gap-2">
                        <input type="number" value={lawyerGross} onChange={e => setLawyerGross(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
                          placeholder="e.g. 6250.00"
                        />
                        <Button onClick={handleSaveFee} disabled={savingFee} variant="outline" size="sm" className="whitespace-nowrap">
                          {savingFee ? "Saving…" : "Save Fee"}
                        </Button>
                      </div>
                    </div>
                    {parseFloat(lawyerGross) > 0 && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-0.5">
                        <div className="flex justify-between"><span>Professional Fee</span><span className="font-medium">RM {(parseFloat(lawyerGross)||0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-amber-700"><span>QAI share (70%)</span><span>RM {((parseFloat(lawyerGross)||0)*0.7).toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-500"><span>— Company cut (10%)</span><span>– RM {((parseFloat(lawyerGross)||0)*0.7*0.10).toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-500"><span>— Panel admin fee</span><span>– RM 200.00</span></div>
                        <div className="flex justify-between font-semibold text-[#0A1628] border-t pt-1 mt-1">
                          <span>Net Distributable (Lawyer)</span>
                          <span>RM {Math.max(0, (parseFloat(lawyerGross)||0)*0.7*0.9 - 200).toFixed(2)}</span>
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

                {/* ── Per-type advance buttons ── */}
                {(() => {
                  const btnLabel = (status: string | null) =>
                    status === 'calculated' ? 'Mark Payment Pending'
                    : status === 'payment_pending' ? 'Mark as Paid'
                    : status === 'paid' ? '✓ Paid'
                    : 'Not Calculated'
                  const btnClass = (status: string | null) =>
                    status === 'paid'
                      ? 'flex-1 py-2 text-center text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200'
                      : status === 'payment_pending'
                        ? 'flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold'
                        : status === 'calculated'
                          ? 'flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                          : 'flex-1 opacity-50 cursor-not-allowed'
                  return (
                    <div className="space-y-2">
                      {/* Bank commission row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 w-12 shrink-0">Bank</span>
                        {bankCommStatus === 'paid' ? (
                          <div className={btnClass('paid')}>✓ Bank Commission Paid</div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAdvanceCommission('bank')}
                            disabled={calculatingComms !== null || !bankCommStatus || bankCommStatus === 'pending'}
                            className={btnClass(bankCommStatus)}
                          >
                            {calculatingComms === 'bank' ? 'Processing…' : btnLabel(bankCommStatus)}
                          </Button>
                        )}
                      </div>
                      {/* Lawyer commission row (only if panel) */}
                      {isPanelLawyer && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 w-12 shrink-0">Lawyer</span>
                          {lawyerCommStatus === 'paid' ? (
                            <div className={btnClass('paid')}>✓ Lawyer Commission Paid</div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAdvanceCommission('lawyer')}
                              disabled={calculatingComms !== null || !lawyerCommStatus || lawyerCommStatus === 'pending'}
                              className={btnClass(lawyerCommStatus)}
                            >
                              {calculatingComms === 'lawyer' ? 'Processing…' : btnLabel(lawyerCommStatus)}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
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

