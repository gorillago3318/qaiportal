import { LayoutDashboard, Calculator, FolderOpen, DollarSign, TrendingUp, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const stats = [
  {
    label: "Active Cases",
    value: "—",
    icon: FolderOpen,
    color: "text-[#3B82F6]",
    bg: "bg-[#EFF6FF]",
    href: "/agent/cases",
  },
  {
    label: "Calculations",
    value: "—",
    icon: Calculator,
    color: "text-[#6366F1]",
    bg: "bg-[#EEF2FF]",
    href: "/agent/calculations",
  },
  {
    label: "Commissions (MYR)",
    value: "—",
    icon: DollarSign,
    color: "text-[#10B981]",
    bg: "bg-[#ECFDF5]",
    href: "/agent/commissions",
  },
  {
    label: "Approved Cases",
    value: "—",
    icon: TrendingUp,
    color: "text-[#C9A84C]",
    bg: "bg-[#FFFBEB]",
    href: "/agent/cases",
  },
]

const quickLinks = [
  {
    href: "/agent/calculations/new",
    label: "New Calculation",
    description: "Start a new loan calculation for a client",
    icon: Calculator,
    variant: "gold" as const,
  },
  {
    href: "/agent/cases",
    label: "View My Cases",
    description: "Track your submitted cases",
    icon: FolderOpen,
    variant: "outline" as const,
  },
]

export default function AgentDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Dashboard</h1>
        <p className="text-[#6B7280] text-sm mt-1">Welcome back. Here&apos;s your overview.</p>
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
                      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold text-[#0A1628] mt-1 font-heading">
                        {stat.value}
                      </p>
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

      {/* Quick actions */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-[#0A1628] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Card key={link.href} className="hover:shadow-card-hover transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-[#F3F4F6] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="h-6 w-6 text-[#0A1628]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#0A1628]">{link.label}</p>
                      <p className="text-sm text-[#6B7280] mt-0.5">{link.description}</p>
                    </div>
                    <Button variant={link.variant} size="sm" asChild>
                      <Link href={link.href}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Recent cases placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Cases</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agent/cases" className="text-[#C9A84C] hover:text-[#B8912A]">
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
            <p className="font-medium text-[#374151]">No cases yet</p>
            <p className="text-sm text-[#9CA3AF] mt-1 mb-4">
              Create your first calculation to get started
            </p>
            <Button variant="gold" size="sm" asChild>
              <Link href="/agent/calculations/new">
                <Calculator className="h-4 w-4" />
                New Calculation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
