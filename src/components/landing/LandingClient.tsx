"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { ArrowRight, CheckCircle, TrendingDown, Shield, Clock, Zap, ChevronDown, MessageCircle, Star } from "lucide-react"

const ease = [0.25, 0.46, 0.45, 0.94] as const

// ── Count-up ──────────────────────────────────────────────────
function CountUp({ prefix = "", target, suffix = "" }: { prefix?: string; target: number; suffix?: string }) {
  const [val, setVal] = React.useState(0)
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  React.useEffect(() => {
    if (!inView) return
    const duration = 1800
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target])
  return <span ref={ref}>{prefix}{val}{suffix}</span>
}

// ── Fade in on scroll ─────────────────────────────────────────
function FadeIn({ children, delay = 0, y = 30, x = 0, className = "" }: {
  children: React.ReactNode; delay?: number; y?: number; x?: number; className?: string
}) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.65, ease, delay }}
    >{children}</motion.div>
  )
}

// ── Savings card ──────────────────────────────────────────────
function SavingsCard({ amount, detail, total, delay }: { amount: string; detail: string; total: string; delay: number }) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, ease, delay }}
      whileHover={{ y: -6, boxShadow: "0 24px 50px rgba(215,38,61,0.14)" }}
      className="bg-white rounded-2xl border border-[#111113]/8 p-6 cursor-default"
      style={{ boxShadow: "0 4px 24px rgba(17,17,19,0.07)" }}
    >
      <div className="flex items-center gap-1 mb-4">
        {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-[#C9A84C] text-[#C9A84C]" />)}
      </div>
      <div className="text-4xl font-bold text-[#D7263D] mb-1">{amount}</div>
      <div className="text-sm font-semibold text-[#0A1628] mb-2">saved every month</div>
      <div className="text-xs text-[#5F5F67] leading-relaxed mb-4">{detail}</div>
      <div className="pt-3 border-t border-[#111113]/8 flex justify-between items-center">
        <span className="text-xs text-[#5F5F67]">Total interest saved</span>
        <span className="text-xs font-bold text-[#0A1628]">{total}</span>
      </div>
    </motion.div>
  )
}

// ── Step card ─────────────────────────────────────────────────
function StepCard({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, ease, delay }}
      className="flex gap-5"
    >
      <div className="flex-shrink-0 h-11 w-11 rounded-full bg-[#D7263D] text-white font-bold text-base flex items-center justify-center shadow-[0_4px_16px_rgba(215,38,61,0.4)]">
        {num}
      </div>
      <div className="pt-1">
        <h3 className="font-bold text-[#0A1628] mb-2 text-lg">{title}</h3>
        <p className="text-[#5F5F67] leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Service card ──────────────────────────────────────────────
function ServiceCard({ icon: Icon, title, desc, delay }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string; delay: number
}) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay }}
      whileHover={{ y: -5, boxShadow: "0 16px 40px rgba(17,17,19,0.1)" }}
      className="bg-white rounded-2xl border border-[#111113]/8 p-7 group transition-shadow"
      style={{ boxShadow: "0 2px 16px rgba(17,17,19,0.05)" }}
    >
      <div className="h-12 w-12 rounded-xl bg-[#D7263D]/8 flex items-center justify-center mb-5 group-hover:bg-[#D7263D]/14 transition-colors">
        <Icon className="h-6 w-6 text-[#D7263D]" />
      </div>
      <h3 className="font-bold text-[#0A1628] mb-2 text-lg">{title}</h3>
      <p className="text-[#5F5F67] leading-relaxed text-sm">{desc}</p>
    </motion.div>
  )
}

// ── Why card ──────────────────────────────────────────────────
function WhyCard({ icon: Icon, title, desc, delay }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string; delay: number
}) {
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease, delay }}
      className="flex gap-4"
    >
      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-[#0A1628] flex items-center justify-center shadow-[0_4px_12px_rgba(10,22,40,0.2)]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h4 className="font-bold text-[#0A1628] mb-1">{title}</h4>
        <p className="text-sm text-[#5F5F67] leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  )
}

