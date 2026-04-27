"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  FolderOpen,
  Calculator,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Plus,
  Eye,
  Link2,
  Copy,
  CheckCheck,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import type { Profile, Calculation, CaseStatus, LoanType } from "@/types/database"

interface RecentCase {
  id: string
  case_code: string
  status: CaseStatus
  loan_type: LoanType
  proposed_loan_amount: number | null
  created_at: string
  client: { full_name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  bank_processing: "bg-purple-100 text-purple-700",
  kiv: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  pending_execution: "bg-indigo-100 text-indigo-700",
  executed: "bg-cyan-100 text-cyan-700",
  payment_pending: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-800",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  bank_processing: "Bank Processing",
  kiv: "KIV",
  approved: "Approved",
  declined: "Declined",
  accepted: "Accepted",
  rejected: "Rejected",
  pending_execution: "Pending Execution",
  executed: "Executed",
  payment_pending: "Payment Pending",
  paid: "Paid",
}

const LOAN_TYPE_COLORS: Record<string, string> = {
  refinance: "bg-blue-50 text-blue-700 border-blue-200",
  subsale: "bg-green-50 text-green-700 border-green-200",
  developer: "bg-purple-50 text-purple-700 border-purple-200",
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  refinance: "Refinance",
  subsale: "Subsale",
  developer: "Developer",
}

interface CaseStatusCount {
  status: CaseStatus
  count: number
}

interface AppNotification {
  id: string
  title: string
  message: string
  type: string
  case_id: string | null
  is_read: boolean
  created_at: string
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  href,
  loading,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  href: string
  loading?: boolean
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-[#D7263D] h-full">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#5F5F67] uppercase tracking-wider mb-1">
                {label}
              </p>
              {loading ? (
                <Skeleton className="h-8 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-[#17171A] font-heading">
                  {value}
                </p>
              )}
            </div>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconBg)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function AgentDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [recentCalcs, setRecentCalcs] = React.useState<Calculation[]>([])
  const [caseStatusCounts, setCaseStatusCounts] = React.useState<CaseStatusCount[]>([])
  const [totalCases, setTotalCases] = React.useState(0)
  const [activeCases, setActiveCases] = React.useState(0)
  const [paidCommissions, setPaidCommissions] = React.useState(0)
  const [pipelineCommissions, setPipelineCommissions] = React.useState(0)
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [loading, setLoading] = React.useState(true)
  const [recentCases, setRecentCases] = React.useState<RecentCase[]>([])
  const [referralLeads, setReferralLeads] = React.useState<Calculation[]>([])
  const [copied, setCopied] = React.useState(false)

  const today = new Date().toLocaleDateString("en-MY", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  React.useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) setProfile(profileData as Profile)

      // Fetch cases summary
      const { data: casesData } = await supabase
        .from("cases")
        .select("status, id")
        .eq("agent_id", user.id)

      if (casesData) {
        const counts: Record<string, number> = {}
        casesData.forEach((c: { status: string; id: string }) => {
          counts[c.status] = (counts[c.status] || 0) + 1
        })
        const statusCounts = Object.entries(counts).map(([status, count]) => ({
          status: status as CaseStatus,
          count,
        }))
        setCaseStatusCounts(statusCounts)
        setTotalCases(casesData.length)
        const active = casesData.filter((c: { status: string; id: string }) =>
          ["submitted", "bank_processing", "kiv", "approved", "accepted"].includes(c.status)
        ).length
        setActiveCases(active)
      }

      // Fetch recent cases (last 5)
      const { data: recentCasesData } = await supabase
        .from('cases')
        .select('id, case_code, status, loan_type, proposed_loan_amount, created_at, client:clients(full_name)')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (recentCasesData) setRecentCases(recentCasesData as unknown as RecentCase[])

