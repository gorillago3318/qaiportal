"use client"

import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          color: "#0A1628",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: "0.875rem",
          borderRadius: "0.75rem",
          boxShadow: "0 4px 6px -1px rgba(10,22,40,0.08), 0 2px 4px -2px rgba(10,22,40,0.04)",
        },
        classNames: {
          success: "!border-[#10B981] !text-[#065F46]",
          error: "!border-[#EF4444] !text-[#991B1B]",
          warning: "!border-[#F59E0B] !text-[#92400E]",
          info: "!border-[#3B82F6] !text-[#1D4ED8]",
        },
      }}
      richColors
    />
  )
}
