'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, Plus, Eye, Calendar, Target } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function AdminCampaignsPage() {
  const [loading, setLoading] = React.useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaigns, setCampaigns] = React.useState<any[]>([])
  const [isCreating, setIsCreating] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  
  const [form, setForm] = React.useState({ 
    title: '', body: '', is_published: true,
    target_type: '', target_value: '',
    target_start_date: '', target_end_date: '',
    target_requires_panel_lawyer: false
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      const json = await res.json()
      if (json.data) setCampaigns(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const payload = { ...form, target_type: form.target_type || undefined }
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        toast.success('Campaign created successfully')
        setIsCreating(false)
        setForm({ title: '', body: '', is_published: true, target_type: '', target_value: '', target_start_date: '', target_end_date: '', target_requires_panel_lawyer: false })
        load()
      } else {
        toast.error('Failed to create campaign')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Campaigns & Tracking</h1>
          <p className="text-muted-foreground text-sm mt-1">Broadcast announcements and track sales targets</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "outline" : "default"}>
          {isCreating ? 'Cancel' : <><Plus className="h-4 w-4 mr-2" /> New Campaign</>}
        </Button>
      </div>

      {isCreating && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base text-accent flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Create New Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" placeholder="e.g. Q3 Sales Race" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Message Body</label>
                <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} className="w-full p-3 rounded-md border text-sm h-24" placeholder="Write your announcement or incentive details here..." />
              </div>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-emerald-500" /> Goal / Tracking (Optional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Target Type</label>
                  <select value={form.target_type} onChange={e => setForm({...form, target_type: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm">
                    <option value="">None (Announcement Only)</option>
                    <option value="volume">Loan Volume (RM)</option>
                    <option value="cases">Number of Cases</option>
                  </select>
                </div>
                {form.target_type && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Target Value</label>
                    <input type="number" value={form.target_value} onChange={e => setForm({...form, target_value: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" placeholder={form.target_type === 'volume' ? 'e.g. 5000000' : 'e.g. 10'} />
                  </div>
                )}
              </div>
              {form.target_type && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                    <input type="date" value={form.target_start_date} onChange={e => setForm({...form, target_start_date: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Date</label>
                    <input type="date" value={form.target_end_date} onChange={e => setForm({...form, target_end_date: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input type="checkbox" checked={form.target_requires_panel_lawyer} onChange={e => setForm({...form, target_requires_panel_lawyer: e.target.checked})} className="accent-accent w-4 h-4" />
                      Requires our Appointed Panel Lawyer to be eligible
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} className="accent-accent w-4 h-4" />
                Publish immediately
              </label>
              <Button onClick={handleCreate} disabled={saving || !form.title || !form.body}>
                {saving ? 'Saving...' : 'Broadcast Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <div>Loading...</div> : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
          <Megaphone className="h-10 w-10 mb-4 opacity-50" />
          <p className="font-medium">No campaigns yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map(c => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold leading-tight">{c.title}</CardTitle>
                    {c.target_type && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        <Target className="h-3 w-3" /> 
                        Target: {c.target_type === 'volume' ? formatCurrency(c.target_value) : `${c.target_value} Cases`}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${c.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.is_published ? 'Live' : 'Draft'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{c.body}</p>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(c.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {c.campaign_reads?.length || 0} reads
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
