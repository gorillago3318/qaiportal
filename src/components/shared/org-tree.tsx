'use client'

import * as React from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronRight, User, FolderOpen, DollarSign, Crown, Users, TrendingUp } from 'lucide-react'
import type { UserRole } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────

export interface NetworkNode {
  id: string
  full_name: string
  email: string
  role: UserRole
  agent_code: string | null
  upline_id: string | null
  is_active: boolean
  case_count: number
  commission_earned: number
  raw_commissions?: { amount: number; created_at: string }[]
  is_root?: boolean
  // Set by buildTreeWithTotals
  children?: NetworkNode[]
  group_cases?: number
  group_commission?: number
}

export type Period = 'lifetime' | 'yearly' | 'monthly'

// ─── Role Config ─────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  '__QAI_ROOT__':  { label: 'Company',     color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  super_admin:     { label: 'Super Admin', color: 'text-gray-700',    bg: 'bg-gray-100',    border: 'border-gray-200' },
  admin:           { label: 'Admin',       color: 'text-gray-700',    bg: 'bg-gray-100',    border: 'border-gray-200' },
  agency_manager:  { label: 'Agency Mgr', color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200' },
  unit_manager:    { label: 'Unit Mgr',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  senior_agent:    { label: 'Sr. Agent',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  agent:           { label: 'Agent',      color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
}

// ─── Build tree with group totals ────────────────────────────

export function buildTree(flatList: NetworkNode[], rootId: string | null = null): NetworkNode[] {
  const targetParent = rootId ?? '__QAI_ROOT__'
  return flatList
    .filter((n) => n.upline_id === targetParent)
    .map((n) => {
      const children = buildTree(flatList, n.id)
      const group_cases = n.case_count + children.reduce((s, c) => s + (c.group_cases ?? c.case_count), 0)
      const group_commission = n.commission_earned + children.reduce((s, c) => s + (c.group_commission ?? c.commission_earned), 0)
      return { ...n, children, group_cases, group_commission }
    })
}

// ─── Tooltip ─────────────────────────────────────────────────

function GroupTooltip({ node, period }: { node: NetworkNode; period: Period }) {
  const periodLabel = period === 'yearly' ? 'This Year' : period === 'monthly' ? 'This Month' : 'All Time'
  const hasGroup = (node.children?.length ?? 0) > 0

  return (
    <div className="absolute z-50 left-full top-0 ml-2 w-56 bg-[#0A1628] text-white rounded-xl shadow-2xl p-3 text-xs pointer-events-none">
      <p className="font-semibold text-[#C9A84C] mb-2 text-[11px] uppercase tracking-wider">
        Group Performance · {periodLabel}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-400">Own Cases</span>
          <span className="font-semibold">{node.case_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Own Commission</span>
          <span className="font-semibold text-emerald-400">{formatCurrency(node.commission_earned)}</span>
        </div>
        {hasGroup && (
          <>
            <div className="border-t border-gray-600 my-1" />
            <div className="flex justify-between">
              <span className="text-gray-400">Group Cases</span>
              <span className="font-semibold text-blue-300">{node.group_cases ?? node.case_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Group Commission</span>
              <span className="font-semibold text-[#C9A84C]">{formatCurrency(node.group_commission ?? node.commission_earned)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Recruits (direct)</span>
              <span className="font-semibold">{node.children?.length ?? 0}</span>
            </div>
          </>
        )}
      </div>
      {/* Tooltip arrow */}
      <div className="absolute -left-1.5 top-4 w-3 h-3 bg-[#0A1628] rotate-45" />
    </div>
  )
}

// ─── Single Node Card ────────────────────────────────────────

function NodeCard({
  node,
  currentUserId,
  depth,
  period,
}: {
  node: NetworkNode
  currentUserId: string
  depth: number
  period: Period
}) {
  const [expanded, setExpanded] = React.useState(depth < 2)
  const [hovered, setHovered] = React.useState(false)
  const hasChildren = (node.children?.length ?? 0) > 0
  const isCurrentUser = node.id === currentUserId
  const isRoot = node.id === '__QAI_ROOT__'
  const cfg = ROLE_CONFIG[isRoot ? '__QAI_ROOT__' : (node.role ?? 'agent')] ?? ROLE_CONFIG.agent

  return (
    <div className="relative">
      {/* Node row */}
      <div
        className={cn(
          'group relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 cursor-default',
          isRoot
            ? 'border-[#C9A84C] bg-gradient-to-r from-amber-50 to-white shadow-md'
            : isCurrentUser
            ? 'border-blue-400 bg-blue-50 shadow-sm'
            : 'border-border/40 bg-background/80 hover:border-accent/30 hover:shadow-sm',
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand toggle (non-root nodes) */}
        {hasChildren && !isRoot && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute -left-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}

        {/* Avatar */}
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
          isRoot ? 'bg-[#C9A84C] text-[#0A1628]'
            : isCurrentUser ? 'bg-blue-500 text-white'
            : 'bg-muted text-muted-foreground'
        )}>
          {isRoot ? <Crown className="h-4 w-4" /> : node.full_name.charAt(0).toUpperCase()}
        </div>

        {/* Name & role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn(
              'font-semibold text-sm',
              isRoot ? 'text-[#C9A84C]' : isCurrentUser ? 'text-blue-700' : 'text-foreground'
            )}>
              {node.full_name}
              {isCurrentUser && (
                <span className="ml-1.5 text-[11px] font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">You</span>
              )}
            </p>
            {node.agent_code && !isRoot && (
              <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {node.agent_code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
              {cfg.label}
            </span>
            {!node.is_active && !isRoot && (
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground sm:ml-auto flex-shrink-0">
          <div className="flex items-center gap-1" title="Cases">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{node.case_count}</span>
          </div>
          {!isRoot && (
            <div className="flex items-center gap-1" title="Commission (own)">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{formatCurrency(node.commission_earned)}</span>
            </div>
          )}
          {hasChildren && (
            <div className="flex items-center gap-1 text-blue-500" title="Group commission">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="font-semibold">{formatCurrency(node.group_commission ?? 0)}</span>
            </div>
          )}
          <div className="flex items-center gap-1" title="Direct recruits">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{node.children?.length ?? 0}</span>
          </div>
        </div>

        {/* Root expand button */}
        {isRoot && hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium flex-shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {expanded ? 'Collapse' : `Expand (${node.children?.length})`}
          </button>
        )}

        {/* Hover tooltip */}
        {hovered && !isRoot && (
          <GroupTooltip node={node} period={period} />
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className={cn(
          'mt-1 space-y-1 pt-1',
          isRoot ? 'ml-4 pl-4 border-l-2 border-amber-200' : 'ml-8 pl-6 border-l border-border/40'
        )}>
          {node.children!.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              currentUserId={currentUserId}
              depth={depth + 1}
              period={period}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main OrgTree Component ──────────────────────────────────

interface OrgTreeProps {
  nodes: NetworkNode[]
  currentUserId?: string
  rootId?: string | null
  period?: Period
  onPeriodChange?: (p: Period) => void
  showPeriodToggle?: boolean
}

export function OrgTree({
  nodes,
  currentUserId = '',
  rootId = null,
  period = 'lifetime',
  onPeriodChange,
  showPeriodToggle = false,
}: OrgTreeProps) {
  const PERIODS: { value: Period; label: string }[] = [
    { value: 'lifetime', label: 'All Time' },
    { value: 'yearly',   label: 'This Year' },
    { value: 'monthly',  label: 'This Month' },
  ]

  const periodToggle = showPeriodToggle && onPeriodChange && (
    <div className="flex items-center gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onPeriodChange(p.value)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            period === p.value
              ? 'bg-white shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )

  // ── Agent view: show agent as root, downline below ──
  if (rootId && rootId !== '__QAI_ROOT__') {
    const self = nodes.find((n) => n.id === rootId)
    const downline = buildTree(nodes, rootId)

    // Construct root node with group totals
    const groupCases = (self?.case_count ?? 0) + downline.reduce((s, c) => s + (c.group_cases ?? c.case_count), 0)
    const groupCommission = (self?.commission_earned ?? 0) + downline.reduce((s, c) => s + (c.group_commission ?? c.commission_earned), 0)

    const rootNode: NetworkNode = self
      ? { ...self, children: downline, group_cases: groupCases, group_commission: groupCommission }
      : {
          id: rootId,
          full_name: 'You',
          email: '',
          role: 'agent',
          agent_code: null,
          upline_id: null,
          is_active: true,
          case_count: 0,
          commission_earned: 0,
          children: downline,
          group_cases: groupCases,
          group_commission: groupCommission,
        }

    return (
      <div>
        {periodToggle}
        <div className="space-y-1 pl-2">
          <NodeCard node={rootNode} currentUserId={rootId} depth={0} period={period} />
        </div>
        {downline.length === 0 && (
          <p className="text-xs text-muted-foreground mt-4 ml-3">
            No downline agents yet. Share your referral link to recruit.
          </p>
        )}
      </div>
    )
  }

  // ── Admin view: QAI root + full tree ──
  const allChildren = buildTree(nodes, '__QAI_ROOT__')

  if (allChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-30" />
        <p className="font-medium">No agents registered yet</p>
        <p className="text-sm mt-1">Add agents and assign uplines to build the hierarchy.</p>
      </div>
    )
  }

  const qaiNode: NetworkNode = {
    id: '__QAI_ROOT__',
    full_name: 'QuantifyAI (QAI)',
    email: 'admin@quantifyai.com',
    role: 'agency_manager',
    agent_code: 'QAI',
    upline_id: null,
    is_active: true,
    is_root: true,
    case_count: allChildren.reduce((s, n) => s + (n.group_cases ?? n.case_count), 0),
    commission_earned: 0,
    children: allChildren,
    group_cases: allChildren.reduce((s, n) => s + (n.group_cases ?? n.case_count), 0),
    group_commission: allChildren.reduce((s, n) => s + (n.group_commission ?? n.commission_earned), 0),
  }

  return (
    <div>
      {periodToggle}
      <div className="space-y-1 pl-2">
        <NodeCard node={qaiNode} currentUserId={currentUserId} depth={0} period={period} />
      </div>
    </div>
  )
}
