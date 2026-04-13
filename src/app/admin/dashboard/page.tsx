'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, Users, DollarSign, TrendingUp, ArrowRight, Eye } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  CASE_STATUS_LABELS,
  LOAN_TYPE_LABELS,
} from '@/types/database'
import type { CaseStatus, LoanType } from '@/types/database'

const statusColors: Record<CaseStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  bank_processing: 'bg-amber-100 text-amber-700',
  kiv: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
  pending_execution: 'bg-indigo-100 text-indigo-700',
  executed: 'bg-cyan-100 text-cyan-700',
  payment_pending: 'bg-purple-100 text-purple-700',
  paid: 'bg-teal-100 text-teal-700',
}

const ACTIVE_STATUSES: CaseStatus[] = ['submitted', 'bank_processing', 'kiv', 'approved', 'accepted', 'payment_pending']

interface DashboardData {
  totalCases: number
  activeCases: number
  totalCommissions: number
  agentsCount: number
  statusBreakdown: Partial<Record<CaseStatus, number>>
  recentCases: Array<{
    id: string
    case_code: string
    loan_type: LoanType
    status: CaseStatus
    proposed_loan_amount: number | null
    created_at: string
    client: { full_name: string } | null
    agent: { full_name: string; agent_code: string | null } | null
  }>
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any

    async function loadDashboard() {
      setLoading(true)
      try {
        const [casesRes, agentsRes, commissionsRes] = await Promise.all([
          supabase
            .from('cases')
            .select(`
              id, case_code, loan_type, status, proposed_loan_amount, created_at,
              client:clients(full_name),
              agent:profiles!cases_agent_id_fkey(full_name, agent_code)
            `)
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('profiles')
            .select('id', { count: 'exact' })
            .not('role', 'in', '("super_admin","admin")')
            .eq('is_active', true),
          supabase
            .from('commissions')
            .select('net_distributable, status'),
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cases: any[] = casesRes.data || []
        const agentsCount = agentsRes.count || 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const commissions: any[] = commissionsRes.data || []

        const activeCases = cases.filter((c: { status: string }) =>
          ACTIVE_STATUSES.includes(c.status as CaseStatus)
        ).length

        const totalCommissions = commissions
          .filter((c: { status: string; net_distributable: number | null }) => c.status === 'paid')
          .reduce((sum: number, c: { net_distributable: number | null }) => sum + (c.net_distributable || 0), 0)

        const statusBreakdown: Partial<Record<CaseStatus, number>> = {}
        cases.forEach((c: { status: string }) => {
          const s = c.status as CaseStatus
          statusBreakdown[s] = (statusBreakdown[s] || 0) + 1
        })

        setData({
          totalCases: cases.length,
          activeCases,
          totalCommissions,
          agentsCount,
          statusBreakdown,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recentCases: (cases.slice(0, 10) as any[]),
        })
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const statCards = [
    {
      label: 'Total Cases',
      value: data ? String(data.totalCases) : '—',
      icon: FolderOpen,
      color: 'text-white',
      bg: 'bg-gradient-to-tr from-[#D7263D] to-[#B61F33] shadow-sm',
      href: '/admin/cases',
    },
    {
      label: 'Active Cases',
      value: data ? String(data.activeCases) : '—',
      icon: TrendingUp,
      color: 'text-white',
      bg: 'bg-gradient-to-tr from-[#111113] to-[#2A2A2E] shadow-sm',
      href: '/admin/cases',
    },
    {
      label: 'Total Commissions Paid',
      value: data ? formatCurrency(data.totalCommissions) : '—',
      icon: DollarSign,
      color: 'text-white',
      bg: 'bg-gradient-to-tr from-[#8A8A92] to-[#6E6E76] shadow-sm',
      href: '/admin/commissions',
    },
    {
      label: 'Active Agents',
      value: data ? String(data.agentsCount) : '—',
      icon: Users,
      color: 'text-white',
      bg: 'bg-gradient-to-tr from-[#4A4A50] to-[#333338] shadow-sm',
      href: '/admin/agents',
    },
  ]

  const allStatuses: CaseStatus[] = [
    'draft', 'submitted', 'bank_processing', 'kiv',
    'approved', 'declined', 'accepted', 'rejected', 'payment_pending', 'paid',
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-[#5F5F67] text-sm mt-1">Overview of cases, agents, and commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/agents">
              <Users className="h-4 w-4" />
              New Agent
            </Link>
          </Button>
          <Button variant="gold" size="sm" asChild>
            <Link href="/admin/cases">
              <FolderOpen className="h-4 w-4" />
              View All Cases
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card elevated className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#5F5F67] uppercase tracking-wider">
                        {stat.label}
                      </p>
                      {loading ? (
                        <Skeleton className="h-8 w-20 mt-2" />
                      ) : (
                        <p className="text-3xl font-bold text-foreground mt-1 font-heading">
                          {stat.value}
                        </p>
                      )}
                    </div>
                    <div className={`h-12 w-12 ${stat.bg} rounded-2xl flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Cases by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Cases by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : !data ? null : (
            <div className="space-y-3">
              {allStatuses
                .filter((s) => (data.statusBreakdown[s] || 0) > 0)
                .map((s) => {
                  const count = data.statusBreakdown[s] || 0
                  const pct = data.totalCases > 0 ? (count / data.totalCases) * 100 : 0
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="text-xs text-[#5F5F67] font-medium w-32 flex-shrink-0">
                        {CASE_STATUS_LABELS[s]}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#D7263D] to-[#B61F33] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-8 text-right">
                        {count}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Cases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Cases</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/cases" className="text-[#D7263D] hover:text-[#B61F33]">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : !data || data.recentCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-[#6B6B73]" />
              </div>
              <p className="font-medium text-foreground">No cases yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E3E3E7] bg-[#F8F8FA]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Case Code</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Client</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Agent</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Loan Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Loan Amount</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-[#4D4D56] uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECF0]">
                  {data.recentCases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F5F5F8] transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs font-semibold text-[#17171A]">{c.case_code}</span>
                      </td>
                      <td className="px-6 py-3 font-medium text-[#17171A]">
                        {c.client?.full_name || '—'}
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-[#2F2F36]">{c.agent?.full_name || '—'}</p>
                          {c.agent?.agent_code && (
                            <p className="text-xs text-[#7C7C85] font-mono">{c.agent.agent_code}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-[#5F5F67]">{LOAN_TYPE_LABELS[c.loan_type]}</td>
                      <td className="px-6 py-3 font-medium text-[#17171A]">
                        {c.proposed_loan_amount ? formatCurrency(c.proposed_loan_amount) : '—'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[c.status]}`}>
                          {CASE_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-[#5F5F67] text-xs">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-3">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/cases/${c.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
