"use client"

import * as React from "react"
import { Landmark, Percent, Scale, Plus, Pencil, Check, X, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { USER_ROLE_LABELS, type UserRole } from "@/types/database"

type Bank = { id: string; name: string; commission_rate: number; is_active: boolean }
type TierConfig = { id: string; tier: UserRole; percentage: number }
type Lawyer = { id: string; name: string; firm: string; phone: string | null; general_email: string | null; contact_email: string | null; is_panel: boolean; la_fee: number | null; spa_fee: number | null; mot_fee: number | null; is_active: boolean; panel_banks?: string[] }

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

type EditForm = { name: string; firm: string; phone: string; general_email: string; contact_email: string; la_fee: string; spa_fee: string; mot_fee: string; panel_bank_ids: string[] }

function LawyerForm({
  values, banks, onChange, onToggleBank,
}: {
  values: EditForm
  banks: Bank[]
  onChange: (field: keyof EditForm, value: string) => void
  onToggleBank: (bankId: string) => void
}) {
  const cls = "w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">Name *</label>
        <input required value={values.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Dato' Ahmad bin Ali" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">Firm *</label>
        <input required value={values.firm} onChange={(e) => onChange("firm", e.target.value)} placeholder="Ahmad & Associates" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">Phone</label>
        <input value={values.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="+601X-XXXXXXX" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">General Email</label>
        <input type="email" value={values.general_email} onChange={(e) => onChange("general_email", e.target.value)} placeholder="office@lawfirm.com" className={cls} />
        <p className="text-xs text-gray-400 mt-0.5">Printed on bank forms</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">Contact Email</label>
        <input type="email" value={values.contact_email} onChange={(e) => onChange("contact_email", e.target.value)} placeholder="lawyer@lawfirm.com" className={cls} />
        <p className="text-xs text-gray-400 mt-0.5">Used for quotation requests (LA/SPA/MOT)</p>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium text-[#0A1628] mb-2">Panel for Banks</label>
        <div className="flex flex-wrap gap-3">
          {banks.map((bank) => (
            <label key={bank.id} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.panel_bank_ids.includes(bank.id)} onChange={() => onToggleBank(bank.id)}
                className="rounded border-gray-300 text-[#C9A84C] focus:ring-[#C9A84C]" />
              <span className="text-sm text-[#0A1628]">{bank.name}</span>
            </label>
          ))}
          {banks.length === 0 && <span className="text-xs text-gray-400">No banks configured yet</span>}
        </div>
        <p className="text-xs text-gray-400 mt-1">Leave unchecked for external (non-panel) lawyers</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">LA Fee (RM)</label>
        <input type="number" step="0.01" value={values.la_fee} onChange={(e) => onChange("la_fee", e.target.value)} placeholder="0.00" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">SPA Fee (RM)</label>
        <input type="number" step="0.01" value={values.spa_fee} onChange={(e) => onChange("spa_fee", e.target.value)} placeholder="0.00" className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-[#0A1628] mb-1">MOT Fee (RM)</label>
        <input type="number" step="0.01" value={values.mot_fee} onChange={(e) => onChange("mot_fee", e.target.value)} placeholder="0.00" className={cls} />
      </div>
    </div>
  )
}

const EMPTY_FORM: EditForm = { name: "", firm: "", phone: "", general_email: "", contact_email: "", la_fee: "", spa_fee: "", mot_fee: "", panel_bank_ids: [] }

function LawyersTab() {
  const [lawyers, setLawyers] = React.useState<Lawyer[]>([])
  const [banks, setBanks] = React.useState<Bank[]>([])
  const [loading, setLoading] = React.useState(true)
  const [addMode, setAddMode] = React.useState(false)
  const [newLawyer, setNewLawyer] = React.useState<EditForm>(EMPTY_FORM)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editForm, setEditForm] = React.useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  React.useEffect(() => {
    const load = async () => {
      const [{ data: lawyerData }, { data: bankData }, { data: assocData }] = await Promise.all([
        supabase.from("lawyers").select("*").order("name"),
        supabase.from("banks").select("id, name").eq("is_active", true).order("name"),
        supabase.from("lawyer_bank_associations").select("lawyer_id, bank_id").eq("is_panel", true),
      ])
      const assocMap: Record<string, string[]> = {}
      for (const a of (assocData || [])) {
        if (!assocMap[a.lawyer_id]) assocMap[a.lawyer_id] = []
        assocMap[a.lawyer_id].push(a.bank_id)
      }
      setLawyers((lawyerData || []).map((l: Lawyer) => ({ ...l, panel_banks: assocMap[l.id] || [] })))
      setBanks(bankData || [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchNewLawyer = (field: keyof EditForm, value: string) => setNewLawyer((p) => ({ ...p, [field]: value }))
  const toggleNewBank = (id: string) => setNewLawyer((p) => ({ ...p, panel_bank_ids: p.panel_bank_ids.includes(id) ? p.panel_bank_ids.filter((x) => x !== id) : [...p.panel_bank_ids, id] }))

  const patchEditForm = (field: keyof EditForm, value: string) => setEditForm((p) => ({ ...p, [field]: value }))
  const toggleEditBank = (id: string) => setEditForm((p) => ({ ...p, panel_bank_ids: p.panel_bank_ids.includes(id) ? p.panel_bank_ids.filter((x) => x !== id) : [...p.panel_bank_ids, id] }))

  const startEdit = (l: Lawyer) => {
    setEditingId(l.id)
    setEditForm({
      name: l.name,
      firm: l.firm,
      phone: l.phone || "",
      general_email: l.general_email || "",
      contact_email: l.contact_email || "",
      la_fee: l.la_fee?.toString() || "",
      spa_fee: l.spa_fee?.toString() || "",
      mot_fee: l.mot_fee?.toString() || "",
      panel_bank_ids: l.panel_banks || [],
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(EMPTY_FORM) }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLawyer.name || !newLawyer.firm) return
    setSaving(true)
    const { data, error } = await supabase
      .from("lawyers")
      .insert({ name: newLawyer.name, firm: newLawyer.firm, phone: newLawyer.phone || null, general_email: newLawyer.general_email || null, contact_email: newLawyer.contact_email || null, is_panel: newLawyer.panel_bank_ids.length > 0, la_fee: newLawyer.la_fee ? Number(newLawyer.la_fee) : null, spa_fee: newLawyer.spa_fee ? Number(newLawyer.spa_fee) : null, mot_fee: newLawyer.mot_fee ? Number(newLawyer.mot_fee) : null })
      .select().single()
    if (error) { toast.error("Failed: " + error.message); setSaving(false); return }
    if (newLawyer.panel_bank_ids.length > 0) {
      const { error: ae } = await supabase.from("lawyer_bank_associations").insert(newLawyer.panel_bank_ids.map((bid) => ({ lawyer_id: data.id, bank_id: bid, is_panel: true })))
      if (ae) toast.error("Lawyer added but bank links failed: " + ae.message)
    }
    toast.success("Lawyer added")
    setLawyers((p) => [...p, { ...data, panel_banks: newLawyer.panel_bank_ids }])
    setAddMode(false)
    setNewLawyer(EMPTY_FORM)
    setSaving(false)
  }

  const handleEditSave = async (lawyer: Lawyer) => {
    if (!editForm.name || !editForm.firm) return
    setSaving(true)
    const isPanel = editForm.panel_bank_ids.length > 0
    const { error } = await supabase
      .from("lawyers")
      .update({ name: editForm.name, firm: editForm.firm, phone: editForm.phone || null, general_email: editForm.general_email || null, contact_email: editForm.contact_email || null, is_panel: isPanel, la_fee: editForm.la_fee ? Number(editForm.la_fee) : null, spa_fee: editForm.spa_fee ? Number(editForm.spa_fee) : null, mot_fee: editForm.mot_fee ? Number(editForm.mot_fee) : null })
      .eq("id", lawyer.id)
    if (error) { toast.error("Failed: " + error.message); setSaving(false); return }

    // Replace bank associations: delete all then re-insert
    await supabase.from("lawyer_bank_associations").delete().eq("lawyer_id", lawyer.id)
    if (editForm.panel_bank_ids.length > 0) {
      const { error: ae } = await supabase.from("lawyer_bank_associations").insert(editForm.panel_bank_ids.map((bid) => ({ lawyer_id: lawyer.id, bank_id: bid, is_panel: true })))
      if (ae) toast.error("Saved but bank links failed: " + ae.message)
    }

    toast.success("Lawyer updated")
    setLawyers((p) => p.map((l) => l.id === lawyer.id ? { ...l, name: editForm.name, firm: editForm.firm, phone: editForm.phone || null, general_email: editForm.general_email || null, contact_email: editForm.contact_email || null, is_panel: isPanel, la_fee: editForm.la_fee ? Number(editForm.la_fee) : null, spa_fee: editForm.spa_fee ? Number(editForm.spa_fee) : null, mot_fee: editForm.mot_fee ? Number(editForm.mot_fee) : null, panel_banks: editForm.panel_bank_ids } : l))
    cancelEdit()
    setSaving(false)
  }

  const handleDelete = async (lawyer: Lawyer) => {
    if (!confirm(`Delete "${lawyer.name}" from ${lawyer.firm}? This cannot be undone.`)) return
    const { error } = await supabase.from("lawyers").delete().eq("id", lawyer.id)
    if (error) { toast.error("Failed to delete: " + error.message); return }
    toast.success("Lawyer deleted")
    setLawyers((p) => p.filter((l) => l.id !== lawyer.id))
  }

  const handleToggleActive = async (lawyer: Lawyer) => {
    const { error } = await supabase.from("lawyers").update({ is_active: !lawyer.is_active }).eq("id", lawyer.id)
    if (error) toast.error("Failed")
    else setLawyers((p) => p.map((l) => l.id === lawyer.id ? { ...l, is_active: !lawyer.is_active } : l))
  }

  if (loading) return <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setAddMode(true); cancelEdit() }} size="sm" className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
          <Plus className="h-4 w-4 mr-1.5" /> Add Lawyer
        </Button>
      </div>

      {addMode && (
        <form onSubmit={handleAdd} className="p-4 bg-[#FFF9EC] border border-[#C9A84C]/30 rounded-xl space-y-3">
          <p className="text-xs font-semibold text-[#0A1628] uppercase tracking-wide">New Lawyer</p>
          <LawyerForm values={newLawyer} banks={banks} onChange={patchNewLawyer} onToggleBank={toggleNewBank} />
          <div className="flex gap-3 pt-1">
            <Button type="submit" size="sm" disabled={saving} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">Add Lawyer</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAddMode(false); setNewLawyer(EMPTY_FORM) }}>Cancel</Button>
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Panel Banks</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">LA Fee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">SPA Fee</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">MOT Fee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white">
              {lawyers.map((l) => editingId === l.id ? (
                <tr key={l.id} className="border-b border-[#C9A84C]/20 bg-[#FFF9EC]">
                  <td colSpan={7} className="px-5 py-4">
                    <p className="text-xs font-semibold text-[#0A1628] uppercase tracking-wide mb-3">Edit Lawyer</p>
                    <LawyerForm values={editForm} banks={banks} onChange={patchEditForm} onToggleBank={toggleEditBank} />
                    <div className="flex gap-3 mt-3">
                      <Button size="sm" disabled={saving} onClick={() => handleEditSave(l)} className="bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Save Changes
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#0A1628]">{l.name}</div>
                    <div className="text-xs text-gray-400">{l.firm}</div>
                    {l.phone && <div className="text-xs text-gray-400">{l.phone}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    {l.panel_banks && l.panel_banks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {l.panel_banks.map((bankId) => {
                          const bank = banks.find((b) => b.id === bankId)
                          return bank ? <span key={bankId} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FFF9EC] text-[#9A7020]">{bank.name}</span> : null
                        })}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">External</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.la_fee ? `RM ${l.la_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.spa_fee ? `RM ${l.spa_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5 text-right text-[#0A1628]">{l.mot_fee ? `RM ${l.mot_fee.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${l.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {l.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => startEdit(l)} className="text-gray-400 hover:text-[#0A1628]" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleToggleActive(l)} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                        {l.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(l)} className="text-red-400 hover:text-red-600" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
