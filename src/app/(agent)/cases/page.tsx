import Link from "next/link"
import { FolderOpen, Plus, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AgentCasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">My Cases</h1>
          <p className="text-[#6B7280] text-sm mt-1">Track and manage your submitted cases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="gold" size="sm" asChild>
            <Link href="/agent/calculations/new">
              <Plus className="h-4 w-4" />
              New Case
            </Link>
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", "Draft", "Submitted", "Processing", "Approved", "Paid"].map((tab) => (
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
          <CardTitle>Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#EFF6FF] rounded-3xl flex items-center justify-center mb-5">
              <FolderOpen className="h-10 w-10 text-[#3B82F6]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No cases found
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs mb-6">
              Submit your first case by creating a calculation and converting it to a full case submission.
            </p>
            <Button variant="gold" asChild>
              <Link href="/agent/calculations/new">
                <Plus className="h-4 w-4" />
                Create Calculation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
