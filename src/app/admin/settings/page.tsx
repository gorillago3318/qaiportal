import { Settings, Building2, Percent, Landmark, Scale } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const settingsSections = [
  {
    icon: Percent,
    title: "Commission Tier Config",
    description: "Configure percentage splits for each agent tier (Company, AM, UM, SA, Agent)",
    color: "text-[#6366F1]",
    bg: "bg-[#EEF2FF]",
    status: "Coming soon",
  },
  {
    icon: Landmark,
    title: "Banks",
    description: "Manage the list of banks and their commission rates",
    color: "text-[#3B82F6]",
    bg: "bg-[#EFF6FF]",
    status: "Coming soon",
  },
  {
    icon: Scale,
    title: "Panel Lawyers",
    description: "Add and manage panel lawyers with their fee structures (LA, SPA, MOT)",
    color: "text-[#10B981]",
    bg: "bg-[#ECFDF5]",
    status: "Coming soon",
  },
  {
    icon: Building2,
    title: "Company Profile",
    description: "Update QuantifyAI company information and branding",
    color: "text-[#C9A84C]",
    bg: "bg-[#FFFBEB]",
    status: "Coming soon",
  },
]

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#0A1628]">Settings</h1>
        <p className="text-[#6B7280] text-sm mt-1">Configure commission tiers, banks, and platform settings</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="hover:shadow-card-hover transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 ${section.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                        {section.status}
                      </span>
                    </div>
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {/* Current config placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#EEF1F7] rounded-xl flex items-center justify-center">
              <Settings className="h-5 w-5 text-[#0A1628]" />
            </div>
            <div>
              <CardTitle>Current Commission Tiers</CardTitle>
              <CardDescription>Default configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: "Company", percentage: "10%", description: "Top-level cut" },
              { role: "Agency Manager", percentage: "92.5%", description: "of net distributable" },
              { role: "Unit Manager", percentage: "87.5%", description: "of net distributable" },
              { role: "Senior Agent", percentage: "80%", description: "of net distributable" },
              { role: "Agent", percentage: "70%", description: "of net distributable" },
            ].map((tier) => (
              <div
                key={tier.role}
                className="flex items-center justify-between py-3 px-4 bg-[#F8F9FA] rounded-xl border border-[#E5E7EB]"
              >
                <div>
                  <p className="font-medium text-sm text-[#0A1628]">{tier.role}</p>
                  <p className="text-xs text-[#6B7280]">{tier.description}</p>
                </div>
                <span className="font-heading font-bold text-[#0A1628] text-lg">{tier.percentage}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
