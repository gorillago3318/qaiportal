import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { type CaseStatus } from "@/types/database"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#F3F4F6] text-[#374151]",
        secondary: "bg-[#EFF6FF] text-[#1D4ED8]",
        outline: "border border-[#E5E7EB] text-[#374151] bg-transparent",
        // Case statuses
        draft: "bg-[#F3F4F6] text-[#4B5563]",
        submitted: "bg-[#EFF6FF] text-[#1D4ED8]",
        bank_processing: "bg-[#EEF2FF] text-[#4338CA]",
        kiv: "bg-[#FFFBEB] text-[#B45309]",
        approved: "bg-[#ECFDF5] text-[#065F46]",
        declined: "bg-[#FEF2F2] text-[#991B1B]",
        accepted: "bg-[#D1FAE5] text-[#064E3B]",
        rejected: "bg-[#FFF1F2] text-[#9F1239]",
        payment_pending: "bg-[#FFF7ED] text-[#C2410C]",
        paid: "bg-[#F0FDFA] text-[#0F766E]",
        // Loan types
        refinance: "bg-[#EFF6FF] text-[#1D4ED8]",
        subsale: "bg-[#F5F3FF] text-[#6D28D9]",
        developer: "bg-[#ECFDF5] text-[#065F46]",
        // Commission status
        pending: "bg-[#F3F4F6] text-[#6B7280]",
        calculated: "bg-[#EFF6FF] text-[#1D4ED8]",
        // Roles
        gold: "bg-[#FEF3C7] text-[#92400E]",
        navy: "bg-[#EEF1F7] text-[#0A1628]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Convenience component for case statuses
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const labels: Record<CaseStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    bank_processing: "Bank Processing",
    kiv: "KIV",
    approved: "Approved",
    declined: "Declined",
    accepted: "Accepted",
    rejected: "Rejected",
    payment_pending: "Payment Pending",
    paid: "Paid",
  }

  return (
    <Badge variant={status}>
      {labels[status]}
    </Badge>
  )
}

export { Badge, badgeVariants }
