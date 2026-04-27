"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calculator,
  Plus,
  Search,
  Eye,
  FileText,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import type { Calculation, LoanType } from "@/types/database"
import { toast } from "sonner"

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

type FilterTab = "all" | LoanType

interface CalculationWithBank extends Calculation {
  proposed_bank?: { name: string } | null
}

export default function CalculationsPage() {
  const router = useRouter()
  const [calculations, setCalculations] = React.useState<CalculationWithBank[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all")
  // Hide calculations that have already been converted to a case (default: hidden)
  const [showConverted, setShowConverted] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()

    async function fetchCalcs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      let query = supabase
        .from("calculations")
        .select(`*, proposed_bank:proposed_bank_id (name)`)
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })

      // Unless the agent explicitly wants to see converted ones, hide them
      if (!showConverted) {
        query = query.is("converted_to_case_id", null)
      }

      const { data, error } = await query

      if (error) {
        toast.error("Failed to load calculations")
      } else {
        setCalculations((data as CalculationWithBank[]) || [])
      }
      setLoading(false)
    }

    fetchCalcs()
  }, [router, showConverted])

  const filtered = calculations.filter((calc) => {
    const matchesSearch =
      search === "" ||
      calc.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (calc.client_ic && calc.client_ic.includes(search))
    const matchesTab = activeTab === "all" || calc.loan_type === activeTab
    return matchesSearch && matchesTab
  })

  const tabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "Refinance", value: "refinance" },
    { label: "Subsale", value: "subsale" },
    { label: "Developer", value: "developer" },
  ]

  function getCalcStatus(calc: CalculationWithBank): { label: string; color: string } {
    if (calc.converted_to_case_id) {
      return { label: "Converted to Case", color: "bg-green-50 text-green-700 border-green-200" }
    }
    if (calc.report_url) {
      return { label: "Report Generated", color: "bg-blue-50 text-blue-700 border-blue-200" }
    }
    return { label: "Saved", color: "bg-gray-50 text-gray-600 border-gray-200" }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">My Calculations</h1>
          <p className="text-gray-500 text-sm mt-1">Loan calculations and client proposals</p>
        </div>
        <Button variant="gold" asChild className="self-start sm:self-auto">
          <Link href="/agent/calculations/new">
            <Plus className="h-4 w-4" />
            New Calculation
          </Link>
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name or IC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-[#E5E7EB] bg-white text-[#0A1628]",
              "focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent",
              "placeholder:text-gray-400"
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.value
                    ? "bg-white text-[#0A1628] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowConverted((v) => !v)}
            className={cn(
              "h-9 px-3 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
              showConverted
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
            )}
          >
            {showConverted ? "Showing converted" : "Hide converted"}
          </button>
        </div>
      </div>

      {/* Table / list */}
      <Card>
        <CardContent className="pt-0 p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="h-20 w-20 bg-[#EEF2FF] rounded-3xl flex items-center justify-center mb-5">
                <Calculator className="h-10 w-10 text-[#6366F1]" />
              </div>
              <h3 className="font-heading font-semibold text-[#0A1628] text-lg mb-2">
                {search || activeTab !== "all" ? "No matching calculations" : "No calculations yet"}
              </h3>
              <p className="text-gray-500 text-sm max-w-xs mb-6">
                {search || activeTab !== "all"
                  ? "Try adjusting your search or filter."
                  : "Create a loan calculation to generate a client proposal and compare options."}
              </p>
              {!search && activeTab === "all" && (
                <Button variant="gold" asChild>
                  <Link href="/agent/calculations/new">
                    <Plus className="h-4 w-4" />
                    Create First Calculation
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-3 sm:px-4 py-3">Client</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 sm:px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 sm:px-4 py-3 hidden md:table-cell">Banks</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 sm:px-4 py-3">Monthly Saving</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-3 sm:px-4 py-3 hidden sm:table-cell">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 sm:px-4 py-3 hidden sm:table-cell">Date</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-3 sm:px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((calc) => {
                    const results = calc.results as Record<string, number> | null
                    const monthlySavings = results?.monthlySavings ?? 0
                    const status = getCalcStatus(calc)
                    const bankLabel = [
                      calc.current_bank,
                      calc.proposed_bank?.name,
                    ]
                      .filter(Boolean)
                      .join(" → ")

                    return (
                      <tr key={calc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-4 py-3">
                          <p className="font-medium text-[#0A1628] text-xs sm:text-sm">{calc.client_name}</p>
                          {calc.client_ic && (
                            <p className="text-xs text-gray-400">{calc.client_ic}</p>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                            LOAN_TYPE_COLORS[calc.loan_type] || "bg-gray-50 text-gray-600 border-gray-200"
                          )}>
                            {LOAN_TYPE_LABELS[calc.loan_type] || calc.loan_type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                          <p className="text-gray-600 text-xs">{bankLabel || "—"}</p>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          {monthlySavings > 0 ? (
                            <span className="font-semibold text-green-700 text-xs sm:text-sm">
                              +{formatCurrency(monthlySavings)}/mo
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 hidden sm:table-cell">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                            status.color
                          )}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right text-gray-500 hidden sm:table-cell text-xs">
                          {formatDate(calc.created_at)}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/agent/calculations/${calc.id}`}>
                                <Eye className="h-3 w-3" />
                                <span className="hidden sm:inline">View</span>
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (calc.loan_type === "refinance") {
                                  window.open(`/agent/calculations/${calc.id}/print`, "_blank")
                                } else {
                                  toast.info("PDF report is only available for refinance calculations")
                                }
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              <span className="hidden sm:inline">Report</span>
                            </Button>
                            {!calc.converted_to_case_id && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/agent/cases/new?from_calculation=${calc.id}`}>
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="hidden sm:inline">Case</span>
                                </Link>
                              </Button>
                            )}
                          </div>
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
  )
}
