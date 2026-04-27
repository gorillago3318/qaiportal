"use client"

import * as React from "react"
import { DollarSign, X, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils"
import { LOAN_TYPE_LABELS } from "@/types/database"

type CommissionRow = {
  id: string
  type: "bank" | "lawyer"
  gross_amount: number
  company_cut: number
  net_distributable: number
  tier_breakdown: Record<string, unknown>
  status: "pending" | "calculated" | "payment_pending" | "paid"
  paid_amount: number | null
  paid_at: string | null
  payment_reference: string | null
  created_at: string
  case: {
    id: string
    case_code: string
    loan_type: string
    agent: { full_name: string; agent_code: string | null } | null
  } | null
}

interface TierEntry {
  role: string
  name: string
  percentage: number
  amount: number
  is_platform_fee?: boolean
}

interface BreakdownEntry extends TierEntry {
  user_id: string
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
}

const ROLE_LABELS: Record<string, string> = {
  agent: "Agent",
  senior_agent: "Senior Agent",
  unit_manager: "Unit Manager",
  agency_manager: "Agency Manager",
  admin: "Admin",
  super_admin: "Platform Fee",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  calculated: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-teal-100 text-teal-700",
}

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Calculated", value: "calculated" },
  { label: "Payment Pending", value: "payment_pending" },
  { label: "Paid", value: "paid" },
]

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = React.useState<CommissionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeStatus, setActiveStatus] = React.useState("all")
  const [payModal, setPayModal] = React.useState<CommissionRow | null>(null)
  const [payForm, setPayForm] = React.useState({ paid_amount: "", payment_reference: "", paid_at: "" })
  const [paying, setPaying] = React.useState(false)
  const [payBreakdown, setPayBreakdown] = React.useState<BreakdownEntry[]>([])
  const [breakdownOpen, setBreakdownOpen] = React.useState(true)

  const fetchCommissions = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeStatus !== "all") params.set("status", activeStatus)
    const res = await fetch(`/api/commissions?${params}`)
    if (res.ok) {
      const json = await res.json()
      setCommissions(json.data || [])
    }
    setLoading(false)
  }, [activeStatus])

  React.useEffect(() => { fetchCommissions() }, [fetchCommissions])

  const totalGross = commissions.reduce((s, c) => s + (c.gross_amount || 0), 0)
  // Use net_distributable (not paid_amount) — paid_amount had a bug where it was set to the
  // sum of all rows in the case, causing double-counting when multiple commission types exist.
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + (c.net_distributable || 0), 0)
  const totalPending = commissions.filter((c) => c.status === "payment_pending").reduce((s, c) => s + (c.net_distributable || 0), 0)

  const handleOpenPayModal = async (c: CommissionRow) => {
    setPayModal(c)
    setPayForm({
      paid_amount: String(c.net_distributable),
      payment_reference: "",
      paid_at: new Date().toISOString().slice(0, 10),
    })
    setBreakdownOpen(true)
    setPayBreakdown([])

    // Fetch bank details for each user in tier_breakdown (via admin API to bypass RLS)
    const breakdown = (c.tier_breakdown || {}) as Record<string, TierEntry>
    const userIds = Object.keys(breakdown).filter((id) => breakdown[id]?.amount > 0)
    if (userIds.length === 0) return

    const res = await fetch('/api/profiles/bank-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: userIds }),
    })
    const profileJson = res.ok ? await res.json() : { data: [] }

    const profileMap: Record<string, { bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null }> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profileJson.data?.forEach((p: any) => { profileMap[p.id] = p })

    const entries: BreakdownEntry[] = userIds
      .map((userId) => ({
        ...(breakdown[userId] as TierEntry),
        user_id: userId,
        bank_name: profileMap[userId]?.bank_name ?? null,
        bank_account_number: profileMap[userId]?.bank_account_number ?? null,
        bank_account_name: profileMap[userId]?.bank_account_name ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)

    setPayBreakdown(entries)
  }

  const handleMarkPaid = async () => {
    if (!payModal) return
    setPaying(true)
    const res = await fetch(`/api/commissions?id=${payModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        paid_amount: payForm.paid_amount ? Number(payForm.paid_amount) : payModal.net_distributable,
        payment_reference: payForm.payment_reference || null,
        paid_at: payForm.paid_at || new Date().toISOString(),
      }),
    })
    if (res.ok) {
      toast.success("Marked as paid")
      setPayModal(null)
      setPayForm({ paid_amount: "", payment_reference: "", paid_at: "" })
      fetchCommissions()
    } else {
      const json = await res.json()
      toast.error(json.error || "Failed to update")
    }
    setPaying(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Commissions</h1>
        <p className="text-gray-500 text-sm mt-1">Track and process commission payouts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Gross", value: totalGross, color: "text-[#0A1628]", bg: "bg-[#EEF1F7]", iconColor: "text-[#0A1628]" },
          { label: "Total Paid Out", value: totalPaid, color: "text-teal-700", bg: "bg-teal-50", iconColor: "text-teal-600" },
          { label: "Pending Payout", value: totalPending, color: "text-amber-700", bg: "bg-amber-50", iconColor: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-2xl font-bold font-heading mt-1 ${stat.color}`}>{formatCurrency(stat.value)}</p>
                </div>
                <div className={`h-10 w-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
                  <DollarSign className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveStatus(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeStatus === tab.value
                ? "bg-[#0A1628] text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:border-[#0A1628] hover:text-[#0A1628]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse flex-1" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
                  <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] mb-1">No commission records</h3>
              <p className="text-gray-400 text-sm">Commissions are created when cases reach approved status</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[460px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 sm:px-6 py-3 font-medium text-gray-500">Case</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Agent</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Type</th>
                    <th className="text-right px-3 sm:px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Gross</th>
                    <th className="text-right px-3 sm:px-4 py-3 font-medium text-gray-500">Net Distributable</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="px-3 sm:px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => {
                    const caseData = c.case as typeof c.case
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="font-mono font-medium text-xs text-[#0A1628]">{caseData?.case_code || "—"}</div>
                          <div className="text-xs text-gray-400">
                            {caseData?.loan_type ? (LOAN_TYPE_LABELS[caseData.loan_type as keyof typeof LOAN_TYPE_LABELS] || caseData.loan_type) : ""}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                          <div className="text-[#0A1628]">{caseData?.agent?.full_name || "—"}</div>
                          <div className="text-xs text-gray-400">{caseData?.agent?.agent_code || ""}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            c.type === "bank" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {c.type === "bank" ? "Bank" : "Lawyer"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-right font-medium text-[#0A1628] hidden md:table-cell">{formatCurrency(c.gross_amount)}</td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-right font-medium text-[#0A1628]">{formatCurrency(c.net_distributable)}</td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-600"}`}>
                            {c.status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          {c.status !== "paid" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPayModal(c)}
                              className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                            >
                              Mark Paid
                            </Button>
                          )}
                          {c.status === "paid" && (
                            <div className="text-xs text-gray-400">
                              {c.paid_at ? formatDate(c.paid_at) : "Paid"}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-[#0A1628]">Mark as Paid</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Case {payModal.case?.case_code} · {payModal.type === "bank" ? "Bank" : "Lawyer"} Commission
                </p>
              </div>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Payout Breakdown */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setBreakdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#0A1628]">Payout Recipients</span>
                    <span className="text-xs bg-[#0A1628] text-white px-1.5 py-0.5 rounded-full font-medium">
                      {payBreakdown.length}
                    </span>
                  </div>
                  {breakdownOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>

                {breakdownOpen && (
                  <div className="divide-y divide-gray-50">
                    {payBreakdown.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">Loading breakdown...</div>
                    ) : (
                      payBreakdown.map((entry) => (
                        <div key={entry.user_id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <span className="text-sm font-semibold text-[#0A1628]">{entry.name}</span>
                              <span className="ml-2 text-xs text-gray-400">
                                {entry.is_platform_fee ? "Platform Fee" : ROLE_LABELS[entry.role] || entry.role}
                                {" · "}{entry.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <span className="text-sm font-bold text-teal-700">{formatCurrency(entry.amount)}</span>
                          </div>
                          {/* Bank details */}
                          {entry.bank_account_number ? (
                            <div className="mt-1 bg-blue-50 rounded-lg px-3 py-2 text-xs space-y-0.5">
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-16 flex-shrink-0">Bank</span>
                                <span className="font-medium text-[#0A1628]">{entry.bank_name || "—"}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-16 flex-shrink-0">Account</span>
                                <span className="font-mono font-semibold text-[#0A1628] tracking-wider">{entry.bank_account_number}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-gray-400 w-16 flex-shrink-0">Name</span>
                                <span className="font-medium text-[#0A1628]">{entry.bank_account_name || "—"}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mt-1">
                              ⚠ No bank details on file — ask agent to update their profile.
                            </p>
                          )}
                        </div>
                      ))
                    )}
                    {/* Total */}
                    <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total to Distribute</span>
                      <span className="font-bold text-[#0A1628]">{formatCurrency(payModal.net_distributable)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Total Amount Paid (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payForm.paid_amount}
                    onChange={(e) => setPayForm({ ...payForm, paid_amount: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Payment Reference</label>
                  <input
                    type="text"
                    value={payForm.payment_reference}
                    onChange={(e) => setPayForm({ ...payForm, payment_reference: e.target.value })}
                    placeholder="Bank transfer ref / receipt no."
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Payment Date (DD/MM/YYYY)</label>
                  <input
                    type="date"
                    value={payForm.paid_at}
                    onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPayModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleMarkPaid} disabled={paying} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                  {paying ? "Processing..." : "Confirm Paid"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
