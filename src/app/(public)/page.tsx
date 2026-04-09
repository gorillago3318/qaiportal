import Link from "next/link"

export default function PublicHomePage() {
  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center text-center px-6">
      <div className="max-w-lg">
        {/* Logo */}
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-[#C9A84C] flex items-center justify-center">
            <span className="text-[#0A1628] font-heading font-bold text-2xl">Q</span>
          </div>
          <div className="text-left">
            <div className="font-heading font-bold text-white text-4xl">
              quantify<span className="text-[#C9A84C]">.</span>
            </div>
            <div className="text-[#5373A6] text-xs uppercase tracking-widest">artificial intelligence</div>
          </div>
        </div>

        <h1 className="font-heading text-white text-3xl font-semibold mb-4">
          Quantifying Success,<br />
          <span className="text-[#C9A84C]">Simplifying Finance</span>
        </h1>
        <p className="text-[#5373A6] mb-10">
          Malaysia&apos;s premier mortgage refinance portal — connecting agents, clients, and banks.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#C9A84C] text-[#0A1628] font-semibold text-sm hover:bg-[#B8912A] transition-colors"
          >
            Agent Login
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl border border-[#1E3A5F] text-white font-semibold text-sm hover:bg-[#142847] transition-colors"
          >
            Admin Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
