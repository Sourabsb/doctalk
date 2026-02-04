import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, variant = "default", ...props }, ref) => {
  const variants = {
    default: "border-input bg-background hover:border-primary/30",
    glass: "bg-white/50 dark:bg-white/5 backdrop-blur-xl border-white/30 dark:border-white/10 hover:border-primary/30",
    filled: "border-transparent bg-muted hover:bg-muted/80 focus:bg-background focus:border-input",
  }

  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border-2 px-4 py-2 text-sm transition-all duration-200",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
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
Input.displayName = "Input"

export { Input }
