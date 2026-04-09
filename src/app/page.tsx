import { redirect } from "next/navigation"

// Root page redirects to the public homepage
export default function RootPage() {
  redirect("/login")
}
