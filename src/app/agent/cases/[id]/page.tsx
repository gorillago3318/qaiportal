'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Clock,
  User,
  Building,
  Home,
  DollarSign,
  Loader2,
  Edit,
  ClipboardList,
  Mail,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatDateTime, monthsToYearsMonths } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CASE_STATUS_LABELS,
  LOAN_TYPE_LABELS,
  USER_ROLE_LABELS,
} from '@/types/database'
import type { CaseStatus, LoanType, UserRole } from '@/types/database'

const statusColors: Record<CaseStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  bank_processing: 'bg-amber-100 text-amber-700',
  kiv: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  pending_execution: 'bg-indigo-100 text-indigo-700',
  executed: 'bg-cyan-100 text-cyan-700',
  payment_pending: 'bg-purple-100 text-purple-700',
  paid: 'bg-teal-100 text-teal-700',
}

type QuotationType = 'LA' | 'SPA' | 'MOT'

interface LawyerRow {
  id: string
  name: string
  firm: string
  contact_email: string | null
  panel_banks: string[]
}

interface ValuerEntry {
  firm: string
  name: string
  indicative_value: string
  date: string
}

interface QuotationRecord {
  id: string
  lawyer_id: string
  lawyer_name: string
  lawyer_firm: string
  contact_email: string
  template_types: QuotationType[]
  sent_at: string
  email_sent: boolean
  email_error: string | null
}

// ── Email template builder ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEmailBody(types: QuotationType[], caseData: any): { subject: string; body: string } {
  const bfd = (caseData.bank_form_data || {}) as Record<string, unknown>
  const clientName = (caseData.client?.full_name || bfd.client_name || '') as string
  const rawCount = bfd.borrower_count as number | undefined
  const borrowerCount = rawCount ?? 1
  const bankName = (caseData.proposed_bank?.name || bfd.bank_name || '') as string
  const loanAmt = caseData.proposed_loan_amount
  const loanAmount = loanAmt ? `RM${Number(loanAmt).toLocaleString()}` : ''
  const propertyType = (bfd.property_type || caseData.property_type || '') as string
  const landTenure = (bfd.land_tenure || caseData.property_tenure || '') as string
  const titleType = (bfd.title_type || caseData.property_title || '') as string
  const state = (bfd.state || '') as string
  const financingType = (bfd.financing_type || '') as string
  const partyType = (bfd.party_type || '') as string
  const specialRemark = (bfd.special_remark || bfd.special_remarks || '') as string

  const sections: string[] = []
  const subjects: string[] = []

  if (types.includes('LA')) {
    subjects.push('LA')
    sections.push(`Request for Quotation LA

Client Name: ${clientName}
No. of Borrower: ${borrowerCount} borrower
1st/3rd Party: ${partyType}

Financing Type: ${financingType}
Property details (Type): ${propertyType}
Land Tenure: ${landTenure}
Title Type: ${titleType}
State: ${state}

Bank: ${bankName}
Loan Amount: ${loanAmount}

Special remark: ${specialRemark}`)
  }

  if (types.includes('SPA')) {
    subjects.push('SPA')
    const purchasePrice = bfd.purchase_price ? `RM${Number(bfd.purchase_price).toLocaleString()}` : ''
    const markUp = (bfd.mark_up || bfd.markup || 'No') as string
    sections.push(`Request for Quotation SPA - Purchaser

Client Name: ${clientName}
No. of Purchaser: ${borrowerCount}

Financing Type: ${financingType}
Property details (Type): ${propertyType}
Land Tenure: ${landTenure}
Title Type: ${titleType}
State: ${state}

Purchase Price: ${purchasePrice}

Special remark: ${specialRemark}
Involve mark up? ${markUp}
Please confirm if vendor bill is -`)
  }

  if (types.includes('MOT')) {
    subjects.push('MOT')
    const propertyAddress = (caseData.property_address || bfd.property_address || '') as string
    const builtUp = (bfd.buildup_size_sqft || bfd.built_up || '') as string
    const propertyValue = caseData.property_value ? `RM${Number(caseData.property_value).toLocaleString()}` : ''
    const existingRaw = (bfd.existing_loan_outstanding || caseData.current_loan_amount) as number | undefined
    const existingLoan = existingRaw ? `RM${Number(existingRaw).toLocaleString()}` : ''
    const currentBank = (caseData.current_bank || bfd.current_bank_name || '') as string
    const transferReason = (bfd.transfer_reason || '') as string
    const markUp = (bfd.mark_up || bfd.markup || 'No') as string
    const hasFinancing = caseData.proposed_loan_amount ? 'Yes' : 'No'
    sections.push(`Request for Quotation MOT & Refinance – ${transferReason}

Client Name: ${clientName}
No. of Purchaser: ${borrowerCount} (registered owner after transfer)

Financing Type: ${hasFinancing} (${financingType})
Property Details (Type): ${propertyType}
Full Address: ${propertyAddress}
Built Up: ${builtUp} sqf
Land Tenure: ${landTenure}
Title Type: ${titleType}
State: ${state}

Market Value: ${propertyValue}

Special Remark: ${specialRemark}
Existing loan (current outstanding): ${existingLoan}
Existing bank: ${currentBank}
New/Refinance bank: ${bankName}

Involve mark up?: ${markUp}
Please confirm if vendor bill is: No`)
  }

  return {
    subject: `Request for Quotation ${subjects.join(' + ')} – ${clientName}`,
    body: sections.join('\n\n' + '─'.repeat(50) + '\n\n'),
  }
}

