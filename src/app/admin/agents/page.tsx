"use client"

import * as React from "react"
import Link from "next/link"
import { Users, UserPlus, Search, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { USER_ROLE_LABELS, type UserRole } from "@/types/database"

type AgentRow = {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  agent_code: string | null
  upline_id: string | null
  is_active: boolean
  created_at: string
}

const ROLE_TABS: { label: string; value: UserRole | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Agency Manager", value: "agency_manager" },
  { label: "Unit Manager", value: "unit_manager" },
  { label: "Senior Agent", value: "senior_agent" },
  { label: "Agent", value: "agent" },
]

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-indigo-100 text-indigo-700",
  agency_manager: "bg-blue-100 text-blue-700",
  unit_manager: "bg-cyan-100 text-cyan-700",
  senior_agent: "bg-teal-100 text-teal-700",
  agent: "bg-gray-100 text-gray-600",
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = React.useState<AgentRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [activeRole, setActiveRole] = React.useState<UserRole | "all">("all")
  const [showAddModal, setShowAddModal] = React.useState(false)

  // Add agent form
  const [form, setForm] = React.useState({
    full_name: "", email: "", password: "", phone: "", role: "agent" as UserRole, upline_id: "",
  })
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  React.useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeRole !== "all") params.set("role", activeRole)
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await fetch(`/api/agents?${params}`)
      if (res.ok) {
        const json = await res.json()
        setAgents(json.data || [])
      }
      setLoading(false)
    }
    fetchAgents()
  }, [activeRole, debouncedSearch])

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password || !form.role) {
      toast.error("Name, email, password, and role are required")
      return
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/agents/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        phone: form.phone || null,
        role: form.role,
        upline_id: form.upline_id || null,
      }),
    })
    if (res.ok) {
      toast.success("Agent created successfully")
      setShowAddModal(false)
      setForm({ full_name: "", email: "", password: "", phone: "", role: "agent", upline_id: "" })
      // Refresh list
      const refreshRes = await fetch("/api/agents")
      if (refreshRes.ok) {
        const json = await refreshRes.json()
        setAgents(json.data || [])
      }
    } else {
      const json = await res.json()
      toast.error(json.error || "Failed to create agent")
    }
    setSubmitting(false)
  }

  const agentsAsUplines = agents.filter((a) =>
    ["agency_manager", "unit_manager", "senior_agent"].includes(a.role)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Agents</h1>
          <p className="text-gray-500 text-sm mt-1">{agents.length} member{agents.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-[#C9A84C] hover:bg-[#b8943d] text-white">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add Agent
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 bg-white text-sm text-[#0A1628] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
        />
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveRole(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeRole === tab.value
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
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
                  <div className="h-9 w-9 bg-gray-100 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] mb-1">No agents found</h3>
              <p className="text-gray-400 text-sm mb-4">Try adjusting your search or filters</p>
              <Button onClick={() => setShowAddModal(true)} className="bg-[#C9A84C] hover:bg-[#b8943d] text-white" size="sm">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add First Agent
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 sm:px-6 py-3 font-medium text-gray-500">Agent</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Code</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500">Role</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Upline</th>
                    <th className="text-left px-3 sm:px-4 py-3 font-medium text-gray-500">Status</th>
                    <th className="px-3 sm:px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#0A1628] flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-semibold">{a.full_name[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#0A1628] text-xs sm:text-sm truncate">{a.full_name}</div>
                            <div className="text-xs text-gray-400 truncate hidden sm:block">{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 hidden sm:table-cell">
                        <span className="font-mono text-xs text-gray-600">{a.agent_code || "—"}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[a.role]}`}>
                          {USER_ROLE_LABELS[a.role]}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-sm text-gray-500 hidden md:table-cell">
                        {a.upline_id ? <span className="text-xs font-mono text-gray-400">{a.upline_id.slice(0, 8)}…</span> : "—"}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <Link href={`/admin/agents/${a.id}`}>
                          <Button variant="outline" size="sm">View</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold text-[#0A1628]">Add Agent</h2>
              <button onClick={() => { setShowAddModal(false); setForm({ full_name: "", email: "", password: "", phone: "", role: "agent", upline_id: "" }) }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              Fill in the details below. A login account will be created automatically.
              The agent can change their password after logging in.
            </p>

            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ahmad bin Ali"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ahmad@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+601X-XXXXXXX"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Role *</label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                >
                  <option value="agent">Agent</option>
                  <option value="senior_agent">Senior Agent</option>
                  <option value="unit_manager">Unit Manager</option>
                  <option value="agency_manager">Agency Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {agentsAsUplines.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Upline (optional)</label>
                  <select
                    value={form.upline_id}
                    onChange={(e) => setForm({ ...form, upline_id: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  >
                    <option value="">— None —</option>
                    {agentsAsUplines.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.agent_code}) — {USER_ROLE_LABELS[a.role]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                  {submitting ? "Adding..." : "Add Agent"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
