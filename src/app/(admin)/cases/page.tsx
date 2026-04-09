import { FolderOpen, Filter, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AdminCasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Cases</h1>
          <p className="text-[#6B7280] text-sm mt-1">Manage all agent case submissions</p>
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

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", "Submitted", "Processing", "KIV", "Approved", "Declined", "Paid"].map((tab) => (
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
          <CardTitle>All Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#EFF6FF] rounded-3xl flex items-center justify-center mb-5">
              <FolderOpen className="h-10 w-10 text-[#3B82F6]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No cases yet
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs">
              Cases submitted by agents will appear here for review and processing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
