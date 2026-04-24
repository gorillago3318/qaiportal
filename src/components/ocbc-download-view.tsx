'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, CheckCircle2, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OCBCDownloadViewProps {
  caseData: { id?: string; case_code?: string; [k: string]: unknown }
  onClose?: () => void
}

/**
 * OCBC Render to PDF — minimal modal.
 * Calls /api/generate-pdf which overlays form data onto the portrait OCBC
 * template server-side using pdf-lib, returns base64 PDF, triggers download.
 *
 * No client-side coordinate overlays, no CSS rotation — the PDF is
 * byte-identical across every viewer/printer.
 */
export function OCBCDownloadView({ caseData, onClose }: OCBCDownloadViewProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [filename, setFilename] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleGenerate = async (debug?: 'anchors') => {
    if (!caseData.id) {
      setState('error')
      setErrorMsg('Case must be saved as a draft before generating the PDF.')
      return
    }
    setState('generating')
    setErrorMsg('')
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caseData.id, ...(debug ? { debug } : {}) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const parts = [err.error, err.detail].filter(Boolean)
        throw new Error(parts.length ? parts.join(' — ') : `PDF generation failed (HTTP ${res.status})`)
      }
      const { pdf: base64, filename: fname } = await res.json()

      // Decode base64 → Blob → download
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = fname || `OCBC_Application_${caseData.case_code || 'draft'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setFilename(a.download)
      setState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setErrorMsg(msg)
      setState('error')
    }
  }

  if (!mounted) return null

  const ui = (
    <div className="fixed inset-0 z-[2147483647] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">OCBC Application Form</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Generates the official OCBC Al-Amin application PDF with your form data
          overlaid onto the bank template — byte-identical on every printer.
        </p>
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900">
          <div className="font-semibold mb-1">When printing:</div>
          <ul className="space-y-0.5 list-disc list-inside text-amber-800">
            <li>Set <b>Size</b> → <b>Actual size</b> (never &quot;Fit to page&quot;)</li>
            <li>Set <b>Scale</b> → <b>100%</b></li>
            <li>Page setup → <b>No margins</b> — the OCBC template already has margins</li>
          </ul>
        </div>

        {state === 'idle' && (
          <div className="space-y-2">
            <Button
              onClick={() => handleGenerate()}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate &amp; Download PDF
            </Button>
            <Button
              onClick={() => handleGenerate('anchors')}
              variant="outline"
              className="w-full text-xs"
            >
              Debug: Download anchor calibration PDF
            </Button>
          </div>
        )}

        {state === 'generating' && (
          <Button disabled className="w-full">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating…
          </Button>
        )}

        {state === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-emerald-900">Downloaded</div>
                <div className="text-emerald-700 break-all">{filename}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleGenerate()}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Re-generate
              </Button>
              {onClose && (
                <Button onClick={onClose} className="flex-1">Done</Button>
              )}
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-900">
              <div className="font-medium mb-0.5">Generation failed</div>
              <div className="text-red-700">{errorMsg}</div>
            </div>
            <Button
              onClick={() => handleGenerate()}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Try again
            </Button>
          </div>
        )}

        <p className="mt-5 text-xs text-gray-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 font-mono">Esc</kbd> to close.
          Field positions are derived automatically from the OCBC template — if
          anything lands in the wrong place, name the field and the label it
          should sit next to.
        </p>
      </div>
    </div>
  )

  return createPortal(ui, document.body)
}
