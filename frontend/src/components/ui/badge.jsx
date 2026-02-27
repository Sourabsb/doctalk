import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-sm",
        outline:
          "text-foreground border-border",
        success:
          "border-transparent bg-emerald-100 text-emerald-700",
        warning:
          "border-transparent bg-[#f5f5f4] text-[#c4684a]",
        info:
          "border-transparent bg-blue-100 text-blue-700",
        cloud:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        local:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        premium:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        glass:
          "border-white/20 bg-white/10 backdrop-blur-sm text-foreground",
        dot:
          "border-transparent bg-transparent text-muted-foreground pl-0",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-px text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({ className, variant, size, children, dot, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full mr-1",
            variant === "success" && "bg-emerald-500",
            variant === "warning" && "bg-[#d97757]",
            variant === "info" && "bg-blue-500",
            variant === "destructive" && "bg-red-500",
            !variant && "bg-primary"
          )}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
