import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const EmptyState = React.forwardRef(({
    icon: Icon,
    title,
    description,
    action,
    actionLabel,
    className,
    variant = "default",
    ...props
}, ref) => {
    const variants = {
        default: "",
        centered: "items-center text-center",
        card: "p-8 rounded-2xl border border-dashed border-border bg-muted/20",
    }

    return (
        <div
            ref={ref}
            className={cn(
                "flex flex-col justify-center py-12 px-4",
                variants[variant],
                className
            )}
            {...props}
        >
            {Icon && (
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-muted-foreground/50" />
                </div>
            )}

            {title && (
                <h3 className="text-lg font-semibold text-foreground mb-1">
                    {title}
                </h3>
            )}

            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                    {description}
                </p>
            )}

            {action && actionLabel && (
                <Button onClick={action} variant="default" className="mx-auto">
                    {actionLabel}
                </Button>
            )}
        </div>
    )
})

EmptyState.displayName = "EmptyState"

export { EmptyState }
