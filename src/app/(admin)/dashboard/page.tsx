import { FolderOpen, Users, DollarSign, TrendingUp, Clock, CheckCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const stats = [
  {
    label: "Total Cases",
    value: "—",
    icon: FolderOpen,
    color: "text-[#3B82F6]",
    bg: "bg-[#EFF6FF]",
    href: "/admin/cases",
  },
  {
    label: "Active Agents",
    value: "—",
    icon: Users,
    color: "text-[#6366F1]",
    bg: "bg-[#EEF2FF]",
    href: "/admin/agents",
  },
  {
    label: "Total Commissions",
    value: "MYR —",
    icon: DollarSign,
    color: "text-[#10B981]",
    bg: "bg-[#ECFDF5]",
    href: "/admin/commissions",
  },
  {
    label: "Approved This Month",
    value: "—",
    icon: TrendingUp,
    color: "text-[#C9A84C]",
    bg: "bg-[#FFFBEB]",
    href: "/admin/cases",
  },
]

const statusHighlights = [
  { label: "Pending Review", count: "—", icon: Clock, color: "text-[#F59E0B]", bg: "bg-[#FFFBEB]" },
  { label: "Approved", count: "—", icon: CheckCircle, color: "text-[#10B981]", bg: "bg-[#ECFDF5]" },
]

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Admin Dashboard</h1>
        <p className="text-[#6B7280] text-sm mt-1">Overview of cases, agents, and commissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">{stat.label}</p>
                      <p className="text-2xl font-bold text-[#0A1628] mt-1 font-heading">{stat.value}</p>
                    </div>
                    <div className={`h-10 w-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Status highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {statusHighlights.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 ${item.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-2xl text-[#0A1628]">{item.count}</p>
                    <p className="text-sm text-[#6B7280]">{item.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent cases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Cases</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/cases" className="text-[#C9A84C] hover:text-[#B8912A]">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
              <FolderOpen className="h-8 w-8 text-[#D1D5DB]" />
            </div>
            <p className="font-medium text-[#374151]">No cases to show</p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Cases submitted by agents will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
