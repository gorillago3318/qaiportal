"use client"

import * as React from "react"
import { ShieldAlert, ChevronLeft, ChevronRight, Search, Filter, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuditLog = {
  id: string
  actor_id: string
  actor_name: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string
  entity_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  case_status_changed: "Status Changed",
  case_created: "Case Created",
  case_updated: "Case Updated",
  commission_paid: "Commission Paid",
  commission_updated: "Commission Updated",
  document_uploaded: "Document Uploaded",
  lawyer_notified: "Lawyer Notified",
  settings_changed: "Settings Changed",
}

const ACTION_COLORS: Record<string, string> = {
  case_status_changed: "bg-blue-100 text-blue-700",
  case_created: "bg-green-100 text-green-700",
  case_updated: "bg-gray-100 text-gray-600",
  commission_paid: "bg-teal-100 text-teal-700",
  commission_updated: "bg-amber-100 text-amber-700",
  document_uploaded: "bg-purple-100 text-purple-700",
  lawyer_notified: "bg-indigo-100 text-indigo-700",
  settings_changed: "bg-red-100 text-red-600",
}

const ROLE_LABELS: Record<string, string> = {
  agent: "Agent",
  senior_agent: "Sr. Agent",
  unit_manager: "Unit Mgr",
  agency_manager: "Agency Mgr",
  admin: "Admin",
  super_admin: "Super Admin",
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—"
  const parts: string[] = []
  if (metadata.from && metadata.to) {
    parts.push(`${String(metadata.from)} → ${String(metadata.to)}`)
  }
  if (metadata.paid_amount) {
    parts.push(`RM ${Number(metadata.paid_amount).toFixed(2)}`)
  }
  if (metadata.payment_reference) {
    parts.push(`Ref: ${String(metadata.payment_reference)}`)
  }
  if (metadata.notes && String(metadata.notes).trim()) {
    parts.push(`Note: ${String(metadata.notes)}`)
  }
  if (metadata.status && !metadata.from) {
    parts.push(`Status: ${String(metadata.status)}`)
  }
  return parts.length > 0 ? parts.join(" · ") : JSON.stringify(metadata)
}

export default function AuditLogPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)

  const [filterAction, setFilterAction] = React.useState("")
  const [filterFrom, setFilterFrom] = React.useState("")
  const [filterTo, setFilterTo] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [searchInput, setSearchInput] = React.useState("")

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchLogs = React.useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (filterAction) params.set("action", filterAction)
      if (filterFrom) params.set("from", filterFrom)
      if (filterTo) params.set("to", filterTo + "T23:59:59Z")
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`)
      if (!res.ok) {
        console.error("Audit log fetch failed:", await res.text())
        return
      }
      const json = await res.json()
      setLogs(json.data ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterFrom, filterTo])

  React.useEffect(() => {
    fetchLogs(page)
  }, [fetchLogs, page])

  // Client-side search filter on actor name and entity label
  const visible = search
    ? logs.filter(
        (l) =>
          l.actor_name.toLowerCase().includes(search.toLowerCase()) ||
          (l.entity_label ?? "").toLowerCase().includes(search.toLowerCase()) ||
          l.action.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  function applySearch() {
    setSearch(searchInput)
  }

  function applyFilters() {
    setPage(1)
    fetchLogs(1)
  }

  function clearFilters() {
    setFilterAction("")
    setFilterFrom("")
    setFilterTo("")
    setSearch("")
    setSearchInput("")
    setPage(1)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString()} records — visible to super admin only</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex gap-1.5 items-center border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[220px]">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search actor / entity…"
                className="text-sm outline-none flex-1 placeholder:text-gray-400"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>

            {/* Action filter */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              >
                <option value="">All actions</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">From</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              />
            </div>

            {/* Date to */}
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5 bg-gray-900 text-white hover:bg-gray-800" onClick={applyFilters}>
                <Filter className="h-3.5 w-3.5" />
                Apply
              </Button>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">No audit records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Date / Time</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Actor</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Action</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Entity</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((log, idx) => (
                    <tr
                      key={log.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                        {new Date(log.created_at).toLocaleString("en-MY", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit", hour12: true,
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{log.actor_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                          {ROLE_LABELS[log.actor_role] ?? log.actor_role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 font-medium">{log.entity_label ?? log.entity_id}</div>
                        <div className="text-xs text-gray-400">{log.entity_type}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[280px]">
                        {formatMetadata(log.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} — {total.toLocaleString()} total records
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
