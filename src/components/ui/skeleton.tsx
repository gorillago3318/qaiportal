import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[#E5E7EB]",
        className
      )}
      {...props}
    />
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  )
}

function SkeletonTableRow() {
  return (
    <div className="flex items-center space-x-4 py-3 px-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-4 w-28 ml-auto" />
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTableRow }
