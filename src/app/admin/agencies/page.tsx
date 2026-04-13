"use client"

import * as React from "react"
import { Building2, Plus, X, Globe, Users, FolderOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type AgencyRow = {
  id: string
  name: string
  slug: string
  code_prefix: string
  custom_domain: string | null
  primary_color: string
  accent_color: string
  is_active: boolean
  created_at: string
  agent_count: number
  case_count: number
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function prefixify(name: string) {
  // Take first letters of each word, up to 4 chars
  return name.split(/\s+/).map((w) => w[0] || '').join('').toUpperCase().slice(0, 4)
}

export default function AdminAgenciesPage() {
  const [agencies, setAgencies] = React.useState<AgencyRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showModal, setShowModal] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState({
    name: "",
    slug: "",
    code_prefix: "",
    primary_color: "#0A1628",
    accent_color: "#C9A84C",
    custom_domain: "",
  })

  const fetchAgencies = React.useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/agencies")
    if (res.ok) {
      const json = await res.json()
      setAgencies(json.data || [])
    } else if (res.status === 403) {
      toast.error("Super admin access required")
    }
    setLoading(false)
  }, [])

  React.useEffect(() => { fetchAgencies() }, [fetchAgencies])

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: slugify(name),
      code_prefix: prefixify(name),
    }))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.slug || !form.code_prefix) {
      toast.error("Name, slug, and prefix are required")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success("Agency created")
      setShowModal(false)
      setForm({ name: "", slug: "", code_prefix: "", primary_color: "#0A1628", accent_color: "#C9A84C", custom_domain: "" })
      fetchAgencies()
    } else {
      const json = await res.json()
      toast.error(json.error || "Failed to create agency")
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Agencies</h1>
          <p className="text-gray-500 text-sm mt-1">{agencies.length} agenc{agencies.length !== 1 ? "ies" : "y"} on the platform</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-[#C9A84C] hover:bg-[#b8943d] text-white">
          <Plus className="h-4 w-4 mr-1.5" />
          New Agency
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : agencies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] mb-1">No agencies yet</h3>
            <p className="text-gray-400 text-sm">Create the first white-label agency</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agencies.map((agency) => (
            <div key={agency.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Agency color bar */}
              <div className="h-2" style={{ background: `linear-gradient(90deg, ${agency.primary_color}, ${agency.accent_color})` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: agency.primary_color }}
                    >
                      <span className="font-bold text-sm" style={{ color: agency.accent_color }}>
                        {agency.code_prefix.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <div className="font-heading font-bold text-[#0A1628]">{agency.name}</div>
                      <div className="text-xs text-gray-400 font-mono">{agency.code_prefix}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${agency.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {agency.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-0.5">
                      <Users className="h-3 w-3" /> Agents
                    </div>
                    <div className="font-bold text-[#0A1628] text-lg font-heading">{agency.agent_count}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-0.5">
                      <FolderOpen className="h-3 w-3" /> Cases
                    </div>
                    <div className="font-bold text-[#0A1628] text-lg font-heading">{agency.case_count}</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3" />
                    <span>{agency.custom_domain || `${agency.slug}.quantifyai.me`}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-4 rounded" style={{ backgroundColor: agency.primary_color }} />
                    <div className="h-4 w-4 rounded" style={{ backgroundColor: agency.accent_color }} />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">{agency.slug}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Agency Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold text-[#0A1628]">New Agency</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Agency Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. ABC Realty Group"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="abc-realty"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.slug}.quantifyai.me</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Agent Code Prefix *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={form.code_prefix}
                    onChange={(e) => setForm({ ...form, code_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                    placeholder="ABC"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                  <p className="text-xs text-gray-400 mt-1">e.g. ABC0001</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Custom Domain (optional)</label>
                <input
                  type="text"
                  value={form.custom_domain}
                  onChange={(e) => setForm({ ...form, custom_domain: e.target.value })}
                  placeholder="portal.abcrealty.com"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="h-10 w-12 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={form.primary_color}
                      onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0A1628] mb-1.5">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.accent_color}
                      onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                      className="h-10 w-12 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={form.accent_color}
                      onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Preview</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.primary_color }}>
                    <span className="text-xs font-bold" style={{ color: form.accent_color }}>{form.code_prefix.slice(0, 2) || "AB"}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: form.primary_color }}>{form.name || "Agency Name"}</div>
                    <div className="text-xs" style={{ color: form.accent_color }}>{form.code_prefix || "ABC"}0001</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button type="submit" disabled={submitting} className="flex-1 bg-[#0A1628] text-white hover:bg-[#0d1f38]">
                  {submitting ? "Creating…" : "Create Agency"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
