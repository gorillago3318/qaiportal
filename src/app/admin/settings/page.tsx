"use client"

import * as React from "react"
import { Landmark, Percent, Scale, Plus, Pencil, Check, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { USER_ROLE_LABELS, type UserRole } from "@/types/database"

type Bank = { id: string; name: string; commission_rate: number; is_active: boolean }
type TierConfig = { id: string; tier: UserRole; percentage: number }
type Lawyer = { id: string; name: string; firm: string; phone: string | null; is_panel: boolean; la_fee: number | null; spa_fee: number | null; mot_fee: number | null; is_active: boolean }

const TABS = [
  { id: "banks", label: "Banks", icon: Landmark },
  { id: "tiers", label: "Commission Tiers", icon: Percent },
  { id: "lawyers", label: "Panel Lawyers", icon: Scale },
]

// ── Banks Tab ─────────────────────────────────────────────────

function BanksTab() {
  const [banks, setBanks] = React.useState<Bank[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editRate, setEditRate] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [addMode, setAddMode] = React.useState(false)
  const [newBank, setNewBank] = React.useState({ name: "", commission_rate: "" })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  React.useEffect(() => {
    supabase.from("banks").select("*").order("name").then(({ data }: { data: Bank[] | null }) => {
      setBanks((data || []) as Bank[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditSave = async (bank: Bank) => {
    setSaving(true)
    const { error } = await supabase
      .from("banks")
      .update({ commission_rate: Number(editRate) / 100 })
      .eq("id", bank.id)
    if (error) toast.error("Failed to save")
    else {
      toast.success("Updated")
      setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, commission_rate: Number(editRate) / 100 } : b))
      setEditingId(null)
    }
    setSaving(false)
  }

  const handleToggleActive = async (bank: Bank) => {
    const { error } = await supabase.from("banks").update({ is_active: !bank.is_active }).eq("id", bank.id)
    if (error) toast.error("Failed to update")
    else setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, is_active: !bank.is_active } : b))
  }

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBank.name) return
    setSaving(true)
    const { data, error } = await supabase
      .from("banks")
      .insert({ name: newBank.name, commission_rate: Number(newBank.commission_rate) / 100 || 0 })
      .select()
      .single()
    if (error) toast.error("Failed to add: " + error.message)
    else {
      toast.success("Bank added")
      setBanks((prev) => [...prev, data as Bank].sort((a, b) => a.name.localeCompare(b.name)))
      setAddMode(false)
      setNewBank({ name: "", commission_rate: "" })
    }
    setSaving(false)
  }

  if (loading) return <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddMode(true)} size="sm" className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
          <Plus className="h-4 w-4 mr-1.5" /> Add Bank
        </Button>
      </div>

      {addMode && (
        <form onSubmit={handleAddBank} className="flex items-center gap-3 p-4 bg-[#FFF9EC] border border-[#C9A84C]/30 rounded-xl">
          <input
            type="text"
            required
            placeholder="Bank name"
            value={newBank.name}
            onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
            className="flex-1 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.01"
              placeholder="Rate %"
              value={newBank.commission_rate}
              onChange={(e) => setNewBank({ ...newBank, commission_rate: e.target.value })}
              className="w-24 h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <Button type="submit" size="sm" disabled={saving} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">Add</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAddMode(false)}>Cancel</Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Bank</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Commission Rate</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {banks.map((bank) => (
              <tr key={bank.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3.5 font-medium text-[#0A1628]">{bank.name}</td>
                <td className="px-5 py-3.5 text-right">
                  {editingId === bank.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-20 h-8 px-2 rounded-lg border border-[#C9A84C] text-sm text-right focus:outline-none"
                        autoFocus
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <button onClick={() => handleEditSave(bank)} disabled={saving} className="text-teal-600 hover:text-teal-700">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#0A1628] font-medium">{(bank.commission_rate * 100).toFixed(2)}%</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    bank.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {bank.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 justify-end">
                    {editingId !== bank.id && (
                      <button
                        onClick={() => { setEditingId(bank.id); setEditRate(String((bank.commission_rate * 100).toFixed(2))) }}
                        className="text-gray-400 hover:text-[#0A1628]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleToggleActive(bank)} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                      {bank.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Commission Tiers Tab ───────────────────────────────────────

function TiersTab() {
  const [tiers, setTiers] = React.useState<TierConfig[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editPct, setEditPct] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  React.useEffect(() => {
    supabase.from("commission_tier_config").select("*").then(({ data }: { data: TierConfig[] | null }) => {
      setTiers((data || []) as TierConfig[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async (tier: TierConfig) => {
    setSaving(true)
    const { error } = await supabase
      .from("commission_tier_config")
      .update({ percentage: Number(editPct) })
      .eq("id", tier.id)
    if (error) toast.error("Failed to save")
    else {
      toast.success("Updated")
      setTiers((prev) => prev.map((t) => t.id === tier.id ? { ...t, percentage: Number(editPct) } : t))
      setEditingId(null)
    }
    setSaving(false)
  }

  if (loading) return <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />

  const TIER_ORDER: UserRole[] = ["agency_manager", "unit_manager", "senior_agent", "agent", "super_admin", "admin"]

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Percentage of net distributable amount each tier receives from their downline cases.
      </p>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
              <th className="text-right px-5 py-3 font-medium text-gray-500">Percentage</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white">
            {TIER_ORDER.map((roleKey) => {
              const tier = tiers.find((t) => t.tier === roleKey)
              if (!tier) return null
              return (
                <tr key={tier.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-4 font-medium text-[#0A1628]">{USER_ROLE_LABELS[tier.tier]}</td>
                  <td className="px-5 py-4 text-right">
                    {editingId === tier.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={editPct}
                          onChange={(e) => setEditPct(e.target.value)}
                          className="w-20 h-8 px-2 rounded-lg border border-[#C9A84C] text-sm text-right focus:outline-none"
                          autoFocus
                        />
                        <span className="text-sm text-gray-500">%</span>
                        <button onClick={() => handleSave(tier)} disabled={saving} className="text-teal-600 hover:text-teal-700">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="font-heading text-2xl font-bold text-[#0A1628]">{tier.percentage}%</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {editingId !== tier.id && (
                      <button
                        onClick={() => { setEditingId(tier.id); setEditPct(String(tier.percentage)) }}
                        className="text-gray-400 hover:text-[#0A1628]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Lawyers Tab ────────────────────────────────────────────────

function LawyersTab() {
  const [lawyers, setLawyers] = React.useState<Lawyer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [addMode, setAddMode] = React.useState(false)
  const [newLawyer, setNewLawyer] = React.useState({ name: "", firm: "", phone: "", la_fee: "", spa_fee: "", mot_fee: "", is_panel: true })
  const [saving, setSaving] = React.useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  React.useEffect(() => {
    supabase.from("lawyers").select("*").order("name").then(({ data }: { data: Lawyer[] | null }) => {
      setLawyers((data || []) as Lawyer[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLawyer.name || !newLawyer.firm) return
    setSaving(true)
    const { data, error } = await supabase
      .from("lawyers")
      .insert({
        name: newLawyer.name,
        firm: newLawyer.firm,
        phone: newLawyer.phone || null,
        is_panel: newLawyer.is_panel,
        la_fee: newLawyer.la_fee ? Number(newLawyer.la_fee) : null,
        spa_fee: newLawyer.spa_fee ? Number(newLawyer.spa_fee) : null,
        mot_fee: newLawyer.mot_fee ? Number(newLawyer.mot_fee) : null,
      })
      .select()
      .single()
    if (error) toast.error("Failed: " + error.message)
    else {
      toast.success("Lawyer added")
      setLawyers((prev) => [...prev, data as Lawyer])
      setAddMode(false)
      setNewLawyer({ name: "", firm: "", phone: "", la_fee: "", spa_fee: "", mot_fee: "", is_panel: true })
    }
    setSaving(false)
  }

  const handleToggleActive = async (lawyer: Lawyer) => {
    const { error } = await supabase.from("lawyers").update({ is_active: !lawyer.is_active }).eq("id", lawyer.id)
    if (error) toast.error("Failed")
    else setLawyers((prev) => prev.map((l) => l.id === lawyer.id ? { ...l, is_active: !lawyer.is_active } : l))
  }

  if (loading) return <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddMode(true)} size="sm" className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
          <Plus className="h-4 w-4 mr-1.5" /> Add Lawyer
        </Button>
      </div>

      {addMode && (
        <form onSubmit={handleAdd} className="p-4 bg-[#FFF9EC] border border-[#C9A84C]/30 rounded-xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Name *</label>
              <input required value={newLawyer.name} onChange={(e) => setNewLawyer({ ...newLawyer, name: e.target.value })}
                placeholder="Dato' Ahmad bin Ali" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Firm *</label>
              <input required value={newLawyer.firm} onChange={(e) => setNewLawyer({ ...newLawyer, firm: e.target.value })}
                placeholder="Ahmad & Associates" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Phone</label>
              <input value={newLawyer.phone} onChange={(e) => setNewLawyer({ ...newLawyer, phone: e.target.value })}
                placeholder="+601X-XXXXXXX" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">Panel?</label>
              <select value={newLawyer.is_panel ? "yes" : "no"} onChange={(e) => setNewLawyer({ ...newLawyer, is_panel: e.target.value === "yes" })}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]">
                <option value="yes">Yes — Panel</option>
                <option value="no">No — External</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">LA Fee (RM)</label>
              <input type="number" step="0.01" value={newLawyer.la_fee} onChange={(e) => setNewLawyer({ ...newLawyer, la_fee: e.target.value })}
                placeholder="0.00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">SPA Fee (RM)</label>
              <input type="number" step="0.01" value={newLawyer.spa_fee} onChange={(e) => setNewLawyer({ ...newLawyer, spa_fee: e.target.value })}
                placeholder="0.00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1">MOT Fee (RM)</label>
              <input type="number" step="0.01" value={newLawyer.mot_fee} onChange={(e) => setNewLawyer({ ...newLawyer, mot_fee: e.target.value })}
                placeholder="0.00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button type="submit" size="sm" disabled={saving} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">Add Lawyer</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAddMode(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {lawyers.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No lawyers added yet</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Lawyer / Firm</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Panel</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">LA Fee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">SPA Fee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">MOT Fee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white">
              {lawyers.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#0A1628]">{l.name}</div>
                    <div className="text-xs text-gray-400">{l.firm}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.is_panel ? "bg-[#FFF9EC] text-[#9A7020]" : "bg-gray-100 text-gray-500"
                    }`}>
                      {l.is_panel ? "Panel" : "External"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.la_fee ? `RM ${l.la_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.spa_fee ? `RM ${l.spa_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.mot_fee ? `RM ${l.mot_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {l.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => handleToggleActive(l)} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                      {l.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Settings Page ─────────────────────────────────────────

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = React.useState("banks")

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure banks, commission tiers, and panel lawyers</p>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#0A1628] shadow-sm"
                  : "text-gray-500 hover:text-[#0A1628]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">
            {TABS.find((t) => t.id === activeTab)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === "banks" && <BanksTab />}
          {activeTab === "tiers" && <TiersTab />}
          {activeTab === "lawyers" && <LawyersTab />}
        </CardContent>
      </Card>
    </div>
  )
}
