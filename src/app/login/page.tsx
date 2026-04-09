"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()
      const profile = profileData as { role: string } | null
      const role = profile?.role
      if (role === "super_admin" || role === "admin") {
        router.push("/admin/dashboard")
      } else {
        router.push("/agent/dashboard")
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A1628] flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C9A84C] flex items-center justify-center">
              <span className="text-[#0A1628] font-bold text-lg">Q</span>
            </div>
            <div>
              <div className="text-white font-bold text-2xl tracking-tight">
                quantify<span className="text-[#C9A84C]">.</span>
              </div>
              <div className="text-[#7E96BC] text-xs uppercase tracking-widest">
                artificial intelligence
              </div>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            Quantifying Success,<br />
            <span className="text-[#C9A84C]">Simplifying Finance</span>
          </h1>
          <p className="text-[#7E96BC] text-lg leading-relaxed">
            Malaysia&apos;s premier AI-powered mortgage refinance platform.
            Manage cases, track commissions, and generate professional reports — all in one place.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { label: "Loans Processed", value: "RM 2B+" },
              { label: "Years Experience", value: "20+" },
              { label: "Free Review", value: "100%" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-[#C9A84C] text-2xl font-bold">{stat.value}</div>
                <div className="text-[#7E96BC] text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[#4A6080] text-sm">
          © 2026 Quantify AI Sdn Bhd · SSM: 202501001318
        </div>
      </div>

      {/* Right — login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[#C9A84C] flex items-center justify-center">
              <span className="text-[#0A1628] font-bold text-lg">Q</span>
            </div>
            <div className="text-[#0A1628] font-bold text-2xl">
              quantify<span className="text-[#C9A84C]">.</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#0A1628]">Welcome back</h2>
              <p className="text-gray-500 mt-1 text-sm">Sign in to your portal account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@quantifyai.me"
                  className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-[#0A1628] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A1628] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-[#0A1628] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] focus:border-transparent transition text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#0A1628] hover:bg-[#0d1f38] text-white font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Account access is managed by your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
