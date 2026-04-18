'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Users, Search, RefreshCw } from 'lucide-react'
import { OrgTree, buildTree } from '@/components/shared/org-tree'
import type { NetworkNode } from '@/components/shared/org-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { USER_ROLE_LABELS } from '@/types/database'
import type { UserRole } from '@/types/database'

export default function AdminNetworkPage() {
  const [nodes, setNodes] = React.useState<NetworkNode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [currentUserId, setCurrentUserId] = React.useState<string>('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/network')
      const json = await res.json()
      if (json.error) {
        console.error('[admin/network] API error:', json.error)
        return
      }
      if (json.data) {
        setNodes(json.data)
        setCurrentUserId(json.current_user_id ?? '')
      }
    } catch (err) {
      console.error('[admin/network] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Stats
  const roleBreakdown = React.useMemo(() => {
    const counts: Partial<Record<UserRole, number>> = {}
    nodes.forEach((n) => {
      counts[n.role] = (counts[n.role] ?? 0) + 1
    })
    return counts
  }, [nodes])

  const totalCases = nodes.reduce((s, n) => s + n.case_count, 0)
  const totalCommissions = nodes.reduce((s, n) => s + n.commission_earned, 0)

  // Filter search
  const filteredNodes = React.useMemo(() => {
    if (!search.trim()) return nodes
    const q = search.toLowerCase()
    return nodes.filter(
      (n) =>
        n.full_name.toLowerCase().includes(q) ||
        n.agent_code?.toLowerCase().includes(q) ||
        n.email.toLowerCase().includes(q)
    )
  }, [nodes, search])

  // When searching, show flat list instead of tree
  const isSearching = search.trim().length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Network Tree
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organisation hierarchy across your agency
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Agents</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{nodes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cases</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{totalCases}</p>
          </CardContent>
        </Card>
        {Object.entries(roleBreakdown)
          .filter(([role]) => !['admin', 'super_admin'].includes(role))
          .slice(0, 2)
          .map(([role, count]) => (
            <Card key={role}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {USER_ROLE_LABELS[role as UserRole]}
                </p>
                <p className="text-2xl font-bold font-heading text-foreground mt-1">{count}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Role breakdown pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(roleBreakdown).map(([role, count]) => (
          <span key={role} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted/60 text-muted-foreground border border-border/40">
            <Users className="h-3 w-3" />
            {USER_ROLE_LABELS[role as UserRole]} <span className="font-bold text-foreground">{count}</span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, code, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 text-sm rounded-xl border border-border/60 bg-background/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-accent" />
            {isSearching ? `Search results (${filteredNodes.length})` : 'Organisation Tree'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" style={{ marginLeft: `${(i % 3) * 32}px` }} />
              ))}
            </div>
          ) : isSearching ? (
            // Flat search results list
            <div className="space-y-2">
              {filteredNodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No agents match your search</p>
              ) : (
                filteredNodes.map((node) => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/80"
                  >
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold text-sm text-muted-foreground flex-shrink-0">
                      {node.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{node.full_name}</p>
                      <p className="text-xs text-muted-foreground">{node.email}</p>
                    </div>
                    {node.agent_code && (
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{node.agent_code}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{node.case_count} cases</span>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            <OrgTree
              nodes={nodes}
              currentUserId={currentUserId}
              rootId={null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
