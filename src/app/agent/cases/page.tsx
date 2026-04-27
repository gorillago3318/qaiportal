'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FolderOpen, Plus, Search, Eye, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CaseStatus, LoanType } from '@/types/database'
import { CASE_STATUS_LABELS, LOAN_TYPE_LABELS } from '@/types/database'

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

const filterTabs: { label: string; value: CaseStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Bank Processing', value: 'bank_processing' },
  { label: 'Approved', value: 'approved' },
  { label: 'Paid', value: 'paid' },
]

interface CaseItem {
  id: string
  case_code: string
  loan_type: LoanType
  status: CaseStatus
  proposed_loan_amount: number | null
  created_at: string
  client: { full_name: string; ic_number: string } | null
}

export default function AgentCasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CaseStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null) // case id pending confirm
  const [deleting, setDeleting] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchCases = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/cases?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch cases')
      const json = await res.json()
      setCases(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  // Count per status for badge (use all cases ignoring tab filter)
  const [allCases, setAllCases] = useState<CaseItem[]>([])
  useEffect(() => {
    fetch('/api/cases?limit=500')
      .then((r) => r.json())
      .then((j) => setAllCases(j.data || []))
      .catch(() => {})
  }, [])

  const countForStatus = (s: CaseStatus | 'all') => {
    if (s === 'all') return allCases.length
    return allCases.filter((c) => c.status === s).length
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/cases/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json()
        alert(j.error || 'Failed to delete case')
        return
      }
      setCases(prev => prev.filter(c => c.id !== id))
      setAllCases(prev => prev.filter(c => c.id !== id))
    } catch {
      alert('Failed to delete case')
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">My Cases</h1>
          <p className="text-[#6B7280] text-sm mt-1">Track and manage your submitted cases</p>
        </div>
        <Button variant="gold" size="sm" asChild className="self-start sm:self-auto">
          <Link href="/agent/cases/new">
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="Search by name or case code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filterTabs.map((tab) => {
          const count = countForStatus(tab.value)
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.value
                  ? 'bg-[#0A1628] text-white'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#0A1628] hover:text-[#0A1628]'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.value
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-red-500 text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchCases}>
                Retry
              </Button>
            </div>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 bg-[#EFF6FF] rounded-3xl flex items-center justify-center mb-5">
                <FolderOpen className="h-10 w-10 text-[#3B82F6]" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
                No cases found
              </h3>
              <p className="text-[#6B7280] text-sm max-w-xs mb-6">
                {search
                  ? 'No cases match your search. Try a different keyword.'
                  : 'Create your first case to get started.'}
              </p>
              <Button variant="gold" asChild>
                <Link href="/agent/cases/new">
                  <Plus className="h-4 w-4" />
                  New Case
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Case
                    </th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Client
                    </th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden sm:table-cell">
                      Loan Type
                    </th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">
                      Loan Amount
                    </th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-3 sm:px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider hidden md:table-cell">
                      Date
                    </th>
                    <th className="text-left px-3 sm:px-6 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className="font-mono text-xs font-semibold text-[#0A1628]">
                          {c.case_code}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div>
                          <p className="font-medium text-[#0A1628] text-xs sm:text-sm leading-snug">
                            {c.client?.full_name || '—'}
                          </p>
                          <p className="text-xs text-[#9CA3AF]">
                            {c.client?.ic_number || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-[#6B7280] hidden sm:table-cell">
                        {LOAN_TYPE_LABELS[c.loan_type]}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-[#0A1628] font-medium hidden md:table-cell">
                        {c.proposed_loan_amount
                          ? formatCurrency(c.proposed_loan_amount)
                          : '—'}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            statusColors[c.status]
                          }`}
                        >
                          {CASE_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-[#6B7280] text-xs hidden md:table-cell">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          {c.status === 'draft' ? (
                            <Button variant="outline" size="sm" asChild className="border-blue-400 text-blue-600 hover:bg-blue-50">
                              <Link href={`/agent/cases/new?id=${c.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Continue</span>
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/agent/cases/${c.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                            </Button>
                          )}

                          {/* Delete — drafts only, with inline confirmation */}
                          {c.status === 'draft' && (
                            confirmDelete === c.id ? (
                              <span className="flex items-center gap-1 text-xs">
                                <span className="text-red-600 font-medium">Delete?</span>
                                <button
                                  onClick={() => handleDelete(c.id)}
                                  disabled={deleting === c.id}
                                  className="text-red-600 font-semibold hover:underline disabled:opacity-50"
                                >
                                  {deleting === c.id ? '…' : 'Yes'}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(c.id)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                                title="Delete draft"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}
                        </div>
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