// ── Stage 2 Panel ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Stage2Panel({ caseId, caseData, onRefresh }: { caseId: string; caseData: any; onRefresh: () => void }) {
  const bfd = (caseData.bank_form_data || {}) as Record<string, unknown>

  // Valuers state
  const emptyValuer = (): ValuerEntry => ({ firm: '', name: '', indicative_value: '', date: '' })
  const initValuers = (): [ValuerEntry, ValuerEntry] => {
    const saved = (bfd.valuers as ValuerEntry[] | undefined) || []
    return [saved[0] || emptyValuer(), saved[1] || emptyValuer()]
  }
  const [valuers, setValuers] = useState<[ValuerEntry, ValuerEntry]>(initValuers)
  const [savingValuers, setSavingValuers] = useState(false)
  const [valuersSaved, setValuersSaved] = useState(false)

  // Lawyer quotation state
  const [panelLawyers, setPanelLawyers] = useState<LawyerRow[]>([])
  const [loadingLawyers, setLoadingLawyers] = useState(true)
  const [selectedLawyerId, setSelectedLawyerId] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<QuotationType[]>([])
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingQuotation, setSendingQuotation] = useState(false)
  const [quotationResult, setQuotationResult] = useState<{ sent: boolean; error: string | null } | null>(null)

  const existingRequests = ((bfd.lawyer_quotation_requests as QuotationRecord[]) || [])

  // Load panel lawyers for this bank
  useEffect(() => {
    const bankId = caseData.proposed_bank_id || caseData.proposed_bank?.id
    if (!bankId) { setLoadingLawyers(false); return }
    const supabase = createClient()
    Promise.all([
      supabase.from('lawyers').select('id, name, firm, contact_email').eq('is_active', true).eq('is_panel', true),
      supabase.from('lawyer_bank_associations').select('lawyer_id').eq('bank_id', bankId).eq('is_panel', true),
    ]).then(([{ data: lawyerData }, { data: assocData }]) => {
      const panelIds = new Set((assocData || []).map((a: { lawyer_id: string }) => a.lawyer_id))
      setPanelLawyers((lawyerData || []).filter((l: LawyerRow) => panelIds.has(l.id)))
      setLoadingLawyers(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData.proposed_bank_id, caseData.proposed_bank?.id])

  // Rebuild email preview when lawyer/types change
  useEffect(() => {
    if (!selectedLawyerId || selectedTypes.length === 0) {
      setEmailSubject('')
      setEmailBody('')
      return
    }
    const { subject, body } = buildEmailBody(selectedTypes, caseData)
    setEmailSubject(subject)
    setEmailBody(body)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLawyerId, selectedTypes])

  const patchValuer = (idx: 0 | 1, field: keyof ValuerEntry, val: string) => {
    setValuers((prev) => {
      const next: [ValuerEntry, ValuerEntry] = [{ ...prev[0] }, { ...prev[1] }]
      next[idx] = { ...next[idx], [field]: val }
      return next
    })
  }

  const handleSaveValuers = async () => {
    setSavingValuers(true)
    try {
      const mergedBfd = { ...bfd, valuers }
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_form_data: mergedBfd }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setValuersSaved(true)
      onRefresh()
    } catch {
      toast.error('Failed to save valuers')
    } finally {
      setSavingValuers(false)
    }
  }

  const toggleType = (t: QuotationType) =>
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])

  const handleSendQuotation = async () => {
    if (!selectedLawyerId || selectedTypes.length === 0 || !emailBody) return
    setSendingQuotation(true)
    setQuotationResult(null)
    try {
      const res = await fetch(`/api/cases/${caseId}/lawyer-quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawyer_id: selectedLawyerId, template_types: selectedTypes, email_subject: emailSubject, email_body: emailBody }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setQuotationResult({ sent: json.email_sent, error: json.email_error })
      onRefresh()
      if (json.email_sent) {
        setSelectedLawyerId('')
        setSelectedTypes([])
      }
    } catch (err) {
      setQuotationResult({ sent: false, error: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSendingQuotation(false)
    }
  }

  const cls = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-7 w-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <ClipboardList className="h-4 w-4 text-teal-600" />
          </div>
          Stage 2 — Supporting Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* 2A — Valuers */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#0A1628] flex items-center gap-2">
            2A — Verbal Valuations
            <span className="text-xs font-normal text-gray-400">(2 valuers recommended)</span>
          </h3>
          {([0, 1] as const).map((idx) => (
            <div key={idx} className="p-3 bg-gray-50 rounded-xl space-y-2">
              <p className="text-xs font-medium text-gray-500">Valuer {idx + 1}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Firm</label>
                  <input className={cls} placeholder="ABC Valuers Sdn Bhd" value={valuers[idx].firm} onChange={(e) => patchValuer(idx, 'firm', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Valuer Name</label>
                  <input className={cls} placeholder="Ahmad bin Ali" value={valuers[idx].name} onChange={(e) => patchValuer(idx, 'name', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Indicative Value (RM)</label>
                  <input className={cls} type="number" placeholder="500000" value={valuers[idx].indicative_value} onChange={(e) => patchValuer(idx, 'indicative_value', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date of Quote</label>
                  <input className={cls} type="date" value={valuers[idx].date} onChange={(e) => patchValuer(idx, 'date', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={savingValuers} onClick={handleSaveValuers} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
              {savingValuers ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Save Valuers
            </Button>
            {valuersSaved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* 2B — Lawyer Quotation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#0A1628] flex items-center gap-2">
            2B — Lawyer Quotation Request
          </h3>

          {/* Past requests */}
          {existingRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Sent requests</p>
              {existingRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 text-xs">
                  <div>
                    <span className="font-medium text-[#0A1628]">{r.lawyer_name}</span>
                    <span className="text-gray-400 ml-2">{r.template_types.join(' + ')}</span>
                    <span className="text-gray-400 ml-2">{formatDateTime(r.sent_at)}</span>
                  </div>
                  {r.email_sent
                    ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Sent</span>
                    : <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Not sent</span>}
                </div>
              ))}
            </div>
          )}

          {/* New request form */}
          {loadingLawyers ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : panelLawyers.length === 0 ? (
            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              No panel lawyers found for the selected bank. Add panel lawyers in Admin → Settings → Panel Lawyers.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Panel Lawyer</label>
                <select
                  value={selectedLawyerId}
                  onChange={(e) => setSelectedLawyerId(e.target.value)}
                  className={cls}
                >
                  <option value="">Select a lawyer...</option>
                  {panelLawyers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.firm}{l.contact_email ? '' : ' (no contact email)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Quotation Types</label>
                <div className="flex gap-3">
                  {(['LA', 'SPA', 'MOT'] as QuotationType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(t)}
                        onChange={() => toggleType(t)}
                        className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              {emailBody && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      className={cls}
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email Body <span className="font-normal text-gray-400">(editable)</span>
                    </label>
                    <textarea
                      rows={14}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A84C] resize-y"
                    />
                  </div>
                </div>
              )}

              {quotationResult && (
                <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${quotationResult.sent ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {quotationResult.sent
                    ? <><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Email sent to lawyer's contact address. Record saved.</>
                    : <><AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" /> Record saved but email not sent: {quotationResult.error}</>}
                </div>
              )}

              <Button
                size="sm"
                disabled={!selectedLawyerId || selectedTypes.length === 0 || !emailBody || sendingQuotation}
                onClick={handleSendQuotation}
                className="bg-[#0A1628] text-white hover:bg-[#0d1f38]"
              >
                {sendingQuotation ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
                Send Quotation Request
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface CaseDetail {
  id: string
  case_code: string
  loan_type: LoanType
  status: CaseStatus
  bank_form_data: Record<string, unknown> | null
  proposed_bank_id: string | null
  current_bank: string | null
  current_loan_amount: number | null
  current_interest_rate: number | null
  current_monthly_instalment: number | null
  current_tenure_months: number | null
  loan_type_detail: string | null
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
  admin_remarks: string | null
  created_at: string
  updated_at: string
  client: {
    full_name: string
    ic_number: string
    phone: string
    email: string | null
    date_of_birth: string | null
    monthly_income: number | null
    address: string | null
    employer: string | null
  } | null
  agent: {
    id: string
    full_name: string
    agent_code: string | null
    email: string
    phone: string | null
    role: UserRole
  } | null
  proposed_bank: { id: string; name: string } | null
  status_history: Array<{
    id: string
    from_status: CaseStatus | null
    to_status: CaseStatus
    notes: string | null
    created_at: string
    changed_by_profile: { full_name: string; role: UserRole } | null
  }>
  comments: Array<{
    id: string
    content: string
    is_admin: boolean
    created_at: string
    author: { id: string; full_name: string; role: UserRole } | null
  }>
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
      <span className="text-xs text-[#9CA3AF] w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-[#0A1628] font-medium">{value || '—'}</span>
    </div>
  )
}

export default function AgentCaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [lawyerQuotationUrl, setLawyerQuotationUrl] = useState('')
  const [submittingCase, setSubmittingCase] = useState(false)

  // Accept case (approved → accepted) with LO upload
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [loFile, setLoFile] = useState<File | null>(null)
  const [acceptingCase, setAcceptingCase] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Document states
  const [files, setFiles] = useState<{
    applicationForm?: File
    incomeDocument?: File
    propertyDocument?: File
    lawyerQuotation?: File
    otherFiles?: File
  }>({})
  
  // Lawyer selection state
  const [lawyerSelection, setLawyerSelection] = useState<'LWZ' | 'YG' | 'external' | ''>('')
  const [externalLawyerName, setExternalLawyerName] = useState('')
  const [hasLawyerDiscount, setHasLawyerDiscount] = useState(false)
  const [lawyerDiscountAmount, setLawyerDiscountAmount] = useState('')

  useEffect(() => {
    fetchCase()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchCase = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cases/${id}`)
      if (!res.ok) throw new Error('Case not found')
      const json = await res.json()
      setCaseData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case')
    } finally {
      setLoading(false)
    }
  }

  const handleSendComment = async () => {
    if (!comment.trim() || sendingComment) return
    setSendingComment(true)
    try {
      const res = await fetch(`/api/cases/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment.trim() }),
      })
      if (!res.ok) throw new Error('Failed to send comment')
      const json = await res.json()
      setCaseData((prev) =>
        prev ? { ...prev, comments: [...prev.comments, json.data] } : prev
      )
      setComment('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      console.error(err)
    } finally {
      setSendingComment(false)
    }
  }

  const handleSubmitCase = async () => {
    if (!files.applicationForm || !files.incomeDocument || !files.propertyDocument || submittingCase) {
      toast.error("Please provide at least the Application Form, Income Document, and Property Document")
      return
    }
    if (!lawyerSelection) {
      toast.error("Please select the handling lawyer")
      return
    }
    if (lawyerSelection === 'external' && !externalLawyerName.trim()) {
      toast.error("Please provide the external lawyer's name")
      return
    }
    setSubmittingCase(true)
    try {
      const supabaseClient = createClient()
      const uploadedDocs = []

      // Helper to upload
      const uploadFile = async (file: File | undefined, typeName: string) => {
        if (!file) return null
        const ext = file.name.split('.').pop()
        const fileName = `${id}/${typeName}_${Date.now()}.${ext}`
        const { data, error } = await supabaseClient.storage
          .from('case-documents')
          .upload(fileName, file)
        
        if (error) {
          console.error('Upload Error:', error)
          throw new Error(`Failed to upload ${typeName}`)
        }
        
        const { data: publicUrlData } = supabaseClient.storage
          .from('case-documents')
          .getPublicUrl(fileName)

        return {
          document_type: typeName,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
          file_size: file.size
        }
      }

      const docsToUpload = [
        { f: files.applicationForm, t: 'Application Form' },
        { f: files.incomeDocument, t: 'Income Document' },
        { f: files.propertyDocument, t: 'Property Document' },
        { f: files.lawyerQuotation, t: 'Lawyer Quotation' },
        { f: files.otherFiles, t: 'Other Files' }
      ]

      for (const doc of docsToUpload) {
        if (doc.f) {
          const res = await uploadFile(doc.f, doc.t)
          if (res) uploadedDocs.push(res)
        }
      }

      const isPanel = lawyerSelection === 'LWZ' || lawyerSelection === 'YG'
      const lawyerNameMap = { LWZ: 'LWZ & Associates', YG: 'Y&G Law', external: externalLawyerName }

      const res = await fetch(`/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'submitted',
          notes: 'Case submitted by agent with documents.',
          new_documents: uploadedDocs,
          has_lawyer_discount: hasLawyerDiscount,
          lawyer_discount_amount: lawyerDiscountAmount ? Number(lawyerDiscountAmount) : 0,
          lawyer_name_other: isPanel ? null : externalLawyerName,
          lawyer_firm_other: isPanel ? null : externalLawyerName,
          // Store lawyer selection in admin_remarks for now — panel flag
          is_panel_lawyer: isPanel,
          panel_lawyer_name: isPanel ? lawyerNameMap[lawyerSelection] : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit case')
      await fetchCase()
      setShowSubmitModal(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to submit case')
    } finally {
      setSubmittingCase(false)
    }
  }

  const handleAcceptCase = async () => {
    if (!loFile) {
      toast.error('Please upload the signed Letter of Offer first')
      return
    }
    setAcceptingCase(true)
    try {
      const supabaseClient = createClient()
      const ext = loFile.name.split('.').pop()
      const fileName = `${id}/signed_lo_${Date.now()}.${ext}`
      const { error: uploadError } = await supabaseClient.storage
        .from('case-documents')
        .upload(fileName, loFile)
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: publicUrlData } = supabaseClient.storage
        .from('case-documents')
        .getPublicUrl(fileName)

      const res = await fetch(`/api/cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'accepted',
          notes: 'Agent accepted case with signed Letter of Offer.',
          new_documents: [{
            document_type: 'Signed Letter of Offer',
            file_name: loFile.name,
            file_url: publicUrlData.publicUrl,
            file_size: loFile.size,
          }],
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Failed to accept case')
      }
      toast.success('Case accepted! Lawyer will be notified to begin LA preparation.')
      setShowAcceptModal(false)
      setLoFile(null)
      await fetchCase()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept case')
    } finally {
      setAcceptingCase(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Button variant="ghost" size="icon" onClick={() => router.push('/agent/cases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-red-500 text-sm mb-4">{error || 'Case not found'}</p>
            <Button variant="outline" onClick={fetchCase}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const c = caseData

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/agent/cases">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-[#0A1628] font-mono">
                {c.case_code}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  statusColors[c.status]
                }`}
              >
                {CASE_STATUS_LABELS[c.status]}
              </span>
            </div>
            <p className="text-[#6B7280] text-sm mt-1">
              {LOAN_TYPE_LABELS[c.loan_type]} • Created {formatDate(c.created_at)}
            </p>
          </div>
        </div>
        {c.status === 'draft' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push(`/agent/cases/new?id=${id}`)}>
              <Edit className="h-4 w-4" />
              Edit Case
            </Button>
            <Button variant="gold" size="sm" onClick={() => setShowSubmitModal(true)}>
              <Send className="h-4 w-4" />
              Submit Case
            </Button>
          </div>
        )}
        {c.status === 'approved' && (
          <Button variant="gold" size="sm" onClick={() => setShowAcceptModal(true)}>
            <CheckCircle2 className="h-4 w-4" />
            Accept Case
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Full Name" value={c.client?.full_name} />
              <InfoRow label="IC Number" value={c.client?.ic_number} />
              <InfoRow label="Phone" value={c.client?.phone} />
              <InfoRow label="Email" value={c.client?.email} />
              <InfoRow label="Date of Birth" value={c.client?.date_of_birth ? formatDate(c.client.date_of_birth) : null} />
              <InfoRow label="Monthly Income" value={c.client?.monthly_income ? formatCurrency(c.client.monthly_income) : null} />
              <InfoRow label="Employer" value={c.client?.employer} />
            </CardContent>
          </Card>

          {/* Loan Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                </div>
                Current Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Current Bank" value={c.current_bank} />
              <InfoRow label="Loan Amount" value={c.current_loan_amount ? formatCurrency(c.current_loan_amount) : null} />
              <InfoRow label="Interest Rate" value={c.current_interest_rate ? `${c.current_interest_rate}% p.a.` : null} />
              <InfoRow label="Monthly Instalment" value={c.current_monthly_instalment ? formatCurrency(c.current_monthly_instalment) : null} />
              <InfoRow label="Remaining Tenure" value={c.current_tenure_months ? monthsToYearsMonths(c.current_tenure_months) : null} />
              <InfoRow label="Loan Package" value={c.loan_type_detail} />
              <InfoRow label="Islamic" value={c.is_islamic ? 'Yes' : 'No'} />
              <InfoRow label="Lock-In Period" value={c.has_lock_in ? 'Yes' : 'No'} />
            </CardContent>
          </Card>

          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <Home className="h-4 w-4 text-green-600" />
                </div>
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Address" value={c.property_address} />
              <InfoRow label="Property Type" value={c.property_type} />
              <InfoRow label="Title Type" value={c.property_title} />
              <InfoRow label="Tenure" value={c.property_tenure} />
              <InfoRow label="Market Value" value={c.property_value ? formatCurrency(c.property_value) : null} />
            </CardContent>
          </Card>

          {/* Proposed Loan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
                Proposed Loan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Bank" value={c.proposed_bank?.name} />
              <InfoRow label="Loan Amount" value={c.proposed_loan_amount ? formatCurrency(c.proposed_loan_amount) : null} />
              <InfoRow label="Interest Rate" value={c.proposed_interest_rate ? `${c.proposed_interest_rate}% p.a.` : null} />
              <InfoRow label="Tenure" value={c.proposed_tenure_months ? monthsToYearsMonths(c.proposed_tenure_months) : null} />
              <InfoRow label="Cash Out" value={c.has_cash_out ? (c.cash_out_amount ? formatCurrency(c.cash_out_amount) : 'Yes') : 'No'} />
              <InfoRow label="Finance Legal Fees" value={c.finance_legal_fees ? 'Yes' : 'No'} />
            </CardContent>
          </Card>

          {/* Stage 2 — shown when case is draft */}
          {c.status === 'draft' && (
            <Stage2Panel caseId={id} caseData={c} onRefresh={fetchCase} />
          )}

          {/* Admin Remarks */}
          {c.admin_remarks && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Admin Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#374151] bg-[#FFF9EC] border border-[#C9A84C]/20 rounded-lg p-3">
                  {c.admin_remarks}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[#C9A84C]" />
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {c.status_history.length === 0 ? (
                <p className="text-xs text-[#9CA3AF] text-center py-4">No history yet</p>
              ) : (
                <div className="relative space-y-4">
                  {c.status_history.map((h, idx) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0 ${
                            idx === c.status_history.length - 1
                              ? 'bg-[#C9A84C]'
                              : 'bg-[#D1D5DB]'
                          }`}
                        />
                        {idx < c.status_history.length - 1 && (
                          <div className="w-px flex-1 bg-[#E5E7EB] mt-1" />
                        )}
                      </div>
                      <div className="pb-4 last:pb-0">
                        <p className="text-xs font-semibold text-[#0A1628]">
                          {CASE_STATUS_LABELS[h.to_status]}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">
                          {formatDateTime(h.created_at)}
                        </p>
                        {h.changed_by_profile && (
                          <p className="text-xs text-[#6B7280]">
                            by {h.changed_by_profile.full_name}
                          </p>
                        )}
                        {h.notes && (
                          <p className="text-xs text-[#374151] mt-0.5 italic">{h.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-80 overflow-y-auto space-y-3">
                {c.comments.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] text-center py-4">No comments yet</p>
                ) : (
                  c.comments.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg text-sm ${
                        msg.is_admin
                          ? 'border-l-4 border-[#C9A84C] bg-[#FFF9EC]'
                          : 'bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#374151]">
                          {msg.author?.full_name || 'Unknown'}
                          {msg.is_admin && (
                            <span className="ml-1.5 text-[10px] bg-[#C9A84C] text-[#0A1628] px-1.5 py-0.5 rounded-full font-bold uppercase">
                              Admin
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">
                          {formatDateTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-[#374151]">{msg.content}</p>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Send comment */}
              <div className="flex gap-2 pt-2 border-t border-[#F3F4F6]">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
                />
                <Button
                  size="icon"
                  variant="default"
                  onClick={handleSendComment}
                  disabled={!comment.trim() || sendingComment}
                >
                  {sendingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="Name" value={c.agent?.full_name} />
              <InfoRow label="Agent Code" value={c.agent?.agent_code} />
              <InfoRow label="Role" value={c.agent?.role ? USER_ROLE_LABELS[c.agent.role] : null} />
              <InfoRow label="Email" value={c.agent?.email} />
              <InfoRow label="Phone" value={c.agent?.phone} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl relative animate-in fade-in zoom-in duration-200 my-8">
            <h2 className="text-xl font-bold text-[#0A1628] mb-1">Submit Case</h2>
            <p className="text-sm text-gray-500 mb-6 border-b pb-4">
              Upload the required documents before submitting this case to the admins.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#0A1628]">Documents</h3>
                {[
                  { key: 'applicationForm', label: 'Application Form (Required)' },
                  { key: 'incomeDocument', label: 'Income Document (Required)' },
                  { key: 'propertyDocument', label: 'Property Document (Required)' },
                  { key: 'lawyerQuotation', label: 'Lawyer Quotation' },
                  { key: 'otherFiles', label: 'Other Files' }
                ].map(doc => (
                  <div key={doc.key} className="flex flex-col">
                    <label className="text-xs font-medium text-gray-700 mb-1">{doc.label}</label>
                    <input 
                      type="file" 
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#F3F4F6] file:text-[#0A1628] hover:file:bg-[#E5E7EB] cursor-pointer border rounded-lg pl-1 py-1"
                      onChange={e => setFiles(prev => ({ ...prev, [doc.key]: e.target.files?.[0] }))}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold text-[#0A1628]">Lawyer <span className="text-red-500">*</span></h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['LWZ', 'YG', 'external'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLawyerSelection(opt)}
                      className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                        lawyerSelection === opt
                          ? 'border-[#C9A84C] bg-[#FFF9EC] text-[#0A1628]'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt === 'LWZ' ? 'LWZ' : opt === 'YG' ? 'Y&G' : 'External'}
                    </button>
                  ))}
                </div>

                {lawyerSelection === 'external' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">External Lawyer Name / Firm <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Tan & Partners"
                      value={externalLawyerName}
                      onChange={e => setExternalLawyerName(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    />
                  </div>
                )}

                {(lawyerSelection === 'LWZ' || lawyerSelection === 'YG') && (
                  <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                    ✓ Panel lawyer — lawyer commission will be tracked for payout.
                  </p>
                )}
                {lawyerSelection === 'external' && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    ⚠ External lawyer — no lawyer commission will be generated.
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="lawyerDiscountCheck"
                    checked={hasLawyerDiscount}
                    onChange={(e) => setHasLawyerDiscount(e.target.checked)}
                    className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]"
                  />
                  <label htmlFor="lawyerDiscountCheck" className="text-sm text-gray-700">
                    Lawyer provided discount to client
                  </label>
                </div>
                {hasLawyerDiscount && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Discount Amount (RM)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={lawyerDiscountAmount}
                      onChange={(e) => setLawyerDiscountAmount(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-lg border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-6">
                <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="gold" 
                  onClick={handleSubmitCase}
                  disabled={submittingCase || !files.applicationForm || !files.incomeDocument || !files.propertyDocument}
                >
                  {submittingCase ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {submittingCase ? 'Uploading...' : 'Upload & Submit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accept Case Modal (approved → accepted) */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-[#0A1628] mb-1">Accept Case</h2>
            <p className="text-sm text-gray-500 mb-6 border-b pb-4">
              Upload the bank-signed Letter of Offer to confirm acceptance.
            </p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#0A1628] mb-2">
                  Signed Letter of Offer <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#F3F4F6] file:text-[#0A1628] hover:file:bg-[#E5E7EB] cursor-pointer border rounded-lg pl-1 py-1"
                  onChange={(e) => setLoFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-gray-400 mt-1">Accepted formats: PDF, JPG, PNG</p>
              </div>

              {loFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  {loFile.name} ({(loFile.size / 1024).toFixed(1)} KB)
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                Once accepted, you cannot edit the case. The lawyer will be notified to begin LA preparation.
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => { setShowAcceptModal(false); setLoFile(null) }} disabled={acceptingCase}>
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  onClick={handleAcceptCase}
                  disabled={acceptingCase || !loFile}
                >
                  {acceptingCase ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  {acceptingCase ? 'Uploading...' : 'Confirm Accept'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
