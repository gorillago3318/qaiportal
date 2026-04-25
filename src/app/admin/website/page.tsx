'use client'

import * as React from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Globe, Save, Upload, ImageIcon, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

// ─── Input helpers ────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#7C7C85] mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full h-10 px-3 rounded-xl border border-[#D8D8DE] bg-white text-sm text-[#111113] placeholder:text-[#9C9CA8] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/25 focus:border-[#D7263D] transition-all'
const textareaCls = 'w-full px-3 py-2.5 rounded-xl border border-[#D8D8DE] bg-white text-sm text-[#111113] placeholder:text-[#9C9CA8] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/25 focus:border-[#D7263D] transition-all resize-none'

export default function AdminWebsitePage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [logoPreview, setLogoPreview] = React.useState<string>('')
  const fileRef = React.useRef<HTMLInputElement>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [content, setContent] = React.useState<any>({
    logo_url: '',
    company_name: 'QuantifyAI',
    tagline: 'artificial intelligence',
    hero: {
      headline: "Your Mortgage is Costing You More Than It Should",
      subheadline: "Malaysia's most trusted AI-powered refinancing specialist. Free analysis. Real savings. Zero upfront fees.",
      cta_text: 'Get Free Analysis',
      cta_url: '/calculate',
    },
    contact: { email: 'hello@quantifyai.me', phone: '+60126181683', address: '147-2, Jalan Radin Bagus, Bandar Baru Sri Petaling, 57000 KL' },
    stats: {
      loans_processed: 'RM 2B+',
      experience: '20+',
      clients: '5000+',
      avg_monthly_savings: 'RM 526',
    },
    savings_section: {
      title: 'Real Clients. Real Savings.',
      subtitle: "These aren't estimates — actual savings from Malaysian homeowners who refinanced through QAI.",
    },
    how_it_works: {
      step1_title: 'Free AI-Powered Analysis',
      step1_desc: 'Share your current loan details. Our AI instantly compares your position against 20+ Malaysian banks.',
      step2_title: 'Custom Savings Strategy',
      step2_desc: 'Your dedicated QAI consultant presents a personalised report showing exactly how much you save.',
      step3_title: 'We Handle Everything — Free',
      step3_desc: 'We manage all paperwork, bank submissions, and legal coordination. Our commission comes from the bank.',
    },
    why_us: {
      title: 'Not just a broker. Your financial ally.',
      body: "Most brokers push you toward whichever bank pays them the most. We built AI to eliminate that bias — and our 20+ years in the Malaysian mortgage market means we know every nuance of the system.",
    },
    cta_section: {
      headline: 'Ready to save RM 526 every month?',
      subtitle: 'Your free analysis takes under 3 minutes. No commitment required.',
    },
  })

  React.useEffect(() => {
    fetch('/api/cms').then(r => r.json()).then(json => {
      if (json.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setContent((prev: any) => ({ ...prev, ...json.data }))
        if (json.data.logo_url) setLogoPreview(json.data.logo_url)
      }
      setLoading(false)
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(section: string, key: string, value: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setContent((prev: any) => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && !Array.isArray(prev[section])
        ? { ...prev[section], [key]: value }
        : value,
    }))
  }

  function setFlat(key: string, value: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setContent((prev: any) => ({ ...prev, [key]: value }))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/cms/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (res.ok && json.url) {
        setLogoPreview(json.url)
        setFlat('logo_url', json.url)
        toast.success('Logo uploaded successfully')
      } else {
        toast.error(json.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })
      if (res.ok) toast.success('Website content saved successfully')
      else toast.error('Failed to save')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-[#D7263D]/30 border-t-[#D7263D] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#0A1628]">Website CMS</h1>
          <p className="text-[#5F5F67] text-sm mt-1">All changes go live immediately after saving.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer" className="text-[#5F5F67]">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Preview site
            </a>
          </Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-[#D7263D] hover:bg-[#B61F33] text-white shadow-[0_2px_12px_rgba(215,38,61,0.25)]">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {/* ── Logo & Branding ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-[#D7263D]" /> Logo &amp; Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-[#D8D8DE] bg-[#f6f6f7] flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <Image src={logoPreview} alt="Logo preview" width={72} height={72} className="object-contain p-1" unoptimized />
                ) : (
                  <span className="text-3xl font-black text-[#D7263D]">Q</span>
                )}
              </div>
              <p className="text-[10px] text-[#7C7C85] mt-1.5 text-center">Current logo</p>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[#D7263D]/30 bg-[#D7263D]/4 text-sm font-medium text-[#D7263D] hover:bg-[#D7263D]/8 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Uploading…</>
                  ) : (
                    <><Upload className="h-4 w-4" /> Upload New Logo</>
                  )}
                </button>
                <p className="text-xs text-[#7C7C85] mt-1.5">PNG, JPG, SVG, or WEBP · Recommended 200×200px or larger</p>
              </div>
              {logoPreview && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg w-fit">
                  <Check className="h-3.5 w-3.5" /> Logo saved
                </div>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-1">
            <Field label="Company Name" hint="Displayed in navbar and footer">
              <input type="text" value={content.company_name || ''} onChange={e => setFlat('company_name', e.target.value)} placeholder="QuantifyAI" className={inputCls} />
            </Field>
            <Field label="Tagline" hint="Small text under company name">
              <input type="text" value={content.tagline || ''} onChange={e => setFlat('tagline', e.target.value)} placeholder="artificial intelligence" className={inputCls} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Hero Section ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-[#D7263D]" /> Hero Section
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Headline">
            <textarea value={content.hero?.headline || ''} onChange={e => set('hero', 'headline', e.target.value)} rows={2} className={textareaCls} placeholder="Your Mortgage is Costing You More Than It Should" />
          </Field>
          <Field label="Subheadline">
            <textarea value={content.hero?.subheadline || ''} onChange={e => set('hero', 'subheadline', e.target.value)} rows={3} className={textareaCls} placeholder="Malaysia's most trusted AI-powered refinancing specialist..." />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="CTA Button Text">
              <input type="text" value={content.hero?.cta_text || ''} onChange={e => set('hero', 'cta_text', e.target.value)} placeholder="Get Free Analysis" className={inputCls} />
            </Field>
            <Field label="CTA Button Link">
              <input type="text" value={content.hero?.cta_url || ''} onChange={e => set('hero', 'cta_url', e.target.value)} placeholder="/calculate" className={inputCls} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key Statistics</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Loans Processed" hint="Shown in hero ticker and About section">
            <input type="text" value={content.stats?.loans_processed || ''} onChange={e => set('stats', 'loans_processed', e.target.value)} placeholder="RM 2B+" className={inputCls} />
          </Field>
          <Field label="Years Experience">
            <input type="text" value={content.stats?.experience || ''} onChange={e => set('stats', 'experience', e.target.value)} placeholder="20+" className={inputCls} />
          </Field>
          <Field label="Satisfied Clients">
            <input type="text" value={content.stats?.clients || ''} onChange={e => set('stats', 'clients', e.target.value)} placeholder="5000+" className={inputCls} />
          </Field>
          <Field label="Avg. Monthly Savings">
            <input type="text" value={content.stats?.avg_monthly_savings || ''} onChange={e => set('stats', 'avg_monthly_savings', e.target.value)} placeholder="RM 526" className={inputCls} />
          </Field>
        </CardContent>
      </Card>

      {/* ── How It Works ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works — 3 Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {[1, 2, 3].map(n => (
            <div key={n} className="space-y-3 pb-5 last:pb-0 border-b last:border-0 border-[#111113]/6">
              <p className="text-xs font-bold text-[#D7263D] uppercase tracking-widest">Step {n}</p>
              <Field label="Title">
                <input type="text" value={content.how_it_works?.[`step${n}_title`] || ''} onChange={e => set('how_it_works', `step${n}_title`, e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea value={content.how_it_works?.[`step${n}_desc`] || ''} onChange={e => set('how_it_works', `step${n}_desc`, e.target.value)} rows={2} className={textareaCls} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Why Us ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why QuantifyAI Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Section Title">
            <input type="text" value={content.why_us?.title || ''} onChange={e => set('why_us', 'title', e.target.value)} placeholder="Not just a broker. Your financial ally." className={inputCls} />
          </Field>
          <Field label="Section Body">
            <textarea value={content.why_us?.body || ''} onChange={e => set('why_us', 'body', e.target.value)} rows={3} className={textareaCls} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final CTA Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Headline">
            <input type="text" value={content.cta_section?.headline || ''} onChange={e => set('cta_section', 'headline', e.target.value)} placeholder="Ready to save RM 526 every month?" className={inputCls} />
          </Field>
          <Field label="Subtitle">
            <input type="text" value={content.cta_section?.subtitle || ''} onChange={e => set('cta_section', 'subtitle', e.target.value)} placeholder="Your free analysis takes under 3 minutes." className={inputCls} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Contact ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Email Address">
              <input type="email" value={content.contact?.email || ''} onChange={e => set('contact', 'email', e.target.value)} placeholder="hello@quantifyai.me" className={inputCls} />
            </Field>
            <Field label="Phone / WhatsApp">
              <input type="text" value={content.contact?.phone || ''} onChange={e => set('contact', 'phone', e.target.value)} placeholder="+60126181683" className={inputCls} />
            </Field>
          </div>
          <Field label="Office Address">
            <input type="text" value={content.contact?.address || ''} onChange={e => set('contact', 'address', e.target.value)} placeholder="147-2, Jalan Radin Bagus..." className={inputCls} />
          </Field>
        </CardContent>
      </Card>

      {/* Sticky save at bottom */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving}
          className="bg-[#D7263D] hover:bg-[#B61F33] text-white shadow-[0_4px_20px_rgba(215,38,61,0.3)] px-8">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  )
}
