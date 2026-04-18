'use client'

// pdfjs-dist is loaded at runtime from CDN via a Function-wrapped import so
// webpack / Turbopack never see the specifier and cannot choke on the ESM build.

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  CheckCircle, Loader2, AlertCircle, ImageIcon,
  Upload, FileText, RefreshCw, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const PDFJS_VERSION = '5.4.296'
const PDFJS_CDN     = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`
const WORKER_CDN    = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`

const BANKS = [
  { id: 'hlb',  label: 'Hong Leong Bank', totalPages: 7 },
  { id: 'ocbc', label: 'OCBC Bank',       totalPages: 6 },
]

const RENDER_WIDTH = 1588   // 2 × A4 @ 96 dpi

interface PageStatus {
  status: 'pending' | 'rendering' | 'uploading' | 'done' | 'error'
  error?: string
}

interface PdfInfo {
  exists: boolean
  fileName?: string
  size?: number
  modifiedAt?: string
}

// ── pdfjs CDN loader (cached after first call) ────────────────────────────────
let pdfjsPromise: Promise<any> | null = null
function getPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (Function('u', 'return import(u)') as any)(PDFJS_CDN).then(
      (lib: any) => { lib.GlobalWorkerOptions.workerSrc = WORKER_CDN; return lib }
    ) as Promise<any>
  }
  return pdfjsPromise as Promise<any>
}

