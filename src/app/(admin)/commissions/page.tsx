import { DollarSign, Download, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminCommissionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Commissions</h1>
          <p className="text-[#6B7280] text-sm mt-1">Track, calculate, and process commission payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Commissions", value: "MYR —", icon: DollarSign, color: "text-[#10B981]", bg: "bg-[#ECFDF5]" },
          { label: "Pending Payment", value: "MYR —", icon: DollarSign, color: "text-[#F59E0B]", bg: "bg-[#FFFBEB]" },
          { label: "Paid This Month", value: "MYR —", icon: DollarSign, color: "text-[#3B82F6]", bg: "bg-[#EFF6FF]" },
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
          <CardTitle>Commission Records</CardTitle>
          <CardDescription>Bank and lawyer commissions by case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#ECFDF5] rounded-3xl flex items-center justify-center mb-5">
              <DollarSign className="h-10 w-10 text-[#10B981]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No commission records yet
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs">
              Commissions are auto-calculated when cases reach Approved status.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