      // Fetch commissions via API (handles upline tier_breakdown correctly)
      try {
        const commRes = await fetch('/api/commissions')
        if (commRes.ok) {
          const commJson = await commRes.json()
          const comms: { status: string; my_share: number | null; paid_amount: number | null; net_distributable: number }[] = commJson.data || []
          const myShare = (c: typeof comms[0]) => c.my_share ?? c.net_distributable
          setPipelineCommissions(
            comms.filter(c => c.status === 'calculated' || c.status === 'payment_pending')
              .reduce((sum, c) => sum + myShare(c), 0)
          )
          // Always use my_share — paid_amount is total case commission, not per-user.
          setPaidCommissions(
            comms.filter(c => c.status === 'paid')
              .reduce((sum, c) => sum + myShare(c), 0)
          )
        }
      } catch { /* non-fatal */ }

      // Fetch recent calculations (last 5)
      const { data: calcsData } = await supabase
        .from("calculations")
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

      if (calcsData) setRecentCalcs(calcsData as Calculation[])

      // Fetch referral leads (public calculations via agent's referral link)
      const typedProfile = profileData as Profile | null
      if (typedProfile?.agent_code) {
        const { data: refLeads } = await supabase
          .from("calculations")
          .select("*")
          .eq("agent_id", user.id)
          .not("referral_code", "is", null)
          .order("created_at", { ascending: false })
          .limit(8)
        if (refLeads) setReferralLeads(refLeads as Calculation[])
      }

      // Fetch notifications
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)

      if (notifData) setNotifications(notifData as AppNotification[])

