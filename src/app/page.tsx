import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import LandingClient from "@/components/landing/LandingClient"

export const revalidate = 60

export default async function PublicLandingPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data } = await supabase.from("cms_content").select("*")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cms = (data || []).reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value
    return acc
  }, {})

  return <LandingClient cms={cms} />
}
