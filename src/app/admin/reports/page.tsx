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
    "Agent", "Sr. Agent", "Unit Manager", "Agency Manager", "Platform Fee (7.5%)",
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
    r.tiers.agent.amount.toFixed(2),
    r.tiers.senior_agent.amount.toFixed(2),
    r.tiers.unit_manager.amount.toFixed(2),
    r.tiers.agency_manager.amount.toFixed(2),
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Gross", value: totalGross, color: "text-[#0A1628]" },
          { label: "Net Distributable", value: totalNet, color: "text-blue-700" },
          { label: "Agent Payouts", value: totalAgent, color: "text-teal-700" },
          { label: "Platform Fees", value: totalPlatform, color: "text-amber-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold font-heading mt-1 ${s.color}`}>{formatCurrency(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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

        {/* Date range */}
        <div className="flex items-center gap-2 ml-auto text-sm">
          <Filter className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
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
                    <td colSpan={3} />
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
                    <td colSpan={2} />
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
