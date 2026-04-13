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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import type { Profile, Calculation, CaseStatus } from "@/types/database"

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
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [loading, setLoading] = React.useState(true)

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

      // Fetch paid commissions (via cases)
      const { data: paidCases } = await supabase
        .from("cases")
        .select("id")
        .eq("agent_id", user.id)
        .eq("status", "paid")

      if (paidCases && paidCases.length > 0) {
        const caseIds = paidCases.map((c: { id: string }) => c.id)
        const { data: commissionsData } = await supabase
          .from("commissions")
          .select("paid_amount")
          .in("case_id", caseIds)
          .eq("status", "paid")

        if (commissionsData) {
          const total = commissionsData.reduce(
            (sum, c: { paid_amount: number | null }) => sum + (c.paid_amount || 0),
            0
          )
          setPaidCommissions(total)
        }
      }

      // Fetch recent calculations (last 5)
      const { data: calcsData } = await supabase
        .from("calculations")
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)

      if (calcsData) setRecentCalcs(calcsData as Calculation[])

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
          value={loading ? "—" : formatCurrency(0)}
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
        {/* Recent Calculations — 60% */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base">Recent Calculations</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/agent/calculations" className="text-[#D7263D] hover:text-[#B61F33] text-xs">
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
              ) : recentCalcs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-14 w-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    <Calculator className="h-7 w-7 text-[#6B6B73]" />
                  </div>
                  <p className="text-sm text-[#5F5F67]">No calculations yet</p>
                  <Button variant="gold" size="sm" className="mt-3" asChild>
                    <Link href="/agent/calculations/new">
                      <Plus className="h-3 w-3" />
                      New Calculation
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E3E3E7]">
                        <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3">Client</th>
                        <th className="text-left text-xs font-medium text-[#4D4D56] pb-2 pr-3">Type</th>
                        <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-3">Est. Saving</th>
                        <th className="text-right text-xs font-medium text-[#4D4D56] pb-2 pr-3">Date</th>
                        <th className="text-right text-xs font-medium text-[#4D4D56] pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECECF0]">
                      {recentCalcs.map((calc) => {
                        const results = calc.results as Record<string, number> | null
                        const monthlySavings = results?.monthlySavings ?? 0
                        return (
                          <tr key={calc.id} className="hover:bg-[#F5F5F8] transition-colors">
                            <td className="py-3 pr-3">
                              <p className="font-medium text-[#17171A] truncate max-w-[120px]">
                                {calc.client_name}
                              </p>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                                LOAN_TYPE_COLORS[calc.loan_type] || "bg-[#F3F3F6] text-[#4D4D56] border-[#DFDFE4]"
                              )}>
                                {LOAN_TYPE_LABELS[calc.loan_type] || calc.loan_type}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-right">
                              {monthlySavings > 0 ? (
                                <span className="font-medium text-green-700">
                                  +{formatCurrency(monthlySavings)}/mo
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-3 text-right text-[#5F5F67]">
                              {formatDate(calc.created_at)}
                            </td>
                            <td className="py-3 text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/agent/calculations/${calc.id}`}>
                                  <Eye className="h-3 w-3" />
                                  View
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
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions — 40% */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-heading text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="gold" size="lg" className="w-full justify-start gap-3" asChild>
                <Link href="/agent/calculations/new">
                  <Calculator className="h-5 w-5" />
                  New Calculation
                </Link>
              </Button>
              <Button variant="navy-outline" size="lg" className="w-full justify-start gap-3" asChild>
                <Link href="/agent/cases/new">
                  <Plus className="h-5 w-5" />
                  Submit New Case
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

          {/* Notifications Card */}
          <Card className="h-full mt-6">
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
