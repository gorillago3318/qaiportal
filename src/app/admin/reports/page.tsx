"use client"

import * as React from "react"
import { Download, FileText, Filter } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────

type TierSlot = { name: string; amount: number }

type ReportRow = {
  id: string
  type: "bank" | "lawyer"
  status: string
  paid_at: string | null
  created_at: string
  case_code: string | null
  agency_name: string | null
  client_name: string | null
  loan_amount: number | null
  bank_name: string | null
  lawyer_name: string | null
  lawyer_firm: string | null
  professional_fee: number | null
  special_discount: number | null
  gross_amount: number
  company_cut: number
  net_distributable: number
  bank_admin_fee: number
  panel_admin_fee: number
  tiers: {
    agent: TierSlot
    senior_agent: TierSlot
    unit_manager: TierSlot
    agency_manager: TierSlot
    platform_fee: TierSlot
  }
}

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Calculated", value: "calculated" },
  { label: "Payment Pending", value: "payment_pending" },
  { label: "Paid", value: "paid" },
]

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  calculated: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  paid: "bg-teal-100 text-teal-700",
}

// ─── CSV Export ───────────────────────────────────────────────

function downloadCsv(rows: ReportRow[]) {
  const headers = [
    "Case Code", "Agency", "Client", "Loan Amount",
    "Bank", "Lawyer", "Prof. Fee", "Discount",
    "Type", "Gross Amount", "RM50 Admin", "RM200 Admin",
    "Company Cut (10%)", "Net Distributable",
    "Agent Name", "Agent Amount (RM)",
    "Sr. Agent Name", "Sr. Agent Amount (RM)",
    "Unit Manager Name", "Unit Manager Amount (RM)",
    "Agency Manager Name", "Agency Manager Amount (RM)",
    "Platform Fee Recipient", "Platform Fee Amount (RM)",
    "Status", "Paid Date",
  ]

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines = rows.map((r) => [
    r.case_code ?? "",
    r.agency_name ?? "",
    r.client_name ?? "",
    r.loan_amount ?? "",
    r.bank_name ?? "",
    r.lawyer_name ? `${r.lawyer_name}${r.lawyer_firm ? ` (${r.lawyer_firm})` : ""}` : "",
    r.professional_fee ?? "",
    r.special_discount ?? "",
    r.type === "bank" ? "Bank" : "Lawyer",
    r.gross_amount.toFixed(2),
    r.bank_admin_fee.toFixed(2),
    r.panel_admin_fee.toFixed(2),
    r.company_cut.toFixed(2),
    r.net_distributable.toFixed(2),
    r.tiers.agent.name !== "—" ? r.tiers.agent.name : "",
    r.tiers.agent.amount.toFixed(2),
    r.tiers.senior_agent.name !== "—" ? r.tiers.senior_agent.name : "",
    r.tiers.senior_agent.amount.toFixed(2),
    r.tiers.unit_manager.name !== "—" ? r.tiers.unit_manager.name : "",
    r.tiers.unit_manager.amount.toFixed(2),
    r.tiers.agency_manager.name !== "—" ? r.tiers.agency_manager.name : "",
    r.tiers.agency_manager.amount.toFixed(2),
    r.tiers.platform_fee.name !== "—" ? r.tiers.platform_fee.name : "",
    r.tiers.platform_fee.amount.toFixed(2),
    r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    r.paid_at ? formatDate(r.paid_at) : "",
  ].map(escape).join(","))

  const csv = [headers.join(","), ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `commission_report_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [rows, setRows] = React.useState<ReportRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeStatus, setActiveStatus] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

  const fetchReport = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeStatus !== "all") params.set("status", activeStatus)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo + "T23:59:59")
    const res = await fetch(`/api/reports/commissions?${params}`)
    if (res.ok) {
      const json = await res.json()
      setRows(json.data || [])
    }
    setLoading(false)
  }, [activeStatus, dateFrom, dateTo])

  React.useEffect(() => { fetchReport() }, [fetchReport])

  // ── Summary totals ──
  const totalGross = rows.reduce((s, r) => s + r.gross_amount, 0)
  const totalNet = rows.reduce((s, r) => s + r.net_distributable, 0)
  const totalAgent = rows.reduce((s, r) => s + r.tiers.agent.amount, 0)
  const totalPlatform = rows.reduce((s, r) => s + r.tiers.platform_fee.amount, 0)

  // ── QAI Revenue Capture totals ──
  const totalRM50 = rows.reduce((s, r) => s + r.bank_admin_fee, 0)
  const totalRM200 = rows.reduce((s, r) => s + r.panel_admin_fee, 0)
  const totalCompanyCut = rows.reduce((s, r) => s + r.company_cut, 0)
  const totalQAIRevenue = totalRM50 + totalRM200 + totalCompanyCut + totalPlatform

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Commission Report</h1>
          <p className="text-gray-500 text-sm mt-1">Full tier breakdown per commission record</p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCsv(rows)}
          disabled={rows.length === 0}
          className="shrink-0"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Flow Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Gross", value: totalGross, color: "text-[#0A1628]" },
          { label: "Net Distributable", value: totalNet, color: "text-blue-700" },
          { label: "Agent Payouts", value: totalAgent, color: "text-teal-700" },
          { label: "Platform Fees (7.5%)", value: totalPlatform, color: "text-amber-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QAI Revenue Capture */}
      <Card className="border-[#0A1628]/15">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1.5 w-5 rounded-full bg-[#0A1628]" />
            <h2 className="text-sm font-bold text-[#0A1628] uppercase tracking-widest">QAI Revenue Capture</h2>
            <span className="ml-auto text-xs text-gray-400">{rows.length} records in view</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                label: "RM50 Admin Fees",
                sublabel: "Flat deduction per bank comm.",
                value: totalRM50,
                tag: "RM 50 / case",
                color: "text-indigo-700",
                bg: "bg-indigo-50",
                border: "border-indigo-100",
              },
              {
                label: "RM200 Panel Fees",
                sublabel: "Panel lawyer LA admin deduction",
                value: totalRM200,
                tag: "RM 200 / lawyer",
                color: "text-purple-700",
                bg: "bg-purple-50",
                border: "border-purple-100",
              },
              {
                label: "Company Cut (10%)",
                sublabel: "10% of lawyer prof. fee",
                value: totalCompanyCut,
                tag: "10% of prof. fee",
                color: "text-rose-700",
                bg: "bg-rose-50",
                border: "border-rose-100",
              },
              {
                label: "Platform Fee (7.5%)",
                sublabel: "Super Admin platform share",
                value: totalPlatform,
                tag: "7.5% of net",
                color: "text-amber-700",
                bg: "bg-amber-50",
                border: "border-amber-100",
              },
              {
                label: "Total QAI Revenue",
                sublabel: "RM50 + RM200 + 10% + 7.5%",
                value: totalQAIRevenue,
                tag: "All captures",
                color: "text-white",
                bg: "bg-white/10",
                border: "border-[#0A1628]/20",
                highlight: true,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border ${item.border} p-4 ${item.highlight ? "bg-[#0A1628]" : "bg-white"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.highlight ? "bg-white/10 text-white" : `${item.bg} ${item.color}`}`}>
                    {item.tag}
                  </span>
                </div>
                <p className={`text-lg font-bold font-heading tabular-nums ${item.highlight ? "text-white" : item.color}`}>
                  {formatCurrency(item.value)}
                </p>
                <p className={`text-xs mt-0.5 font-semibold ${item.highlight ? "text-white/80" : "text-gray-700"}`}>
                  {item.label}
                </p>
                <p className={`text-[10px] mt-0.5 ${item.highlight ? "text-white/50" : "text-gray-400"}`}>
                  {item.sublabel}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
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

        {/* Date range — values stored as YYYY-MM-DD, displayed as DD/MM/YYYY */}
        <div className="flex items-center gap-2 ml-auto text-sm">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400 whitespace-nowrap">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="DD/MM/YYYY"
            className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            style={{ colorScheme: "light" }}
          />
          <span className="text-gray-400">—</span>
          <span className="text-xs text-gray-400 whitespace-nowrap">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="DD/MM/YYYY"
            className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            style={{ colorScheme: "light" }}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo("") }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  {[...Array(8)].map((__, j) => (
                    <div key={j} className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
                  ))}
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                <FileText className="h-7 w-7 text-gray-300" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] mb-1">No records found</h3>
              <p className="text-gray-400 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1400px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Case</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Agency</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Client</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Loan Amt</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Bank</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Lawyer</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Prof. Fee</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Discount</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Type</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Gross</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">RM50</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">RM200</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Co. Cut 10%</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Net Dist.</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Agent</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Sr. Agent</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Unit Mgr</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Agency Mgr</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Platform 7.5%</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Created</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-500 whitespace-nowrap">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-3 font-mono font-semibold text-[#0A1628] whitespace-nowrap">
                        {r.case_code || "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap max-w-[120px] truncate">
                        {r.agency_name || "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap max-w-[120px] truncate">
                        {r.client_name || "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-[#0A1628] whitespace-nowrap">
                        {r.loan_amount ? formatCurrency(r.loan_amount) : "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap max-w-[100px] truncate">
                        {r.bank_name || "—"}
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap max-w-[120px] truncate">
                        {r.lawyer_name
                          ? `${r.lawyer_name}${r.lawyer_firm ? ` · ${r.lawyer_firm}` : ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {r.professional_fee ? formatCurrency(r.professional_fee) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500">
                        {r.special_discount ? formatCurrency(r.special_discount) : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                          r.type === "bank"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {r.type === "bank" ? "Bank" : "Lawyer"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-[#0A1628]">
                        {formatCurrency(r.gross_amount)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500">
                        {r.bank_admin_fee > 0 ? formatCurrency(r.bank_admin_fee) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500">
                        {r.panel_admin_fee > 0 ? formatCurrency(r.panel_admin_fee) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {formatCurrency(r.company_cut)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-[#0A1628]">
                        {formatCurrency(r.net_distributable)}
                      </td>
                      <TierCell tier={r.tiers.agent} />
                      <TierCell tier={r.tiers.senior_agent} />
                      <TierCell tier={r.tiers.unit_manager} />
                      <TierCell tier={r.tiers.agency_manager} />
                      <TierCell tier={r.tiers.platform_fee} highlight />
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                          {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                        {r.paid_at ? formatDate(r.paid_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={9} className="px-3 py-3 text-gray-500 text-right">TOTAL ({rows.length} records)</td>
                    <td className="px-3 py-3 text-right text-[#0A1628]">{formatCurrency(totalGross)}</td>
                    <td className="px-3 py-3 text-right text-indigo-700">{formatCurrency(totalRM50)}</td>
                    <td className="px-3 py-3 text-right text-purple-700">{formatCurrency(totalRM200)}</td>
                    <td className="px-3 py-3 text-right text-rose-700">{formatCurrency(totalCompanyCut)}</td>
                    <td className="px-3 py-3 text-right text-[#0A1628]">{formatCurrency(totalNet)}</td>
                    <td className="px-3 py-3 text-right text-teal-700">
                      {formatCurrency(rows.reduce((s, r) => s + r.tiers.agent.amount, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-teal-700">
                      {formatCurrency(rows.reduce((s, r) => s + r.tiers.senior_agent.amount, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-teal-700">
                      {formatCurrency(rows.reduce((s, r) => s + r.tiers.unit_manager.amount, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-teal-700">
                      {formatCurrency(rows.reduce((s, r) => s + r.tiers.agency_manager.amount, 0))}
                    </td>
                    <td className="px-3 py-3 text-right text-amber-700">
                      {formatCurrency(totalPlatform)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                  {/* QAI Revenue capture summary row */}
                  <tr className="bg-[#0A1628]/4 border-t border-[#0A1628]/10">
                    <td colSpan={10} className="px-3 py-2 text-xs font-bold text-[#0A1628] text-right uppercase tracking-wide">
                      QAI Revenue Captured
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-[10px] text-indigo-500 font-medium">RM50</div>
                      <div className="text-xs font-bold text-indigo-700">{formatCurrency(totalRM50)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-[10px] text-purple-500 font-medium">RM200</div>
                      <div className="text-xs font-bold text-purple-700">{formatCurrency(totalRM200)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-[10px] text-rose-500 font-medium">Co. 10%</div>
                      <div className="text-xs font-bold text-rose-700">{formatCurrency(totalCompanyCut)}</div>
                    </td>
                    <td colSpan={4} />
                    <td className="px-3 py-2 text-right">
                      <div className="text-[10px] text-amber-500 font-medium">Platform</div>
                      <div className="text-xs font-bold text-amber-700">{formatCurrency(totalPlatform)}</div>
                    </td>
                    <td className="px-3 py-2 text-right" colSpan={2}>
                      <div className="text-[10px] text-[#0A1628]/60 font-medium">Total QAI</div>
                      <div className="text-sm font-black text-[#0A1628]">{formatCurrency(totalQAIRevenue)}</div>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TierCell({ tier, highlight }: { tier: TierSlot; highlight?: boolean }) {
  if (tier.amount === 0) {
    return <td className="px-3 py-3 text-right text-gray-300">—</td>
  }
  return (
    <td className={`px-3 py-3 text-right ${highlight ? "text-amber-700 font-medium" : "text-teal-700"}`}>
      <div className="font-medium">{formatCurrency(tier.amount)}</div>
      {tier.name !== "—" && (
        <div className="text-gray-400 text-[10px] truncate max-w-[80px]">{tier.name}</div>
      )}
    </td>
  )
}
