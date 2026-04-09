import Link from "next/link"
import { ArrowLeft, FolderOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AgentCaseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agent/cases">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Case Detail</h1>
          <p className="text-[#6B7280] text-sm mt-1 font-mono">#{params.id}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#EFF6FF] rounded-xl flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <CardTitle>Case Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[#6B7280] text-sm">
              Case details will be shown here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
