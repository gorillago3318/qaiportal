"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, User, FolderOpen, Mail, Phone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { USER_ROLE_LABELS, CASE_STATUS_LABELS, LOAN_TYPE_LABELS, type UserRole, type CaseStatus } from "@/types/database"

type AgentProfile = {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  agent_code: string | null
  upline_id: string | null
  is_active: boolean
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  created_at: string
  upline: { full_name: string; role: UserRole; agent_code: string | null } | null
}

type CaseSummary = {
  id: string
  case_code: string
  status: CaseStatus
  loan_type: string
  proposed_loan_amount: number | null
  created_at: string
  client: { full_name: string } | null
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

export default function AdminAgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [agent, setAgent] = React.useState<AgentProfile | null>(null)
  const [cases, setCases] = React.useState<CaseSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ role: "" as UserRole, is_active: true, upline_id: "" })
  const [allAgents, setAllAgents] = React.useState<{ id: string; full_name: string; agent_code: string | null; role: UserRole }[]>([])

  React.useEffect(() => {
    const fetchData = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any

      const [agentRes, casesRes, allAgentsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*, upline_id, upline:profiles!profiles_upline_id_fkey(full_name, role, agent_code)")
          .eq("id", id)
          .single(),
        supabase
          .from("cases")
          .select("id, case_code, status, loan_type, proposed_loan_amount, created_at, client:clients(full_name)")
          .eq("agent_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("profiles")
          .select("id, full_name, agent_code, role")
          .not("role", "in", "(super_admin,admin)")
          .eq("is_active", true)
          .neq("id", id)
          .order("role", { ascending: true }),
      ])

      if (agentRes.error || !agentRes.data) {
        toast.error("Agent not found")
        router.push("/admin/agents")
        return
      }

      const agentData = agentRes.data as AgentProfile
      setAgent(agentData)
      setForm({ role: agentData.role, is_active: agentData.is_active, upline_id: agentData.upline_id || "" })
      setCases((casesRes.data || []) as CaseSummary[])
      setAllAgents((allAgentsRes.data || []) as { id: string; full_name: string; agent_code: string | null; role: UserRole }[])
      setLoading(false)
    }
    fetchData()
  }, [id, router])

  const handleSave = async () => {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    const { error } = await supabase
      .from("profiles")
      .update({
        role: form.role,
        is_active: form.is_active,
        upline_id: form.upline_id || null,
      })
      .eq("id", id)

    if (error) {
      toast.error("Failed to save: " + error.message)
    } else {
      toast.success("Profile updated")
      // Refresh to get updated upline display name
      const { data: refreshed } = await supabase
        .from("profiles")
        .select("*, upline_id, upline:profiles!profiles_upline_id_fkey(full_name, role, agent_code)")
        .eq("id", id)
        .single()
      if (refreshed) setAgent(refreshed as AgentProfile)
      setEditMode(false)
    }
    setSaving(false)
  }

  const totalCases = cases.length
  const activeCases = cases.filter((c) => !["paid", "declined", "rejected", "draft"].includes(c.status)).length

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl">
        <div className="h-8 w-48 bg-gray-100 rounded" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (!agent) return null

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/agents">
          <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">{agent.full_name}</h1>
          <p className="text-sm text-gray-400 font-mono">{agent.agent_code || "No agent code"}</p>
        </div>
        {!editMode && (
          <Button onClick={() => setEditMode(true)} variant="outline" size="sm">Edit</Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Cases", value: totalCases },
          { label: "Active Cases", value: activeCases },
          { label: "Joined", value: formatDate(agent.created_at) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-[#0A1628] font-heading mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-[#C9A84C]" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Role</label>
                  <select
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
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Status</label>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Upline</label>
                <select
                  value={form.upline_id}
                  onChange={(e) => setForm({ ...form, upline_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                >
                  <option value="">— No upline (top level) —</option>
                  {allAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}{a.agent_code ? ` (${a.agent_code})` : ''} — {USER_ROLE_LABELS[a.role]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Sets who this agent reports to in the commission chain</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {[
                { label: "Email", icon: Mail, value: agent.email },
                { label: "Phone", icon: Phone, value: agent.phone || "—" },
                { label: "Role", icon: User, value: USER_ROLE_LABELS[agent.role] },
                { label: "Upline", icon: User, value: agent.upline ? `${agent.upline.full_name} (${agent.upline.agent_code}) — ${USER_ROLE_LABELS[agent.upline.role]}` : "—" },
                { label: "Status", icon: User, value: agent.is_active ? "Active" : "Inactive" },
                { label: "Bank Name", icon: User, value: agent.bank_name || "—" },
                { label: "Account Name", icon: User, value: agent.bank_account_name || "—" },
                { label: "Account No.", icon: User, value: agent.bank_account_number || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-[#0A1628]">{value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Cases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4 text-[#C9A84C]" /> Recent Cases
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No cases yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Case</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-[#0A1628] font-medium">{c.case_code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(c.client as { full_name: string } | null)?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {LOAN_TYPE_LABELS[c.loan_type as keyof typeof LOAN_TYPE_LABELS] || c.loan_type}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#0A1628]">
                      {c.proposed_loan_amount ? formatCurrency(c.proposed_loan_amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                        {CASE_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <Link href={`/admin/cases/${c.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
