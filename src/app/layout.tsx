import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "QuantifyAI — Mortgage Refinance Portal",
    template: "%s | QuantifyAI",
  },
  description:
    "QuantifyAI is Malaysia's premier mortgage refinance agency portal. Quantifying Success, Simplifying Finance.",
  keywords: ["mortgage", "refinance", "Malaysia", "bank loan", "property finance"],
  authors: [{ name: "QuantifyAI" }],
  creator: "QuantifyAI",
  openGraph: {
    type: "website",
    locale: "en_MY",
    url: "https://quantifyai.me",
    siteName: "QuantifyAI",
    title: "QuantifyAI — Quantifying Success, Simplifying Finance",
    description: "Malaysia's premier mortgage refinance agency portal",
  },
  robots: {
    index: false, // Portal is private
    follow: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="h-full font-sans bg-[#f6f6f7] text-[#111113]"
        style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
