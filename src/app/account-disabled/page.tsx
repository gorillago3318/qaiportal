import Link from "next/link"
import { AlertOctagon } from "lucide-react"

export default function AccountDisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f6f7] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#111113]/10 p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <AlertOctagon className="h-6 w-6 text-[#D7263D]" />
        </div>
        <h1 className="font-heading text-xl font-bold text-[#0A1628]">Account disabled</h1>
        <p className="text-sm text-gray-500 mt-2">
          Your account has been deactivated by your administrator. Please contact them to restore access.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm font-medium text-[#D7263D] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
