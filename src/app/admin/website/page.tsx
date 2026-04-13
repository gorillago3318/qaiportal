'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Globe, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminWebsitePage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content, setContent] = React.useState<any>({
    hero: { headline: '', subheadline: '', cta_text: '', cta_url: '' },
    about: { title: '', body: '' },
    contact: { email: '', phone: '', address: '' }
  })

  React.useEffect(() => {
    fetch('/api/cms').then(r => r.json()).then(json => {
      if (json.data) setContent((prev: any) => ({ ...prev, ...json.data }))
      setLoading(false)
    })
  }, [])

  const updateSection = (section: string, key: string, value: string) => {
    setContent((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      })
      if (res.ok) toast.success('Website content updated successfully')
      else toast.error('Failed to update content')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Website CMS</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage public landing page content</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-accent text-white">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-accent" /> Hero Section
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Headline</label>
              <input type="text" value={content.hero.headline} onChange={e => updateSection('hero', 'headline', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subheadline</label>
              <textarea value={content.hero.subheadline} onChange={e => updateSection('hero', 'subheadline', e.target.value)} className="w-full p-3 rounded-md border text-sm h-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">CTA Text</label>
                <input type="text" value={content.hero.cta_text} onChange={e => updateSection('hero', 'cta_text', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">CTA URL</label>
                <input type="text" value={content.hero.cta_url} onChange={e => updateSection('hero', 'cta_url', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <input type="text" value={content.about.title} onChange={e => updateSection('about', 'title', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Body Text</label>
              <textarea value={content.about.body} onChange={e => updateSection('about', 'body', e.target.value)} className="w-full p-3 rounded-md border text-sm h-32" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 grid sm:grid-cols-2 gap-4">
            <div className="mt-4">
              <label className="text-sm font-medium mb-1 block">Email</label>
              <input type="email" value={content.contact.email} onChange={e => updateSection('contact', 'email', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <input type="text" value={content.contact.phone} onChange={e => updateSection('contact', 'phone', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1 block">Address</label>
              <input type="text" value={content.contact.address} onChange={e => updateSection('contact', 'address', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
