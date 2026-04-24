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
    <div className="min-h-screen flex bg-[#f6f6f7] text-[#111113]">
      {/* Left — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[radial-gradient(circle_at_15%_15%,rgba(215,38,61,0.1),transparent_40%),linear-gradient(180deg,#f9f9fb_0%,#f1f1f4_100%)] flex-col justify-between p-12 border-r border-[#111113]/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center">
              <span className="text-black font-bold text-lg">Q</span>
            </div>
            <div>
              <div className="text-[#111113] font-bold text-2xl tracking-tight">
                quantify<span className="text-zinc-300">.</span>
              </div>
              <div className="text-zinc-300 text-xs uppercase tracking-widest">
                artificial intelligence
              </div>
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-[#111113] text-4xl font-bold leading-tight mb-4">
            Quantifying Success,<br />
            <span className="text-zinc-300">Simplifying Finance</span>
          </h1>
          <p className="text-zinc-300 text-lg leading-relaxed">
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
                <div className="text-[#111113] text-2xl font-bold">{stat.value}</div>
                <div className="text-zinc-300 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-zinc-400 text-sm">
          © 2026 Quantify AI Sdn Bhd · SSM: 202501001318
        </div>
      </div>

      {/* Right — login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#f6f6f7]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center">
              <span className="text-black font-bold text-lg">Q</span>
            </div>
            <div className="text-[#111113] font-bold text-2xl">
              quantify<span className="text-zinc-300">.</span>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-[#111113]/12 bg-white/90 backdrop-blur-xl shadow-[0_18px_40px_rgba(17,17,19,0.1)] p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#111113]">Welcome back</h2>
              <p className="text-[#5F5F67] mt-1 text-sm">Sign in to your portal account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@quantifyai.me"
                  className="w-full h-11 px-4 rounded-lg border border-[#D8D8DE] bg-white text-[#111113] placeholder:text-[#7C7C85] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/40 focus:border-transparent transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-lg border border-[#D8D8DE] bg-white text-[#111113] placeholder:text-[#7C7C85] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/40 focus:border-transparent transition text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-[#D7263D] hover:bg-[#B61F33] text-white font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-4 text-right">
              <a href="/forgot-password" className="text-xs font-medium text-[#D7263D] hover:underline">
                Forgot password?
              </a>
            </div>

            <div className="mt-6 pt-6 border-t border-[#111113]/10 text-center">
              <p className="text-xs text-zinc-400">
                Account access is managed by your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
