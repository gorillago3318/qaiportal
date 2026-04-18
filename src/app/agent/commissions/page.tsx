'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import { LOAN_TYPE_LABELS } from '@/types/database'
import type { LoanType, CommissionStatus } from '@/types/database'

const commissionStatusColors: Record<CommissionStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  calculated: 'bg-blue-100 text-blue-700',
  payment_pending: 'bg-purple-100 text-purple-700',
  paid: 'bg-teal-100 text-teal-700',
}

const commissionStatusLabels: Record<CommissionStatus, string> = {
  pending: 'Pending',
  calculated: 'Calculated',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
}

interface CommissionItem {
  id: string
  case_id: string
  type: 'bank' | 'lawyer'
  gross_amount: number
  net_distributable: number
  tier_breakdown: Record<string, number>
  status: CommissionStatus
  paid_amount: number | null
  paid_at: string | null
  created_at: string
  case: {
    id: string
    case_code: string
    loan_type: LoanType
    agent_id: string
  } | null
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-[#0A1628] mt-1">{value}</p>
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AgentCommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>('all')

  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/commissions?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch commissions')
      const json = await res.json()
      setCommissions(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchCommissions()
  }, [fetchCommissions])

  const totalEarned = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.paid_amount ?? c.net_distributable), 0)

  const pendingAmount = commissions
    .filter((c) => c.status === 'pending' || c.status === 'calculated')
    .reduce((sum, c) => sum + c.net_distributable, 0)

  const paymentPendingAmount = commissions
    .filter((c) => c.status === 'payment_pending')
    .reduce((sum, c) => sum + c.net_distributable, 0)

  const filterTabs: { label: string; value: CommissionStatus | 'all' }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Calculated', value: 'calculated' },
    { label: 'Payment Pending', value: 'payment_pending' },
    { label: 'Paid', value: 'paid' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">My Commissions</h1>
        <p className="text-[#6B7280] text-sm mt-1">Track your earnings from approved cases</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Earned" value={formatCurrency(totalEarned)} icon={DollarSign} color="bg-teal-50 text-teal-600" />
        <StatCard title="Pending" value={formatCurrency(pendingAmount)} icon={Clock} color="bg-amber-50 text-amber-600" />
        <StatCard title="Payment Pending" value={formatCurrency(paymentPendingAmount)} icon={TrendingUp} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-[#0A1628] text-white'
                : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#0A1628] hover:text-[#0A1628]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 bg-[#F0FDF4] rounded-3xl flex items-center justify-center mb-5">
                <DollarSign className="h-10 w-10 text-teal-500" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">No commissions yet</h3>
              <p className="text-[#6B7280] text-sm max-w-xs">Commissions will appear here when your cases are approved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[460px]">
                <thead>
                  <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Case</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden sm:table-cell">Loan Type</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Type</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">Gross</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">My Share</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {commissions.map((comm) => {
                    const agentId = comm.case?.agent_id
                    const myShare =
                      agentId && comm.tier_breakdown[agentId] !== undefined
                        ? Number(comm.tier_breakdown[agentId])
                        : null
                    return (
                      <tr key={comm.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className="font-mono text-xs font-semibold text-[#0A1628]">{comm.case?.case_code || '—'}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-[#6B7280] hidden sm:table-cell">
                          {comm.case?.loan_type ? LOAN_TYPE_LABELS[comm.case.loan_type] : '—'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${comm.type === 'bank' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                            {comm.type === 'bank' ? 'Bank' : 'Lawyer'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-[#0A1628] hidden md:table-cell">{formatCurrency(comm.gross_amount)}</td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 font-medium text-[#0A1628]">
                          {myShare !== null ? formatCurrency(myShare) : formatCurrency(comm.net_distributable)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${commissionStatusColors[comm.status]}`}>
                            {commissionStatusLabels[comm.status]}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-4 text-[#6B7280] text-xs hidden sm:table-cell">
                          {comm.paid_at ? formatDate(comm.paid_at) : formatDate(comm.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
