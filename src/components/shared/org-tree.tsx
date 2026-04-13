'use client'

import * as React from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronRight, User, FolderOpen, DollarSign, Crown } from 'lucide-react'
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
  is_root?: boolean
  children?: NetworkNode[]
}

// ─── Role Config ─────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  '__QAI_ROOT__': { label: 'Company Root', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  super_admin:    { label: 'Super Admin',  color: 'text-gray-700',    bg: 'bg-gray-100',   border: 'border-gray-200' },
  admin:          { label: 'Admin',        color: 'text-gray-700',    bg: 'bg-gray-100',   border: 'border-gray-200' },
  agency_manager: { label: 'Agency Mgr',  color: 'text-purple-700',  bg: 'bg-purple-100', border: 'border-purple-200' },
  unit_manager:   { label: 'Unit Mgr',    color: 'text-blue-700',    bg: 'bg-blue-100',   border: 'border-blue-200' },
  senior_agent:   { label: 'Sr. Agent',   color: 'text-emerald-700', bg: 'bg-emerald-100',border: 'border-emerald-200' },
  agent:          { label: 'Agent',       color: 'text-amber-700',   bg: 'bg-amber-100',  border: 'border-amber-200' },
}

// ─── Build Tree ──────────────────────────────────────────────

export function buildTree(
  flatList: NetworkNode[],
  rootId: string | null = null
): NetworkNode[] {
  const targetParent = rootId ?? '__QAI_ROOT__'

  return flatList
    .filter((n) => n.upline_id === targetParent)
    .map((n) => ({
      ...n,
      children: buildTree(flatList, n.id),
    }))
}

// ─── Single Node Card ────────────────────────────────────────

function NodeCard({
  node,
  isCurrentUser,
  depth,
}: {
  node: NetworkNode
  isCurrentUser: boolean
  depth: number
}) {
  const [expanded, setExpanded] = React.useState(depth < 2)
  const hasChildren = (node.children?.length ?? 0) > 0
  const isRoot = node.id === '__QAI_ROOT__'
  const cfg = ROLE_CONFIG[isRoot ? '__QAI_ROOT__' : (node.role ?? 'agent')] ?? ROLE_CONFIG.agent

  return (
    <div className="relative">
      <div
        className={cn(
          'group relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
          isRoot
            ? 'border-[#C9A84C] bg-gradient-to-r from-amber-50 to-white shadow-md'
            : isCurrentUser
            ? 'border-accent/50 bg-accent/5 shadow-sm'
            : 'border-border/40 bg-background/80 hover:border-accent/20 hover:shadow-sm',
          'backdrop-blur-sm'
        )}
      >
        {/* Expand toggle */}
        {hasChildren && !isRoot && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="absolute -left-6 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-accent transition-colors flex-shrink-0"
          >
            {expanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        )}

        {/* Avatar */}
        <div
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0',
            isRoot ? 'bg-[#C9A84C] text-[#0A1628]'
              : isCurrentUser ? 'bg-accent text-white'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isRoot ? <Crown className="h-4 w-4" /> : node.full_name.charAt(0).toUpperCase()}
        </div>

        {/* Name & role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('font-semibold text-sm truncate', isRoot ? 'text-[#C9A84C]' : isCurrentUser ? 'text-accent' : 'text-foreground')}>
              {node.full_name}
              {isCurrentUser && <span className="ml-1 text-xs font-normal text-accent/80">(You)</span>}
            </p>
            {node.agent_code && !isRoot && (
              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {node.agent_code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', cfg.bg, cfg.color, cfg.border)}>
              {cfg.label}
            </span>
            {!node.is_active && !isRoot && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground sm:ml-auto flex-shrink-0">
          <div className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{node.case_count}</span>
            <span>cases</span>
          </div>
          {!isRoot && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{formatCurrency(node.commission_earned)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{node.children?.length ?? 0}</span>
            <span>{isRoot ? 'agents' : 'recruits'}</span>
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
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className={cn(
          'mt-1 space-y-1 pt-1',
          isRoot ? 'ml-4 pl-4 border-l-2 border-amber-200' : 'ml-8 pl-6 border-l border-border/50'
        )}>
          {node.children!.map((child) => (
            <NodeCard
              key={child.id}
              node={child}
              isCurrentUser={child.id === isCurrentUser.toString()}
              depth={depth + 1}
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
  /** If provided, only show the subtree rooted at this id */
  rootId?: string | null
}

export function OrgTree({ nodes, currentUserId, rootId = null }: OrgTreeProps) {

  // ── Agent view: show only their own downline ──
  if (rootId && rootId !== '__QAI_ROOT__') {
    const subtree = buildTree(nodes, rootId)
    if (subtree.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <User className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">No downline yet</p>
          <p className="text-sm mt-1">Recruit agents to start building your network.</p>
        </div>
      )
    }
    return (
      <div className="space-y-1 pl-6">
        {subtree.map((node) => (
          <NodeCard key={node.id} node={node} isCurrentUser={node.id === currentUserId} depth={0} />
        ))}
      </div>
    )
  }

  // ── Admin view: render QAI root + full tree ──
  const qaiRootRaw = nodes.find(n => n.id === '__QAI_ROOT__')
  const allChildren = buildTree(nodes, '__QAI_ROOT__')

  if (!qaiRootRaw && allChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <User className="h-12 w-12 mb-4 opacity-30" />
        <p className="font-medium">No agents registered yet</p>
        <p className="text-sm mt-1">Add agents and assign uplines to build the hierarchy.</p>
      </div>
    )
  }

  // Attach children to QAI root and render as a single tree
  const qaiNode: NetworkNode = {
    id: '__QAI_ROOT__',
    full_name: 'QuantifyAI (QAI)',
    email: 'admin@quantifyai.com',
    role: 'agency_manager',
    agent_code: 'QAI',
    upline_id: null,
    is_active: true,
    is_root: true,
    case_count: allChildren.reduce((s, n) => s + (n.case_count ?? 0), 0),
    commission_earned: 0,
    children: allChildren,
  }

  return (
    <div className="space-y-1 pl-2">
      <NodeCard key="__QAI_ROOT__" node={qaiNode} isCurrentUser={false} depth={0} />
    </div>
  )
}
