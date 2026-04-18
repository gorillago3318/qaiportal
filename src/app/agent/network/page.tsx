'use client'

import * as React from 'react'
import { GitBranch, Users, DollarSign, FolderOpen, RefreshCw, Link as LinkIcon, Copy } from 'lucide-react'
import { OrgTree } from '@/components/shared/org-tree'
import type { NetworkNode, Period } from '@/components/shared/org-tree'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

function getPeriodStart(period: Period): string | null {
  if (period === 'lifetime') return null
  const now = new Date()
  if (period === 'yearly')  return new Date(now.getFullYear(), 0, 1).toISOString()
  if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return null
}

/** Re-compute commission_earned for each node based on raw_commissions + period */
function applyPeriod(nodes: NetworkNode[], period: Period): NetworkNode[] {
  const start = getPeriodStart(period)
  if (!start) return nodes // lifetime — keep as-is
  return nodes.map((n) => ({
    ...n,
    commission_earned: (n.raw_commissions ?? [])
      .filter((c) => c.created_at >= start)
      .reduce((s, c) => s + c.amount, 0),
  }))
}

export default function AgentNetworkPage() {
  const [rawNodes, setRawNodes]       = React.useState<NetworkNode[]>([])
  const [loading, setLoading]         = React.useState(true)
  const [currentUserId, setCurrentUserId] = React.useState<string>('')
  const [myProfile, setMyProfile]     = React.useState<NetworkNode | null>(null)
  const [period, setPeriod]           = React.useState<Period>('lifetime')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/network')
      const json = await res.json()
      if (json.error) {
        console.error('[network] API error:', json.error)
        toast.error('Could not load network: ' + json.error)
        return
      }
      if (json.data) {
        setRawNodes(json.data as NetworkNode[])
        setCurrentUserId(json.current_user_id ?? '')
        const me = (json.data as NetworkNode[]).find((n) => n.id === json.current_user_id)
        setMyProfile(me ?? null)
      }
    } catch (err) {
      console.error('[network] fetch failed:', err)
      toast.error('Network request failed — check console')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  // Apply period filter to get display nodes
  const nodes = React.useMemo(() => applyPeriod(rawNodes, period), [rawNodes, period])

  // Derive downline stats from filtered nodes
  const downlineIds = React.useMemo(() => {
    if (!currentUserId) return new Set<string>()
    const result = new Set<string>()
    const queue  = [currentUserId]
    while (queue.length > 0) {
      const parentId = queue.shift()!
      nodes.filter((n) => n.upline_id === parentId).forEach((n) => {
        result.add(n.id)
        queue.push(n.id)
      })
    }
    return result
  }, [nodes, currentUserId])

  const downlineNodes       = nodes.filter((n) => downlineIds.has(n.id))
  const directRecruits      = nodes.filter((n) => n.upline_id === currentUserId)
  const myNode              = nodes.find((n) => n.id === currentUserId)
  const ownCommission       = myNode?.commission_earned ?? 0
  const downlineCommission  = downlineNodes.reduce((s, n) => s + n.commission_earned, 0)
  const totalGroupCommission = ownCommission + downlineCommission
  const totalGroupCases     = (myNode?.case_count ?? 0) + downlineNodes.reduce((s, n) => s + n.case_count, 0)

  const referralLink = typeof window !== 'undefined' && myProfile?.agent_code
    ? `${window.location.origin}/calculate?ref=${myProfile.agent_code}`
    : null

  const periodLabel = period === 'yearly' ? 'This Year' : period === 'monthly' ? 'This Month' : 'All Time'

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">My Network</h1>
          <p className="text-muted-foreground text-sm mt-1">Your downline agents and their performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Period toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit border border-border/40">
        {(['lifetime', 'yearly', 'monthly'] as Period[]).map((p) => {
          const labels: Record<Period, string> = { lifetime: 'All Time', yearly: 'This Year', monthly: 'This Month' }
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {labels[p]}
            </button>
          )
        })}
      </div>

      {/* Referral link */}
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
                  Share this link — clients who calculate via it are auto-attributed to you.
                </p>
                <code className="text-xs bg-muted/60 border border-border/50 px-3 py-1.5 rounded-lg block truncate text-foreground">
                  {referralLink}
                </code>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                if (referralLink) { navigator.clipboard.writeText(referralLink); toast.success('Referral link copied!') }
              }} className="flex-shrink-0">
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats — filtered by period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-accent" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Direct Recruits</p>
            </div>
            <p className="text-2xl font-bold font-heading">{directRecruits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Downline</p>
            </div>
            <p className="text-2xl font-bold font-heading">{downlineIds.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FolderOpen className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Group Cases</p>
            </div>
            <p className="text-2xl font-bold font-heading">{totalGroupCases}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Group Comm.</p>
            </div>
            <p className="text-lg font-bold font-heading">{formatCurrency(totalGroupCommission)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{periodLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-accent" />
            Network Tree
            <span className="ml-auto text-xs font-normal text-muted-foreground">Hover a node to see group stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted/50 rounded-xl animate-pulse"
                  style={{ marginLeft: `${(i % 3) * 32}px` }}
                />
              ))}
            </div>
          ) : (
            <OrgTree
              nodes={nodes}
              currentUserId={currentUserId}
              rootId={currentUserId}
              period={period}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
