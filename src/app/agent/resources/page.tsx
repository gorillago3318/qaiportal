'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, FileText, Download, Folder, ChevronRight, Home } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function AgentResourcesPage() {
  const [loading, setLoading] = React.useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resources, setResources] = React.useState<any[]>([])
  
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<{id: string, title: string}[]>([])

  const load = React.useCallback(async (parentId: string | null) => {
    setLoading(true)
    try {
      const qs = parentId ? `?parent_id=${parentId}` : ''
      const res = await fetch(`/api/resources${qs}`)
      const json = await res.json()
      if (json.data) setResources(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load(currentFolderId) }, [load, currentFolderId])

  const navigateToFolder = (id: string, title: string) => {
    setCurrentFolderId(id)
    setBreadcrumbs(prev => [...prev, { id, title }])
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null)
      setBreadcrumbs([])
    } else {
      const newCrumbs = breadcrumbs.slice(0, index + 1)
      setBreadcrumbs(newCrumbs)
      setCurrentFolderId(newCrumbs[newCrumbs.length - 1].id)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Resource Library</h1>
        <p className="text-muted-foreground text-sm mt-1">Access bank forms, tools, and SOPs directly</p>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm font-medium bg-background border px-4 py-3 rounded-xl shadow-sm">
        <button onClick={() => navigateToBreadcrumb(-1)} className={`flex items-center gap-1.5 transition-colors ${currentFolderId === null ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
          <Home className="h-4 w-4" /> Root
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <button onClick={() => navigateToBreadcrumb(idx)} className={`transition-colors truncate max-w-[150px] ${idx === breadcrumbs.length - 1 ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
              {crumb.title}
            </button>
          </React.Fragment>
        ))}
      </div>

      {loading ? <div>Loading folder...</div> : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground border border-dashed rounded-2xl bg-muted/20">
          <BookOpen className="h-10 w-10 mb-4 opacity-50" />
          <p className="font-semibold text-foreground">This folder is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(r => {
            if (r.is_folder) {
              return (
                <button key={r.id} onClick={() => navigateToFolder(r.id, r.title)} className="text-left group transition-all">
                  <Card className="hover:border-amber-400/50 hover:bg-amber-50/50 bg-background/80 transition-colors h-full">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                        <Folder className="h-6 w-6 fill-amber-200/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground leading-tight mb-1">{r.title}</p>
                        <p className="text-xs text-muted-foreground">Folder</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:text-amber-600 transition-all group-hover:translate-x-1" />
                    </CardContent>
                  </Card>
                </button>
              )
            } else {
              return (
                <Card key={r.id} className="group hover:border-accent/40 bg-background/80 hover:bg-accent/5 transition-colors h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="h-10 w-10 shrink-0 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground leading-tight mb-1">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate" title={r.file_name}>{r.file_name}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{r.category}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                      </div>
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors bg-accent/10 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 focus:ring-2">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )
            }
          })}
        </div>
      )}
    </div>
  )
}
