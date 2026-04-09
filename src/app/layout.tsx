import type { Metadata } from "next"
import { DM_Sans, Playfair_Display } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
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
      className={`${dmSans.variable} ${playfairDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="h-full font-sans bg-[#F8F9FA] text-[#0A1628]"
        style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
