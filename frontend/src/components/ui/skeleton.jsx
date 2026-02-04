import { cn } from "@/lib/utils"

function Skeleton({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-muted",
    shimmer: "bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer",
    pulse: "bg-muted animate-pulse",
  }

  return (
    <div
      className={cn(
        "rounded-lg",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
}

function SkeletonText({ className, lines = 3, ...props }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="shimmer"
          className={cn(
            "h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border p-6 space-y-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <Skeleton variant="shimmer" className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="shimmer" className="h-4 w-32" />
          <Skeleton variant="shimmer" className="h-3 w-24" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

function SkeletonMessage({ className, side = "left", ...props }) {
  return (
    <div
      className={cn(
        "flex gap-3",
        side === "right" && "flex-row-reverse",
        className
      )}
      {...props}
    >
      <Skeleton variant="pulse" className="h-8 w-8 rounded-full shrink-0" />
      <div className={cn("space-y-2 flex-1", side === "right" && "flex flex-col items-end")}>
        <Skeleton
          variant="shimmer"
          className={cn(
            "h-20 rounded-2xl",
            side === "left" ? "w-3/4 rounded-tl-sm" : "w-2/3 rounded-tr-sm"
          )}
        />
      </div>
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonMessage }
