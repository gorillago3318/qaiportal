"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, type Variants } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

// ── Animated count-up stat ────────────────────────────────────
function StatCounter({ prefix = "", target, suffix = "", label, delay = 0 }: {
  prefix?: string; target: number; suffix?: string; label: string; delay?: number
}) {
  const [val, setVal] = React.useState(0)
  const ref = React.useRef<HTMLDivElement>(null)
  const started = React.useRef(false)

  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1600
        const startTime = performance.now() + delay * 1000
        const tick = (now: number) => {
          if (now < startTime) { requestAnimationFrame(tick); return }
          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          const ease = 1 - Math.pow(1 - progress, 3)
          setVal(Math.round(ease * target))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, delay])

  return (
    <div ref={ref}>
      <div className="text-2xl font-bold text-[#0A1628]">
        {prefix}{val}{suffix}
      </div>
      <div className="text-xs text-[#6A6A73] mt-0.5 uppercase tracking-widest">{label}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPass, setShowPass] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const reason = searchParams.get("reason")
  const sessionBanner =
    reason === "session_replaced"
      ? "You were signed out because your account was logged in from another device."
      : null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }
    if (data.user) {
      const { data: profileData } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
      const profile = profileData as { role: string } | null
      const role = profile?.role
      if (role === "super_admin" || role === "admin") { router.push("/admin/dashboard") }
      else { router.push("/agent/dashboard") }
    }
    setLoading(false)
  }

  const fadeLeft: Variants = { hidden: { opacity: 0, x: -32 }, show: { opacity: 1, x: 0 } }
  const fadeRight: Variants = { hidden: { opacity: 0, x: 32 }, show: { opacity: 1, x: 0 } }
  const stagger: Variants = { show: { transition: { staggerChildren: 0.1 } } }
  const child: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { ease: [0.25, 0.46, 0.45, 0.94], duration: 0.5 } } }

  return (
    <div className="min-h-screen flex bg-[#f6f6f7] text-[#111113]">

      {/* ── Left — Branding ────────────────────────────────── */}
      <motion.div
        variants={fadeLeft}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-[#111113]/10 relative overflow-hidden"
        style={{
          background: "radial-gradient(circle at 15% 15%, rgba(215,38,61,0.1), transparent 45%), linear-gradient(180deg, #f9f9fb 0%, #f1f1f4 100%)",
        }}
      >
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,38,61,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(215,38,61,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        {/* Glowing red orb */}
        <div className="absolute top-[-80px] left-[-80px] h-72 w-72 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(215,38,61,0.12) 0%, transparent 70%)" }} />

        {/* Logo */}
        <motion.div variants={child} className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white shadow-[0_4px_16px_rgba(215,38,61,0.2)] flex items-center justify-center">
            <span className="text-[#D7263D] font-bold text-lg">Q</span>
          </div>
          <div>
            <div className="text-[#0A1628] font-bold text-2xl tracking-tight">
              quantify<span className="text-[#D7263D]">.</span>
            </div>
            <div className="text-[#7C7C85] text-[10px] uppercase tracking-widest">
              artificial intelligence
            </div>
          </div>
        </motion.div>

        {/* Main copy */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="relative space-y-6">
          <motion.h1 variants={child} className="text-[#0A1628] text-4xl font-bold leading-tight">
            Quantifying Success,<br />
            <span className="text-[#D7263D]">Simplifying Finance</span>
          </motion.h1>
          <motion.p variants={child} className="text-[#5F5F67] text-lg leading-relaxed max-w-sm">
            Malaysia&apos;s premier AI-powered mortgage refinance platform. Manage cases, track commissions, and generate professional reports — all in one place.
          </motion.p>

          {/* Stats */}
          <motion.div variants={child} className="grid grid-cols-3 gap-6 pt-4">
            <StatCounter prefix="RM " target={2} suffix="B+" label="Loans Processed" delay={0.4} />
            <StatCounter target={20} suffix="+" label="Years Experience" delay={0.6} />
            <StatCounter target={100} suffix="%" label="Free Review" delay={0.8} />
          </motion.div>

          {/* Quote */}
          <motion.div variants={child} className="border-l-4 border-[#D7263D] pl-4 mt-2">
            <p className="text-[#5F5F67] text-sm italic leading-relaxed">
              &ldquo;The platform that lets us focus on clients, not paperwork.&rdquo;
            </p>
            <p className="text-[#7C7C85] text-xs mt-1 font-medium">— Senior Consultant, QAI</p>
          </motion.div>
        </motion.div>

        <motion.div variants={child} className="relative text-[#7C7C85] text-xs">
          © 2026 Quantify AI Sdn Bhd · SSM: 202501001318
        </motion.div>
      </motion.div>

      {/* ── Right — Form ───────────────────────────────────── */}
      <motion.div
        variants={fadeRight}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
        className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#f6f6f7]"
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-white shadow flex items-center justify-center">
              <span className="text-[#D7263D] font-bold text-lg">Q</span>
            </div>
            <div className="text-[#0A1628] font-bold text-2xl tracking-tight">
              quantify<span className="text-[#D7263D]">.</span>
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="w-full rounded-2xl border border-[#111113]/12 bg-white/90 backdrop-blur-xl shadow-[0_18px_40px_rgba(17,17,19,0.08)] p-8"
          >
            <motion.div variants={child} className="mb-8">
              <h2 className="text-2xl font-bold text-[#0A1628]">Welcome back</h2>
              <p className="text-[#5F5F67] mt-1 text-sm">Sign in to your portal account</p>
            </motion.div>

            {sessionBanner && (
              <motion.div variants={child} className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <svg className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                <span>{sessionBanner}</span>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <motion.div variants={child}>
                <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@quantifyai.me"
                  className="w-full h-11 px-4 rounded-xl border border-[#D8D8DE] bg-white text-[#111113] placeholder:text-[#9C9CA8] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/30 focus:border-[#D7263D] transition-all text-sm"
                />
              </motion.div>

              <motion.div variants={child}>
                <label className="block text-sm font-medium text-[#2E2E34] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-4 pr-10 rounded-xl border border-[#D8D8DE] bg-white text-[#111113] placeholder:text-[#9C9CA8] focus:outline-none focus:ring-2 focus:ring-[#D7263D]/30 focus:border-[#D7263D] transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C7C85] hover:text-[#111113] transition-colors"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={child}>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="w-full h-11 bg-[#D7263D] hover:bg-[#B61F33] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-[0_4px_16px_rgba(215,38,61,0.3)]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : "Sign In"}
                </motion.button>
              </motion.div>
            </form>

            <motion.div variants={child} className="mt-4 text-right">
              <a href="/forgot-password" className="text-xs font-medium text-[#D7263D] hover:underline">
                Forgot password?
              </a>
            </motion.div>

            <motion.div variants={child} className="mt-6 pt-6 border-t border-[#111113]/10 text-center">
              <p className="text-xs text-[#7C7C85]">
                Account access is managed by your administrator.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginPageInner />
    </React.Suspense>
  )
}
