import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "border-input bg-background hover:border-primary/30",
    glass: "bg-white/90 border-border hover:border-primary/30",
    filled: "border-transparent bg-muted hover:bg-muted/80 focus:bg-background focus:border-input",
    chat: "border-0 bg-transparent resize-none focus:ring-0 focus:outline-none",
  }

  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border-2 px-4 py-3 text-sm transition-all duration-200",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant] || variants.default,
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
