'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, FileText, Download, Folder, FolderPlus, ChevronRight, Home } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'

export default function AdminResourcesPage() {
  const [loading, setLoading] = React.useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resources, setResources] = React.useState<any[]>([])
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<{id: string, title: string}[]>([])

  // Modal / Form states
  const [isCreatingFile, setIsCreatingFile] = React.useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = React.useState(false)
  
  const [fileForm, setFileForm] = React.useState({ title: '', category: 'Bank Form', file_url: '', file_name: '', agency_id: 'global' })
  const [folderTitle, setFolderTitle] = React.useState('')
  const [folderAgency, setFolderAgency] = React.useState('global')
  const [saving, setSaving] = React.useState(false)
  const [agencies, setAgencies] = React.useState<any[]>([])
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)

  const loadAgencies = async () => {
    try {
      const res = await fetch('/api/agencies')
      if (res.ok) {
        const json = await res.json()
        setAgencies(json.data || [])
        setIsSuperAdmin(true)
      }
    } catch {
      // Not super admin
    }
  }

  React.useEffect(() => { loadAgencies() }, [])

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

  const handleCreateFile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...fileForm, 
          file_name: fileForm.file_url.split('/').pop() || 'document.pdf',
          parent_id: currentFolderId,
          is_folder: false
        })
      })
      if (res.ok) {
        toast.success('Resource added successfully')
        setIsCreatingFile(false)
        setFileForm({ title: '', category: 'Bank Form', file_url: '', file_name: '', agency_id: 'global' })
        load(currentFolderId)
      } else {
        toast.error('Failed to add resource')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCreateFolder = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: folderTitle, 
          is_folder: true,
          parent_id: currentFolderId,
          agency_id: folderAgency
        })
      })
      if (res.ok) {
        toast.success('Folder created successfully')
        setIsCreatingFolder(false)
        setFolderTitle('')
        load(currentFolderId)
      } else {
        toast.error('Failed to create folder')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Resources</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage documents, PDFs, and spreadsheets</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setIsCreatingFolder(!isCreatingFolder); setIsCreatingFile(false); }}>
             <FolderPlus className="h-4 w-4 mr-2" /> New Folder
          </Button>
          <Button onClick={() => { setIsCreatingFile(!isCreatingFile); setIsCreatingFolder(false); }}>
             <Plus className="h-4 w-4 mr-2" /> Add File
          </Button>
        </div>
      </div>

      {isCreatingFolder && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base text-accent">Create New Folder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Folder Name</label>
              <input type="text" value={folderTitle} onChange={e => setFolderTitle(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm" placeholder="e.g. OCBC Bank" />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium mb-1 block">Assign To Agency</label>
                <select value={folderAgency} onChange={e => setFolderAgency(e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                  <option value="global">All Agencies (Global)</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsCreatingFolder(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder} disabled={saving || !folderTitle} className="bg-accent text-white">
                {saving ? 'Saving...' : 'Create Folder'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isCreatingFile && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-base text-accent">Add New File to Current Folder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Document Title</label>
                <input type="text" value={fileForm.title} onChange={e => setFileForm({...fileForm, title: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" placeholder="e.g. Application Form" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <select value={fileForm.category} onChange={e => setFileForm({...fileForm, category: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm">
                  <option>Bank Form</option>
                  <option>Excel Tool</option>
                  <option>SOP</option>
                  <option>Training</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">File URL</label>
              <input type="url" value={fileForm.file_url} onChange={e => setFileForm({...fileForm, file_url: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm" placeholder="https://..." />
            </div>
            {isSuperAdmin && (
              <div>
                <label className="text-sm font-medium mb-1 block">Assign To Agency</label>
                <select value={fileForm.agency_id} onChange={e => setFileForm({...fileForm, agency_id: e.target.value})} className="w-full h-10 px-3 rounded-md border text-sm">
                  <option value="global">All Agencies (Global)</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsCreatingFile(false)}>Cancel</Button>
              <Button onClick={handleCreateFile} disabled={saving || !fileForm.title || !fileForm.file_url} className="bg-accent text-white">
                {saving ? 'Saving...' : 'Add File'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {loading ? <div>Loading folder contents...</div> : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-2xl">
          <BookOpen className="h-10 w-10 mb-4 opacity-50" />
          <p className="font-medium">This folder is empty</p>
        </div>
      ) : (
        <div className="overflow-hidden border rounded-xl bg-background/50">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Type/Category</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Added</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${r.is_folder ? 'bg-amber-100 text-amber-600' : 'bg-accent/10 border border-accent/20 text-accent'}`}>
                        {r.is_folder ? <Folder className="h-5 w-5 fill-amber-200/50" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        {r.is_folder ? (
                          <button onClick={() => navigateToFolder(r.id, r.title)} className="font-semibold text-foreground hover:text-accent transition-colors text-left">
                            {r.title}
                          </button>
                        ) : (
                          <>
                            <p className="font-semibold text-foreground">{r.title}</p>
                            <p className="text-xs text-muted-foreground truncate w-[200px]">{r.file_name}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!r.is_folder ? (
                      <span className="px-2.5 py-1 rounded-full bg-muted/80 text-xs font-medium text-foreground border border-border/50 inline-block">
                        {r.category}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Folder</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {!r.is_folder && (
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-muted hover:bg-accent hover:text-white text-foreground transition-colors">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
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
