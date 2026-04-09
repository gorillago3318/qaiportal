import Link from "next/link"
import { Calculator, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function CalculationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Calculations</h1>
          <p className="text-[#6B7280] text-sm mt-1">Loan calculations and client proposals</p>
        </div>
        <Button variant="gold" asChild>
          <Link href="/agent/calculations/new">
            <Plus className="h-4 w-4" />
            New Calculation
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Calculations</CardTitle>
          <CardDescription>View and manage your loan calculations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#EEF2FF] rounded-3xl flex items-center justify-center mb-5">
              <Calculator className="h-10 w-10 text-[#6366F1]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              No calculations yet
            </h3>
            <p className="text-[#6B7280] text-sm max-w-xs mb-6">
              Create a loan calculation to generate a client proposal and compare refinancing options.
            </p>
            <Button variant="gold" asChild>
              <Link href="/agent/calculations/new">
                <Plus className="h-4 w-4" />
                Create First Calculation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
