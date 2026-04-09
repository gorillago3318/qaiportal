import { Users, UserPlus, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminAgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Agents</h1>
          <p className="text-[#6B7280] text-sm mt-1">Manage your agent hierarchy and team</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="gold" size="sm">
            <UserPlus className="h-4 w-4" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Role filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", "Agency Manager", "Unit Manager", "Senior Agent", "Agent"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === "All"
                ? "bg-[#0A1628] text-white"
                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#0A1628] hover:text-[#0A1628]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>5 Agency Managers · 35 Agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#EEF2FF] rounded-3xl flex items-center justify-center mb-5">
              <Users className="h-10 w-10 text-[#6366F1]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No agents yet
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs mb-6">
              Add agents and organize them into your hierarchy of Agency Managers, Unit Managers, and Agents.
            </p>
            <Button variant="gold">
              <UserPlus className="h-4 w-4" />
              Add First Agent
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