// ── Render one PDF page to a canvas ──────────────────────────────────────────
async function renderPage(pdfDoc: any, pageNum: number, widthPx: number): Promise<HTMLCanvasElement> {
  const page     = await pdfDoc.getPage(pageNum)
  const vp0      = page.getViewport({ scale: 1 })
  const vp       = page.getViewport({ scale: widthPx / vp0.width })
  const canvas   = document.createElement('canvas')
  canvas.width   = Math.round(vp.width)
  canvas.height  = Math.round(vp.height)
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
  return canvas
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ConvertFormsClient() {
  const [selectedBank, setSelectedBank]   = useState('hlb')
  const [pdfInfo, setPdfInfo]             = useState<PdfInfo | null>(null)
  const [pageStatuses, setPageStatuses]   = useState<Record<number, PageStatus>>({})
  const [existingPngs, setExistingPngs]   = useState<number[]>([])
  const [converting, setConverting]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState<string | null>(null)
  const runningRef  = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bank = BANKS.find(b => b.id === selectedBank)!

  // Fetch PDF metadata + existing PNGs whenever bank changes
  const refresh = useCallback(() => {
    fetch(`/api/admin/upload-form-pdf?bank=${selectedBank}`)
      .then(r => r.json()).then(setPdfInfo).catch(() => setPdfInfo({ exists: false }))

    fetch(`/api/admin/save-form-image?bank=${selectedBank}`)
      .then(r => r.json()).then(d => setExistingPngs(d.pages || [])).catch(() => {})
  }, [selectedBank])

  useEffect(() => {
    setPdfInfo(null)
    setExistingPngs([])
    setPageStatuses({})
    setConverting(false)
    refresh()
  }, [selectedBank, refresh])

  const setStatus = useCallback(
    (page: number, s: PageStatus) => setPageStatuses(prev => ({ ...prev, [page]: s })), []
  )

  // ── Upload a new PDF ────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('bank', selectedBank)
      fd.append('file', file)
      const res = await fetch('/api/admin/upload-form-pdf', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setPdfInfo({ exists: true, fileName: json.fileName, size: json.size, modifiedAt: json.updatedAt })
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }, [selectedBank])

  // ── Convert PDF pages → PNG ─────────────────────────────────────────────────
  const startConversion = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setConverting(true)

    const initial: Record<number, PageStatus> = {}
    for (let i = 1; i <= bank.totalPages; i++) initial[i] = { status: 'pending' }
    setPageStatuses(initial)

    try {
      const pdfjs   = await getPdfJs()
      const pdfResp = await fetch(`/api/form-pdf?bank=${selectedBank}`)
      if (!pdfResp.ok) throw new Error(`Cannot load PDF (${pdfResp.status}) — upload the form first.`)

      const pdfDoc = await pdfjs.getDocument({ data: await pdfResp.arrayBuffer() }).promise

      for (let pg = 1; pg <= bank.totalPages; pg++) {
        if (!runningRef.current) break
        setStatus(pg, { status: 'rendering' })
        try {
          const canvas  = await renderPage(pdfDoc, pg, RENDER_WIDTH)
          setStatus(pg, { status: 'uploading' })
          const res = await fetch('/api/admin/save-form-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bank: selectedBank, page: pg, data: canvas.toDataURL('image/png') }),
          })
          if (!res.ok) throw new Error(`Save failed (${res.status})`)
          setStatus(pg, { status: 'done' })
        } catch (e: any) {
          setStatus(pg, { status: 'error', error: e.message })
        }
      }
    } catch (e: any) {
      for (let i = 1; i <= bank.totalPages; i++)
        setStatus(i, { status: 'error', error: e.message })
    } finally {
      runningRef.current = false
      refresh()
    }
  }, [bank, selectedBank, setStatus, refresh])

  const statuses  = Object.values(pageStatuses)
  const allDone   = converting && statuses.length > 0 && statuses.every(s => s.status === 'done' || s.status === 'error')
  const doneCount = statuses.filter(s => s.status === 'done').length
  const pngsDone  = existingPngs.length === bank.totalPages

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bank Form Image Setup</h1>
        <p className="text-gray-500 text-sm mt-1">
          Each bank&apos;s application form PDF must be converted to PNG images once.
          Those images are used as the background when agents preview and print a filled-in form.
        </p>
      </div>

      {/* ── Bank tabs ── */}
      <div className="flex gap-2">
        {BANKS.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBank(b.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              selectedBank === b.id
                ? 'border-[#C9A84C] bg-[#FFF9EC] text-[#0A1628]'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* ── Step 1: Upload PDF ── */}
      <section className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#0A1628] text-white text-xs flex items-center justify-center font-bold">1</span>
          <h2 className="font-semibold text-gray-900">Upload {bank.label} Application Form PDF</h2>
        </div>

        {/* Current file status */}
        {pdfInfo === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking…
          </div>
        ) : pdfInfo.exists ? (
          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <FileText className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-900">{pdfInfo.fileName}</p>
              <p className="text-green-700 text-xs mt-0.5">
                {pdfInfo.size ? `${(pdfInfo.size / 1024).toFixed(0)} KB` : ''}{' '}
                {pdfInfo.modifiedAt ? `— last updated ${new Date(pdfInfo.modifiedAt).toLocaleString()}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            No PDF found for {bank.label}. Upload the bank&apos;s official application form PDF below.
          </div>
        )}

        {/* Upload area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) handleUpload(f)
          }}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#C9A84C] hover:bg-[#FFFDF5] transition-colors"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
              <span className="text-sm">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Upload className="w-6 h-6" />
              <span className="text-sm font-medium">
                {pdfInfo?.exists ? 'Replace PDF — drag & drop or click to browse' : 'Upload PDF — drag & drop or click to browse'}
              </span>
              <span className="text-xs text-gray-400">PDF only · no size limit</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
        />
        {uploadError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> {uploadError}
          </p>
        )}
      </section>

      {/* ── Step 2: Convert to PNG ── */}
      <section className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#0A1628] text-white text-xs flex items-center justify-center font-bold">2</span>
          <h2 className="font-semibold text-gray-900">Convert to PNG Images</h2>
        </div>

        {/* PNG status */}
        {existingPngs.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            No PNGs generated yet. Click Convert below.
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            {pngsDone
              ? `All ${bank.totalPages} pages converted ✅ — agents can now preview & print ${bank.label} forms.`
              : `${existingPngs.length} / ${bank.totalPages} pages exist (pages ${existingPngs.join(', ')}). Re-run to regenerate all.`}
          </div>
        )}

        {/* Progress during conversion */}
        {converting && statuses.length > 0 && (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              {allDone
                ? `Done — ${doneCount} / ${bank.totalPages} pages saved`
                : `Converting… ${doneCount} / ${bank.totalPages}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: bank.totalPages }, (_, i) => i + 1).map(pg => {
                const st = pageStatuses[pg]
                return (
                  <div key={pg} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-md">
                    {st?.status === 'done'      && <CheckCircle className="w-3 h-3 text-green-600" />}
                    {(st?.status === 'rendering' || st?.status === 'uploading') && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                    {st?.status === 'error'     && <AlertCircle className="w-3 h-3 text-red-500" />}
                    {st?.status === 'pending'   && <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />}
                    <span className={st?.status === 'done' ? 'text-green-700' : st?.status === 'error' ? 'text-red-600' : 'text-gray-600'}>
                      pg {pg}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={startConversion}
            disabled={!pdfInfo?.exists || (converting && !allDone)}
            className="bg-[#0A1628] hover:bg-[#1a2d4a] text-white"
          >
            {converting && !allDone ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting…</>
            ) : pngsDone ? (
              <><RefreshCw className="w-4 h-4 mr-2" /> Re-convert All Pages</>
            ) : (
              <><ImageIcon className="w-4 h-4 mr-2" /> Convert to PNG</>
            )}
          </Button>
          {!pdfInfo?.exists && (
            <p className="text-sm text-gray-400 self-center">Upload a PDF first</p>
          )}
        </div>
      </section>

      {/* ── How this works ── */}
      <section className="border rounded-xl p-5 bg-gray-50 space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2 font-medium text-gray-800">
          <Info className="w-4 h-4" />
          How this works
        </div>
        <ul className="list-disc ml-5 space-y-1">
          <li>Each bank has one official PDF form stored in the <code className="bg-white px-1 rounded border text-xs">Forms/</code> folder on the server.</li>
          <li>Step 1 lets you upload/replace that PDF directly from the browser — no server access needed.</li>
          <li>Step 2 renders every page to a high-resolution PNG and saves them to <code className="bg-white px-1 rounded border text-xs">public/forms/{selectedBank}/</code>.</li>
          <li>When agents click <strong>Render to Form</strong> on a case, those PNGs are loaded as the form background with the applicant&apos;s data overlaid on top.</li>
          <li><strong>When the bank updates their form:</strong> upload the new PDF here → click Convert → done. No deployment needed.</li>
          <li>Adding a new bank requires a developer to set up the field coordinates in code first, then it will appear here.</li>
        </ul>
      </section>
    </div>
  )
}
