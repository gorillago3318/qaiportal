'use client'

import dynamic from 'next/dynamic'

// pdfjs-dist uses Object.defineProperty in a way that breaks webpack's
// server-side bundling. Loading the whole client lazily (ssr: false) keeps
// pdfjs out of the Node bundle entirely and fixes the runtime error.
const ConvertFormsClient = dynamic(() => import('./ConvertFormsClient'), {
  ssr: false,
  loading: () => (
    <div className="p-8 text-sm text-gray-500">Loading PDF renderer…</div>
  ),
})

export default function ConvertFormsPage() {
  return <ConvertFormsClient />
}
