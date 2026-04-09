import Link from "next/link"
import { ArrowLeft, Calculator } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function NewCalculationPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agent/calculations">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">New Calculation</h1>
          <p className="text-[#6B7280] text-sm mt-1">Calculate and compare loan options for your client</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center">
              <Calculator className="h-5 w-5 text-[#6366F1]" />
            </div>
            <div>
              <CardTitle>Loan Calculation Engine</CardTitle>
              <CardDescription>Refinance, Subsale & Developer Purchase</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 bg-[#EEF2FF] rounded-3xl flex items-center justify-center mb-5">
              <Calculator className="h-10 w-10 text-[#6366F1]" />
            </div>
            <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
              Calculation Form
            </h3>
            <p className="text-[#6B7280] text-sm max-w-sm mb-4">
              The full calculation form is coming soon. This will include client details, current loan info,
              proposed bank selection, and automatic fee calculation.
            </p>
            <div className="inline-flex items-center gap-2 bg-[#FFFBEB] text-[#B45309] text-sm px-4 py-2 rounded-lg border border-[#FEF3C7]">
              <span className="font-medium">In development</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
