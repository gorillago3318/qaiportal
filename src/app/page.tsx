import Link from "next/link"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const revalidate = 60 // Revalidate cached data every 60 seconds

export default async function PublicLandingPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // Fetch CMS content (or fallback defaults if the migration isn't run yet)
  const { data } = await supabase.from('cms_content').select('*')
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cms = (data || []).reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value
    return acc
  }, {})

  const hero = cms.hero || {
    headline: "Refinance Smarter. Save More.",
    subheadline: "Malaysia's most powerful mortgage refinance calculator. Free, instant, and accurate.",
    cta_text: "Free Calculator",
    cta_url: "/calculate"
  }
  
  const about = cms.about || {
    title: "About QuantifyAI",
    body: "We help Malaysians make smarter mortgage decisions through AI-powered calculations and expert consultation.",
    stats: [
      { label: "Calculations Done", value: "10,000+" },
      { label: "Money Saved", value: "RM 50M+" },
      { label: "Happy Clients", value: "5,000+" }
    ]
  }

  const contact = cms.contact || {
    email: "hello@quantifyai.me",
    phone: "+60 3-1234 5678",
    address: "Kuala Lumpur, Malaysia"
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-[#111113] font-sans selection:bg-[#D7263D]/20 selection:text-[#111113]">
      {/* Navbar */}
      <nav className="fixed top-0 w-full border-b border-[#111113]/10 bg-white/75 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
              <span className="font-bold text-sm text-black">Q</span>
            </div>
            <span className="font-bold tracking-tight text-lg">QuantifyAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-[#5F5F67] hover:text-[#111113] transition-colors">
              Consultant Login
            </Link>
            <Link href={hero.cta_url} className="text-sm font-semibold bg-[#D7263D] text-white px-4 py-2 rounded-full hover:bg-[#B61F33] transition-colors">
              {hero.cta_text}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-white/10 blur-[160px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold font-heading tracking-tight mb-6 text-[#111113]">
            {hero.headline}
          </h1>
          <p className="text-lg md:text-xl text-[#5F5F67] mb-10 max-w-2xl mx-auto leading-relaxed">
            {hero.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={hero.cta_url} className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#D7263D] text-white font-semibold hover:bg-[#B61F33] hover:scale-105 transition-all">
              {hero.cta_text}
            </Link>
            <Link href="#about" className="w-full sm:w-auto px-8 py-4 rounded-full bg-white border border-[#111113]/15 text-[#111113] font-semibold hover:bg-[#F1F1F4] transition-colors">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 border-t border-[#111113]/10 bg-[#F1F1F4]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-heading mb-6">{about.title}</h2>
          <p className="text-[#5F5F67] text-lg max-w-2xl mx-auto mb-16 leading-relaxed">
            {about.body}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {about.stats?.map((s: any, i: number) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-[#111113]/10 backdrop-blur-xl">
                <p className="text-4xl font-bold text-[#111113] mb-2">{s.value}</p>
                <p className="text-sm text-[#5F5F67] uppercase tracking-widest font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#111113]/10 bg-white py-12 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center text-center md:text-left">
          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start mb-4">
              <div className="h-6 w-6 rounded border border-white/20 bg-white/90 flex items-center justify-center">
                <span className="font-bold text-[10px] text-black">Q</span>
              </div>
              <span className="font-semibold tracking-tight text-[#111113]">QuantifyAI</span>
            </div>
            <p className="text-[#5F5F67] text-sm">Empowering financial decisions.</p>
          </div>
          <div className="md:items-end flex flex-col gap-2 text-[#5F5F67] text-sm">
            <p>{contact.email}</p>
            <p>{contact.phone}</p>
            <p>{contact.address}</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-[#111113]/10 text-center text-[#7C7C85] text-xs">
          © {new Date().getFullYear()} QuantifyAI Sdn Bhd. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