      setLoading(false)
    }

    fetchData()
  }, [router])

  const firstName = profile?.full_name?.split(" ")[0] || "Agent"

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          {loading ? (
            <>
              <Skeleton className="h-8 w-52 mb-2" />
              <Skeleton className="h-4 w-36" />
            </>
          ) : (
            <>
              <h1 className="font-heading text-2xl font-bold text-[#17171A]">
                Welcome back, {firstName}!
              </h1>
              <p className="text-sm text-[#5F5F67] mt-1">
                {profile?.role?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                {profile?.agent_code && ` · ${profile.agent_code}`}
              </p>
            </>
          )}
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-[#5F5F67]">{today}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Cases"
          value={totalCases}
          icon={FolderOpen}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          href="/agent/cases"
          loading={loading}
        />
        <StatCard
          label="Active Cases"
          value={activeCases}
          icon={TrendingUp}
          iconBg="bg-amber-50"
          iconColor="text-[#D7263D]"
          href="/agent/cases"
          loading={loading}
        />
        <StatCard
          label="Commission Pipeline"
          value={loading ? "—" : formatCurrency(pipelineCommissions)}
          icon={DollarSign}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          href="/agent/commissions"
          loading={loading}
        />
        <StatCard
          label="Paid Out"
          value={loading ? "—" : formatCurrency(paidCommissions)}
          icon={DollarSign}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          href="/agent/commissions"
          loading={loading}
        />
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Cases — 60% */}
        <div className="lg:col-span-3 min-w-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base">Recent Cases</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/agent/cases" className="text-[#D7263D] hover:text-[#B61F33] text-xs">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    <FolderOpen className="h-7 w-7 text-[#6B6B73]" />
                  </div>
                  <p className="text-sm text-[#5F5F67]">No cases yet</p>
                  <p className="text-xs text-[#9CA3AF] mt-1 max-w-[200px]">Run a calculation first, then create a case when the client is ready.</p>
                  <Button variant="gold" size="sm" className="mt-3" asChild>
                    <Link href="/agent/calculations/new">
                      <Calculator className="h-3 w-3" />
                      Start with a Calculation
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm min-w-[340px]">
                    <thead>
                      <tr className="border-b border-[#E3E3E7]">
                        <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3 pl-6">Client</th>
                        <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3 hidden sm:table-cell">Type</th>
                        <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3">Status</th>
                        <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-3 hidden sm:table-cell">Amount</th>
                        <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECECF0]">
                      {recentCases.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F5F5F8] transition-colors">
                          <td className="py-3 pr-3 pl-6">
                            <p className="font-medium text-[#17171A] truncate max-w-[120px]">
                              {c.client?.full_name || '—'}
                            </p>
                            <p className="text-[10px] text-[#9CA3AF] font-mono">{c.case_code}</p>
                          </td>
                          <td className="py-3 pr-3 hidden sm:table-cell">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                              LOAN_TYPE_COLORS[c.loan_type] || "bg-[#F3F3F6] text-[#4D4D56] border-[#DFDFE4]"
                            )}>
                              {LOAN_TYPE_LABELS[c.loan_type] || c.loan_type}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                              STATUS_COLORS[c.status] || "bg-gray-100 text-gray-700"
                            )}>
                              {STATUS_LABELS[c.status] || c.status}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-right text-[#5F5F67] hidden sm:table-cell text-xs">
                            {c.proposed_loan_amount ? formatCurrency(c.proposed_loan_amount) : '—'}
                          </td>
                          <td className="py-3 text-right pr-6">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={c.status === 'draft' ? `/agent/cases/new?id=${c.id}` : `/agent/cases/${c.id}`}>
                                <Eye className="h-3 w-3" />
                                <span className="hidden sm:inline">{c.status === 'draft' ? 'Continue' : 'View'}</span>
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

        {/* Quick Actions + Recent Calculations — 40% */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="gold" size="lg" className="w-full justify-start gap-3" asChild>
                <Link href="/agent/cases/new">
                  <Plus className="h-5 w-5" />
                  Submit New Case
                </Link>
              </Button>
              <Button variant="navy-outline" size="lg" className="w-full justify-start gap-3" asChild>
                <Link href="/agent/calculations/new">
                  <Calculator className="h-5 w-5" />
                  New Calculation (Pitch)
                </Link>
              </Button>
              <Button variant="ghost" size="lg" className="w-full justify-start gap-3 text-[#17171A]" asChild>
                <Link href="/agent/cases">
                  <FolderOpen className="h-5 w-5" />
                  View My Cases
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Calculations — compact */}
          {recentCalcs.length > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-sm text-[#5F5F67]">Recent Calculations</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/agent/calculations" className="text-[#D7263D] hover:text-[#B61F33] text-xs">
                      View all <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {recentCalcs.slice(0, 4).map((calc) => {
                  const results = calc.results as Record<string, number> | null
                  const saving = results?.monthlySavings ?? 0
                  return (
                    <Link key={calc.id} href={`/agent/calculations/${calc.id}`}
                      className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F5F5F8] transition-colors group">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#17171A] truncate max-w-[130px]">{calc.client_name}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{formatDate(calc.created_at)}</p>
                      </div>
                      {saving > 0
                        ? <span className="text-[10px] font-semibold text-green-700 shrink-0 ml-2">+{formatCurrency(saving)}/mo</span>
                        : <span className="text-[10px] text-zinc-400 shrink-0 ml-2">—</span>
                      }
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Notifications Card */}
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base flex justify-between items-center">
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-[#5F5F67] text-center py-4">You have no new notifications.</p>
              ) : (
                <div className="space-y-4">
                  {notifications.map((n) => (
                    <div key={n.id} className="border-b border-[#ECECF0] pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className={cn("text-sm font-semibold", n.is_read ? "text-[#5F5F67]" : "text-[#17171A]")}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-zinc-400 ml-2 whitespace-nowrap">
                          {formatDate(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-[#5F5F67] line-clamp-2">{n.message}</p>
                      {n.case_id && (
                        <Link href={`/agent/cases/${n.case_id}`} className="text-[11px] text-[#D7263D] hover:underline mt-1 inline-block font-medium">
                          View Case &rarr;
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Referral Link Card */}
      {profile?.agent_code && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#D7263D]/8 flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-[#D7263D]" />
                </div>
                <CardTitle className="font-heading text-base">My Referral Link</CardTitle>
              </div>
              {referralLeads.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#D7263D]/8 text-[#D7263D] px-2.5 py-1 rounded-full">
                  <Users className="h-3 w-3" />
                  {referralLeads.length} lead{referralLeads.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 h-10 px-3.5 rounded-xl border border-[#D8D8DE] bg-[#f6f6f7] text-sm text-[#5F5F67] font-mono flex items-center overflow-hidden select-all min-w-0">
                <span className="truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/calculate?ref=${profile.agent_code}` : `/calculate?ref=${profile.agent_code}`}
                </span>
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/calculate?ref=${profile.agent_code}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }
                }}
                className={cn(
                  "h-10 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all flex-shrink-0",
                  copied
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-[#D7263D] text-white hover:bg-[#B61F33] shadow-[0_2px_8px_rgba(215,38,61,0.25)]"
                )}
              >
                {copied ? <><CheckCheck className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Link</>}
              </button>
            </div>
            <p className="text-xs text-[#7C7C85]">
              Share this link with potential clients. Any calculation they complete will be attributed to you — you&apos;ll see their details below and receive a notification.
            </p>

            {referralLeads.length > 0 && (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm min-w-[380px]">
                  <thead>
                    <tr className="border-b border-[#E3E3E7]">
                      <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pl-6 pr-3">Client</th>
                      <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3 hidden sm:table-cell">Contact</th>
                      <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-3">Est. Saving</th>
                      <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-6 hidden sm:table-cell">Date</th>
                      <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECECF0]">
                    {referralLeads.map(calc => {
                      const results = calc.results as Record<string, number> | null
                      const saving = results?.monthlySavings ?? 0
                      return (
                        <tr key={calc.id} className="hover:bg-[#F5F5F8] transition-colors">
                          <td className="py-3 pr-3 pl-6">
                            <p className="font-medium text-[#17171A] truncate max-w-[120px]">{calc.client_name}</p>
                            <p className="text-xs text-[#7C7C85]">via referral link</p>
                          </td>
                          <td className="py-3 pr-3 hidden sm:table-cell">
                            <p className="text-xs text-[#5F5F67]">{calc.client_phone || '—'}</p>
                          </td>
                          <td className="py-3 pr-3 text-right">
                            {saving > 0 ? (
                              <span className="font-medium text-green-700 text-xs">+{formatCurrency(saving)}/mo</span>
                            ) : <span className="text-zinc-400">—</span>}
                          </td>
                          <td className="py-3 pr-6 text-right text-[#5F5F67] hidden sm:table-cell text-xs">
                            {formatDate(calc.created_at)}
                          </td>
                          <td className="py-3 pr-6 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/agent/calculations/${calc.id}`}>
                                <Eye className="h-3 w-3" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {referralLeads.length === 0 && !loading && (
              <div className="text-center py-4 text-sm text-[#7C7C85]">
                No referral leads yet — share your link to start tracking prospects.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cases by Status — horizontal pills */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Cases by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-3 flex-wrap">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          ) : caseStatusCounts.length === 0 ? (
            <p className="text-sm text-[#5F5F67]">No cases yet. Submit your first case to see status breakdown.</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {(["draft", "submitted", "bank_processing", "kiv", "approved", "paid"] as CaseStatus[]).map((status) => {
                const item = caseStatusCounts.find((c) => c.status === status)
                const count = item?.count ?? 0
                return (
                  <Link key={status} href="/agent/cases">
                    <span className={cn(
                      "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-opacity",
                      count === 0 ? "opacity-40" : "opacity-100 hover:opacity-80",
                      STATUS_COLORS[status] || "bg-gray-100 text-gray-700",
                      "border-transparent"
                    )}>
                      {STATUS_LABELS[status]}
                      <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-xs font-bold">
                        {count}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
