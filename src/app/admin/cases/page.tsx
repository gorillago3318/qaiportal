"use client"

import * as React from "react"
import Link from "next/link"
import { FolderOpen, Search, Download, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { CASE_STATUS_LABELS, LOAN_TYPE_LABELS, type CaseStatus, type LoanType } from "@/types/database"

type CaseRow = {
  id: string
  case_code: string
  loan_type: LoanType
  status: CaseStatus
  proposed_loan_amount: number | null
  created_at: string
  client: { full_name: string; ic_number: string } | null
  agent: { full_name: string; agent_code: string | null } | null
}

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

const STATUS_TABS: { label: string; value: CaseStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Processing", value: "bank_processing" },
  { label: "KIV", value: "kiv" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
  { label: "Pending Execution", value: "pending_execution" },
  { label: "Executed", value: "executed" },
  { label: "Payment Pending", value: "payment_pending" },
  { label: "Paid", value: "paid" },
]

const LOAN_TYPE_TABS: { label: string; value: LoanType | "all" }[] = [
  { label: "All Types", value: "all" },
  { label: "Refinance", value: "refinance" },
  { label: "Subsale", value: "subsale" },
  { label: "Developer", value: "developer" },
]

const PAGE_SIZE = 20

export default function AdminCasesPage() {
  const [cases, setCases] = React.useState<CaseRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [activeStatus, setActiveStatus] = React.useState<CaseStatus | "all">("all")
  const [activeLoanType, setActiveLoanType] = React.useState<LoanType | "all">("all")
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch, activeStatus, activeLoanType])

  React.useEffect(() => {
    const fetchCases = async () => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (activeStatus !== "all") params.set("status", activeStatus)
      if (activeLoanType !== "all") params.set("loan_type", activeLoanType)
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/cases?${params}`)
      if (res.ok) {
        const json = await res.json()
        setCases(json.data || [])
        setTotal(json.count || 0)
      }
      setLoading(false)
    }
    fetchCases()
  }, [page, activeStatus, activeLoanType, debouncedSearch])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">All Cases</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} case{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>

      {/* Search + Loan Type Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by case code or client name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 bg-white text-sm text-[#0A1628] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {LOAN_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveLoanType(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeLoanType === tab.value
                  ? "bg-[#0A1628] text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-[#0A1628] hover:text-[#0A1628]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-gray-100 rounded animate-pulse flex-1" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] mb-1">No cases found</h3>
              <p className="text-gray-400 text-sm">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Case</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Agent</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Loan Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-medium text-[#0A1628] text-xs">{c.case_code}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-[#0A1628]">{c.client?.full_name || "—"}</div>
                          <div className="text-xs text-gray-400">{c.client?.ic_number || ""}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-[#0A1628]">{c.agent?.full_name || "—"}</div>
                          <div className="text-xs text-gray-400">{c.agent?.agent_code || ""}</div>
                        </td>
                        <td className="px-4 py-4 text-gray-600">{LOAN_TYPE_LABELS[c.loan_type]}</td>
                        <td className="px-4 py-4 text-right font-medium text-[#0A1628]">
                          {c.proposed_loan_amount ? formatCurrency(c.proposed_loan_amount) : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                            {CASE_STATUS_LABELS[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/admin/cases/${c.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
