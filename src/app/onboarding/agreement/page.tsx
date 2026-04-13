"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { FileText, Download, CheckCircle2 } from "lucide-react"

export default function AgreementPage() {
  const router = useRouter()
  const [agreed, setAgreed] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [userRole, setUserRole] = React.useState("")

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (!user) { router.push("/login"); return }
      supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }: { data: { role: string } | null }) => {
        setUserRole(data?.role || "agent")
      })
    })
  }, [router])

  const handleAgree = async () => {
    if (!agreed) { toast.error("Please tick the checkbox to confirm you have read the agreement"); return }
    setLoading(true)
    const res = await fetch("/api/profile/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreement_signed: true }),
    })
    if (res.ok) {
      toast.success("Agreement accepted. Welcome aboard!")
      const isAdmin = ["super_admin", "admin"].includes(userRole)
      router.push(isAdmin ? "/admin/dashboard" : "/agent/dashboard")
    } else {
      toast.error("Failed to record agreement. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-[#0A1628] flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-[#0A1628]">Mortgage Consultant Agreement</h1>
              <p className="text-sm text-gray-500">Please read and accept the agreement before continuing</p>
            </div>
          </div>

          {/* Agreement summary */}
          <div className="bg-[#F8F9FA] rounded-xl border border-gray-200 p-6 mb-6 max-h-80 overflow-y-auto">
            <h2 className="font-heading font-bold text-[#0A1628] mb-3 text-base">Key Terms</h2>
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>You are engaged as an independent mortgage consultant and not as an employee of the company.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>All client information and case data is strictly confidential and must not be disclosed to third parties.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>Commission is payable only upon successful disbursement of the loan and receipt by the company.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>You must not solicit or deal directly with any client introduced through the company for a period of 24 months after termination.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>You agree to abide by all guidelines, compliance requirements, and code of conduct set by the company and relevant regulatory bodies.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>The company reserves the right to terminate this agreement with immediate effect in the event of misconduct or breach of any term.</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p>This agreement is governed by the laws of Malaysia and any disputes shall be resolved in Malaysian courts.</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                This is a summary. Download and read the full agreement document for complete terms and conditions.
              </p>
            </div>
          </div>

          {/* Download button */}
          <a
            href="/api/agreement/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#0A1628] font-medium hover:text-[#C9A84C] transition-colors mb-6"
          >
            <Download className="h-4 w-4" />
            Download Full Agreement (PDF)
          </a>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#C9A84C] cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              I confirm that I have read, understood, and agree to be bound by the{" "}
              <span className="font-medium text-[#0A1628]">Mortgage Consultant Agreement</span>{" "}
              in its entirety.
            </span>
          </label>

          {/* Submit */}
          <button
            onClick={handleAgree}
            disabled={loading || !agreed}
            className="w-full h-11 bg-[#0A1628] hover:bg-[#0d1f38] text-white font-semibold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? "Recording…" : "Agree & Enter Portal"}
          </button>
        </div>
      </div>
    </div>
  )
}
