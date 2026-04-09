import { DollarSign, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AgentCommissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Commissions</h1>
        <p className="text-[#6B7280] text-sm mt-1">Track your earnings and commission breakdown</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Earned", value: "MYR —", icon: DollarSign, color: "text-[#10B981]", bg: "bg-[#ECFDF5]" },
          { label: "Pending Payment", value: "MYR —", icon: TrendingUp, color: "text-[#F59E0B]", bg: "bg-[#FFFBEB]" },
          { label: "This Month", value: "MYR —", icon: DollarSign, color: "text-[#3B82F6]", bg: "bg-[#EFF6FF]" },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
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
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
          <CardDescription>Your commission records by case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#ECFDF5] rounded-3xl flex items-center justify-center mb-5">
              <DollarSign className="h-10 w-10 text-[#10B981]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No commissions yet
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs">
              Commissions will appear here once your cases are approved and processed by admin.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