// ── Label chip ────────────────────────────────────────────────
function Chip({ children, red }: { children: React.ReactNode; red?: boolean }) {
  return (
    <div className={`inline-block text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4 ${red ? "bg-[#D7263D]/8 text-[#D7263D]" : "bg-[#0A1628]/6 text-[#0A1628]"}`}>
      {children}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
interface CmsData {
  logo_url?: string
  company_name?: string
  tagline?: string
  hero?: { headline?: string; subheadline?: string; cta_text?: string; cta_url?: string }
  contact?: { email?: string; phone?: string; address?: string }
  stats?: { loans_processed?: string; experience?: string; clients?: string; avg_monthly_savings?: string }
  why_us?: { title?: string; body?: string }
  cta_section?: { headline?: string; subtitle?: string }
  how_it_works?: {
    step1_title?: string; step1_desc?: string
    step2_title?: string; step2_desc?: string
    step3_title?: string; step3_desc?: string
  }
}

export default function LandingClient({ cms }: { cms: CmsData }) {
  const heroRef = React.useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const [navScrolled, setNavScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const ctaUrl = cms.hero?.cta_url ?? "/calculate"
  const phone = cms.contact?.phone ?? "+60126181683"
  const email = cms.contact?.email ?? "hello@quantifyai.me"
  const address = cms.contact?.address ?? "147-2, Jalan Radin Bagus, Bandar Baru Sri Petaling, 57000 KL"
  const companyName = cms.company_name ?? "QuantifyAI"
  const logoUrl = cms.logo_url ?? ""
  const heroHeadline = cms.hero?.headline ?? "Your Mortgage is Costing You More Than It Should"
  const heroSub = cms.hero?.subheadline ?? "Malaysia's most trusted AI-powered refinancing specialist. Free analysis. Real savings. Zero upfront fees — our fee is paid by the bank."
  const ctaText = cms.hero?.cta_text ?? "Get Free Analysis"
  const whyTitle = cms.why_us?.title ?? "Not just a broker. Your financial ally."
  const whyBody = cms.why_us?.body ?? "Most brokers push you toward whichever bank pays them the most. We built AI to eliminate that bias — and our 20+ years in the Malaysian mortgage market means we know every nuance of the system."
  const ctaHeadline = cms.cta_section?.headline ?? "Ready to save RM 526 every month?"
  const ctaSub = cms.cta_section?.subtitle ?? "Your free analysis takes under 3 minutes. No commitment required."
  const hi = cms.how_it_works ?? {}

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-[#111113] font-sans overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${navScrolled ? "bg-white/92 backdrop-blur-xl border-b border-[#111113]/8 shadow-[0_2px_20px_rgba(17,17,19,0.06)]" : ""}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease }}>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white shadow-[0_2px_12px_rgba(215,38,61,0.2)] flex items-center justify-center overflow-hidden">
                {logoUrl
                  ? <Image src={logoUrl} alt={companyName} width={32} height={32} className="object-contain p-0.5" unoptimized />
                  : <span className="font-bold text-sm text-[#D7263D]">Q</span>
                }
              </div>
              <span className="font-bold tracking-tight text-lg text-[#0A1628]">{companyName}</span>
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="hidden md:flex items-center gap-6">
            {[["About", "#about"], ["Services", "#services"], ["How It Works", "#how-it-works"], ["Contact", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="text-sm font-medium text-[#5F5F67] hover:text-[#0A1628] transition-colors">{l}</a>
            ))}
            <Link href="/login" className="text-sm font-medium text-[#5F5F67] hover:text-[#0A1628] transition-colors">Consultant Login</Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link href={ctaUrl} className="text-sm font-semibold bg-[#D7263D] text-white px-4 py-2 rounded-full hover:bg-[#B61F33] transition-colors shadow-[0_4px_14px_rgba(215,38,61,0.35)]">
                Free Analysis →
              </Link>
            </motion.div>
          </motion.div>

          <button className="md:hidden p-2 text-[#0A1628]" onClick={() => setMobileOpen(!mobileOpen)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }} className="md:hidden bg-white/95 backdrop-blur-xl border-t border-[#111113]/8 overflow-hidden">
              <div className="px-6 py-4 space-y-3">
                {[["About", "#about"], ["Services", "#services"], ["How It Works", "#how-it-works"], ["Contact", "#contact"], ["Consultant Login", "/login"]].map(([l, h]) => (
                  <a key={h} href={h} onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-[#5F5F67] hover:text-[#0A1628] py-1">{l}</a>
                ))}
                <Link href={ctaUrl} className="block text-sm font-semibold text-center bg-[#D7263D] text-white px-4 py-2.5 rounded-full mt-2">
                  Free Analysis →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Background photo — modern Malaysian home */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=75"
            alt="Modern home"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, rgba(249,249,251,0.92) 0%, rgba(241,241,244,0.97) 100%)"
          }} />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,38,61,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(215,38,61,0.035) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }} />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(215,38,61,0.08) 0%, transparent 70%)" }}
        />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-4xl mx-auto text-center pt-24">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white border border-[#D7263D]/20 rounded-full px-4 py-1.5 text-xs font-semibold text-[#D7263D] mb-8 shadow-[0_2px_12px_rgba(215,38,61,0.1)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D7263D] animate-pulse" />
            QAI Saver Program · RM 2B+ in loans processed
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-[#0A1628] leading-[1.1]">
            {heroHeadline.includes("Costing") ? (
              <>Your Mortgage is{" "}
                <span className="relative inline-block">
                  <span className="text-[#D7263D]">Costing You More</span>
                  <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, ease, delay: 0.85 }}
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#D7263D]/30 origin-left" />
                </span>
                {" "}Than It Should</>
            ) : heroHeadline}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease, delay: 0.35 }}
            className="text-lg md:text-xl text-[#5F5F67] mb-10 max-w-2xl mx-auto leading-relaxed">
            {heroSub}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link href={ctaUrl} className="flex items-center gap-2 px-8 py-4 rounded-full bg-[#D7263D] text-white font-semibold hover:bg-[#B61F33] transition-colors shadow-[0_8px_24px_rgba(215,38,61,0.38)] text-sm">
                {ctaText} <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <a href="#how-it-works" className="flex items-center gap-2 px-8 py-4 rounded-full bg-white border border-[#111113]/15 text-[#0A1628] font-semibold hover:bg-[#F1F1F4] transition-colors text-sm">
                See how it works <ChevronDown className="h-4 w-4" />
              </a>
            </motion.div>
          </motion.div>

          {/* Floating stat badge */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.75 }}
            className="mt-14 inline-flex items-center gap-6 bg-white rounded-2xl px-6 py-4 border border-[#111113]/8 shadow-[0_8px_32px_rgba(17,17,19,0.08)]">
            <div className="text-left">
              <div className="text-2xl font-bold text-[#D7263D]">RM <CountUp target={526} />/mo</div>
              <div className="text-xs text-[#5F5F67] mt-0.5">Average monthly savings per client</div>
            </div>
            <div className="h-10 w-px bg-[#111113]/10" />
            <div className="text-left">
              <div className="text-2xl font-bold text-[#0A1628]"><CountUp target={100} suffix="%" /></div>
              <div className="text-xs text-[#5F5F67] mt-0.5">Free to you · always</div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown className="h-6 w-6 text-[#5F5F67]" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Trust ticker ───────────────────────────────────────── */}
      <div className="bg-[#0A1628] py-4 overflow-hidden">
        <motion.div animate={{ x: [0, "-50%"] }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="flex items-center gap-12 whitespace-nowrap w-max">
          {[...Array(2)].map((_, ri) => (
            <React.Fragment key={ri}>
              {["RM 2B+ Loans Processed", "20+ Years of Expertise", "100% Free Client Review", "QAI Saver Program", "Avg. RM 526/month Saved", "AI-Powered Analysis", "Zero Upfront Fees"].map((item) => (
                <span key={item + ri} className="flex items-center gap-3 text-sm font-medium text-white/70">
                  <span className="h-1 w-1 rounded-full bg-[#D7263D]" />{item}
                </span>
              ))}
            </React.Fragment>
          ))}
        </motion.div>
      </div>

      {/* ── Real Savings ───────────────────────────────────────── */}
      <section id="about" className="py-20 md:py-28 px-6 bg-[#f1f1f4]">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Chip red>Real Results</Chip>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A1628] mb-4">Real Clients. Real Savings.</h2>
            <p className="text-[#5F5F67] text-lg max-w-xl mx-auto">
              These aren&apos;t estimates — actual savings from Malaysian homeowners who refinanced through QAI.
            </p>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <SavingsCard amount="RM 481" detail="Refinanced from 4.5% → 3.2%. Same property, smarter terms." total="RM 173,160" delay={0} />
            <SavingsCard amount="RM 421" detail="Consolidated 3 separate loans into one lower-rate facility." total="RM 151,560" delay={0.12} />
            <SavingsCard amount="RM 677" detail="Cash-out refinance — received cash AND lowered monthly payment." total="RM 243,720" delay={0.24} />
          </div>
          <div className="grid grid-cols-3 gap-8 mt-16">
            {[
              { p: "RM ", t: 2, s: "B+", l: "Loans processed via QAI Saver Program" },
              { p: "", t: 20, s: "+", l: "Years of mortgage industry experience" },
              { p: "", t: 5000, s: "+", l: "Satisfied clients across Malaysia" },
            ].map((stat, i) => (
              <FadeIn key={i} delay={i * 0.12} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[#0A1628] mb-2">
                  <CountUp prefix={stat.p} target={stat.t} suffix={stat.s} />
                </div>
                <p className="text-sm text-[#5F5F67]">{stat.l}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Chip>Simple Process</Chip>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A1628] mb-4">From analysis to savings in 3 steps</h2>
            <p className="text-[#5F5F67] text-lg max-w-xl mx-auto">We handle the complexity. You collect the savings.</p>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="max-w-xl space-y-10">
            <StepCard num="1" title={hi.step1_title ?? "Free AI-Powered Analysis"} desc={hi.step1_desc ?? "Share your current loan details. Our AI instantly compares your position against 20+ Malaysian banks to find your optimal refinancing path."} delay={0} />
            <StepCard num="2" title={hi.step2_title ?? "Custom Savings Strategy"} desc={hi.step2_desc ?? "Your dedicated QAI consultant presents a personalised report showing exactly how much you save — monthly and over the full loan tenure."} delay={0.12} />
            <StepCard num="3" title={hi.step3_title ?? "We Handle Everything — Free"} desc={hi.step3_desc ?? "We manage all paperwork, bank submissions, and legal coordination. Zero fees upfront — our commission comes from the bank upon your approval."} delay={0.24} />
          </div>

          {/* Right: illustration photo */}
          <FadeIn x={40} className="hidden md:block">
            <div className="relative rounded-3xl overflow-hidden h-[480px] shadow-[0_24px_64px_rgba(17,17,19,0.1)]">
              <Image
                src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80"
                alt="Financial planning consultation"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#D7263D]/10 to-transparent" />
              <div className="absolute top-5 left-5 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 shadow-lg">
                <p className="text-xs text-[#5F5F67]">Analysis complete</p>
                <p className="text-base font-black text-[#D7263D]">RM 481 saved</p>
                <p className="text-[10px] text-[#7C7C85]">per month · starting immediately</p>
              </div>
            </div>
          </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────────── */}
      <section id="services" className="py-20 md:py-28 px-6 bg-[#f1f1f4]">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Chip red>Our Services</Chip>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0A1628] mb-4">Every path to savings, covered</h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <ServiceCard icon={TrendingDown} title="Home Loan Refinancing" desc="Lower your interest rate, reduce monthly payments, and save hundreds every month. We compare all major Malaysian banks for your best deal." delay={0} />
            <ServiceCard icon={Zap} title="Cash-Out Refinancing" desc="Access your home equity for renovations, education, or investments — while potentially lowering your rate at the same time." delay={0.12} />
            <ServiceCard icon={Shield} title="Debt Consolidation" desc="Merge multiple high-interest loans into one lower-rate facility. Simplify your finances and free up monthly cash flow." delay={0.24} />
          </div>
        </div>
      </section>

      {/* ── Why QAI ─────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-6 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left: photo + text */}
          <FadeIn y={20} className="space-y-6">
            <div className="relative rounded-3xl overflow-hidden h-72 md:h-96 shadow-[0_24px_64px_rgba(17,17,19,0.12)]">
              <Image
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=900&q=80"
                alt="Happy homeowner"
                fill
                className="object-cover object-center"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/30 to-transparent" />
              {/* Floating badge */}
              <div className="absolute bottom-5 left-5 right-5">
                <div className="bg-white/95 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
                  <div className="h-10 w-10 rounded-xl bg-[#D7263D] flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0A1628]">Average client saves</p>
                    <p className="text-lg font-black text-[#D7263D]">RM 526 / month</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Chip>Why QuantifyAI</Chip>
              <h2 className="text-3xl md:text-4xl font-bold text-[#0A1628] mb-4">{whyTitle.includes("broker") ? <>{whyTitle.split(".")[0]}.<br />{whyTitle.split(".").slice(1).join(".").trim()}</> : whyTitle}</h2>
              <p className="text-[#5F5F67] text-lg leading-relaxed">{whyBody}</p>
            </div>
          </FadeIn>
          {/* Right: 4 cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <WhyCard icon={Zap} title="AI-Powered Comparison" desc="Instantly analyse your position against 20+ banks. No guesswork, no bias." delay={0} />
            <WhyCard icon={Clock} title="20+ Years Expertise" desc="Deep Malaysian market knowledge you simply can't replace with an app." delay={0.1} />
            <WhyCard icon={Shield} title="Zero Upfront Fees" desc="We earn only when you succeed. Our fee is paid by your new bank." delay={0.2} />
            <WhyCard icon={CheckCircle} title="Dedicated Consultant" desc="A real human guides you through every single step of the process." delay={0.3} />
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section id="contact" className="py-24 px-6 bg-[#0A1628] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(215,38,61,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(215,38,61,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }} />
        <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.6, 0.35] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(215,38,61,0.18) 0%, transparent 70%)" }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <FadeIn>
            <div className="inline-block bg-[#D7263D]/20 text-[#D7263D] text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">Start Saving Today</div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {ctaHeadline.includes("526") ? (
                <>Ready to save<br /><span className="text-[#D7263D]">RM 526 every month?</span></>
              ) : ctaHeadline}
            </h2>
            <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">{ctaSub}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Link href="/calculate" className="flex items-center gap-2 px-8 py-4 rounded-full bg-[#D7263D] text-white font-semibold hover:bg-[#B61F33] transition-colors shadow-[0_8px_28px_rgba(215,38,61,0.45)] text-sm">
                  Run Free Calculator <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-8 py-4 rounded-full bg-[#25D366] text-white font-semibold hover:bg-[#1fb859] transition-colors text-sm">
                  <MessageCircle className="h-4 w-4" /> WhatsApp Us
                </a>
              </motion.div>
            </div>
          </FadeIn>
          <FadeIn delay={0.2} className="mt-12 pt-10 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-white/40">
            <span>{email}</span>
            <span>{phone}</span>
            <span>{address}</span>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-[#060f1c] py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-white/8 flex items-center justify-center overflow-hidden">
              {logoUrl
                ? <Image src={logoUrl} alt={companyName} width={28} height={28} className="object-contain" unoptimized />
                : <span className="font-bold text-xs text-[#D7263D]">Q</span>
              }
            </div>
            <span className="font-semibold text-white tracking-tight">{companyName}</span>
            <span className="text-white/30 text-xs">· Sdn Bhd</span>
          </div>
          <p className="text-white/30 text-xs text-center">
            © {new Date().getFullYear()} QuantifyAI Sdn Bhd · SSM: 202501001318 · All rights reserved.
          </p>
          <div className="flex gap-5">
            {[["About", "#about"], ["Services", "#services"], ["Login", "/login"]].map(([l, h]) => (
              <a key={h} href={h} className="text-white/35 hover:text-white/70 text-xs transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
