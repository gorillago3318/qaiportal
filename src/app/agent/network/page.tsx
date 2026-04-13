'use client'

import * as React from 'react'
import { GitBranch, Users, DollarSign, FolderOpen, RefreshCw, Link as LinkIcon, Copy } from 'lucide-react'
import { OrgTree } from '@/components/shared/org-tree'
import type { NetworkNode } from '@/components/shared/org-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

export default function AgentNetworkPage() {
  const [nodes, setNodes] = React.useState<NetworkNode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [currentUserId, setCurrentUserId] = React.useState<string>('')
  const [myProfile, setMyProfile] = React.useState<NetworkNode | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/network')
      const json = await res.json()
      if (json.data) {
        setNodes(json.data)
        setCurrentUserId(json.current_user_id)
        const me = (json.data as NetworkNode[]).find((n) => n.id === json.current_user_id)
        setMyProfile(me ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Find downline nodes (all descendants of current user)
  const downlineIds = React.useMemo(() => {
    if (!currentUserId) return new Set<string>()
    const result = new Set<string>()
    const queue = [currentUserId]
    while (queue.length > 0) {
      const parentId = queue.shift()!
      nodes.filter((n) => n.upline_id === parentId).forEach((n) => {
        result.add(n.id)
        queue.push(n.id)
      })
    }
    return result
  }, [nodes, currentUserId])

  const downlineNodes = nodes.filter((n) => downlineIds.has(n.id))
  const directRecruits = nodes.filter((n) => n.upline_id === currentUserId)
  const totalDownlineCommission = downlineNodes.reduce((s, n) => s + n.commission_earned, 0)

  const referralLink = typeof window !== 'undefined' && myProfile?.agent_code
    ? `${window.location.origin}/calculate?ref=${myProfile.agent_code}`
    : null

  function copyReferralLink() {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      toast.success('Referral link copied!')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            My Network
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your downline agents and their performance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Referral link card */}
      {myProfile?.agent_code && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <LinkIcon className="h-4 w-4 text-accent" />
                  <p className="text-sm font-semibold text-foreground">Your Referral Link</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Share this link. Clients who calculate via your link are auto-attributed to you.
                </p>
                <code className="text-xs bg-muted/60 border border-border/50 px-3 py-1.5 rounded-lg block truncate text-foreground">
                  {referralLink}
                </code>
              </div>
              <Button variant="outline" size="sm" onClick={copyReferralLink} className="flex-shrink-0">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-accent" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Direct Recruits</p>
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">{directRecruits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Downline</p>
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">{downlineIds.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Downline Cases</p>
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">
              {downlineNodes.reduce((s, n) => s + n.case_count, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Downline Comm.</p>
            </div>
            <p className="text-lg font-bold font-heading text-foreground">
              {formatCurrency(totalDownlineCommission)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tree — rooted at current user */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-accent" />
            My Downline Tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" style={{ marginLeft: `${(i % 3) * 32}px` }} />
              ))}
            </div>
          ) : (
            <OrgTree
              nodes={nodes}
              currentUserId={currentUserId}
              rootId={currentUserId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
