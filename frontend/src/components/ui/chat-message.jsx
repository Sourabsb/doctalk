import * as React from "react"
import { Copy, Check, Volume2, VolumeX, Edit2, Trash2, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const ChatMessage = React.forwardRef(({
    role,
    content,
    timestamp,
    avatar,
    avatarFallback,
    actions = {},
    isStreaming = false,
    editHistory = null,
    editIndex = 0,
    className,
    children,
    ...props
}, ref) => {
    const [copied, setCopied] = React.useState(false)
    const [showActions, setShowActions] = React.useState(false)
    const isUser = role === "user"

    const handleCopy = async () => {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <TooltipProvider>
            <div
                ref={ref}
                className={cn(
                    "group relative flex gap-3 py-4 px-4 rounded-2xl transition-all duration-200",
                    "hover:bg-muted/30",
                    isUser && "flex-row-reverse",
                    className
                )}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                {...props}
            >
                {/* Avatar */}
                <Avatar size="sm" className="shrink-0 mt-0.5">
                    {avatar && <AvatarImage src={avatar} />}
                    <AvatarFallback variant={isUser ? "primary" : "default"}>
                        {avatarFallback || (isUser ? "U" : "AI")}
                    </AvatarFallback>
                </Avatar>

                {/* Message Content */}
                <div className={cn("flex flex-col max-w-[80%]", isUser && "items-end")}>
                    {/* Message Bubble */}
                    <div
                        className={cn(
                            "relative px-4 py-3 text-sm leading-relaxed",
                            isUser
                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-amber-500/20"
                                : "bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-border/50 dark:border-white/10 rounded-2xl rounded-tl-sm shadow-md",
                            isStreaming && "streaming-cursor"
                        )}
                    >
                        {children || (
                            <div className={cn("prose prose-sm max-w-none", isUser ? "prose-invert" : "dark:prose-invert")}>
                                {content}
                            </div>
                        )}
                    </div>

                    {/* Bottom Row: Timestamp, Edit Navigation, Actions */}
                    <div className={cn(
                        "flex items-center gap-3 mt-2 px-1",
                        isUser ? "flex-row-reverse" : "flex-row"
                    )}>
                        {/* Timestamp */}
                        {timestamp && (
                            <span className="text-[10px] text-muted-foreground">
                                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        {/* Edit History Navigation */}
                        {editHistory && editHistory.length > 1 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-5 w-5"
                                    onClick={actions.onPrevVersion}
                                    disabled={editIndex <= 0}
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {editIndex + 1}/{editHistory.length}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-5 w-5"
                                    onClick={actions.onNextVersion}
                                    disabled={editIndex >= editHistory.length - 1}
                                >
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className={cn(
                            "flex items-center gap-0.5 transition-opacity duration-200",
                            showActions ? "opacity-100" : "opacity-0"
                        )}>
                            {/* Copy */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        onClick={handleCopy}
                                    >
                                        {copied ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <Copy className="h-3 w-3" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent variant="glass" side="top">
                                    {copied ? "Copied!" : "Copy"}
                                </TooltipContent>
                            </Tooltip>

                            {/* Speak */}
                            {actions.onSpeak && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className={cn(
                                                "h-6 w-6 text-muted-foreground hover:text-foreground",
                                                actions.isSpeaking && "text-primary"
                                            )}
                                            onClick={actions.onSpeak}
                                        >
                                            {actions.isSpeaking ? (
                                                <VolumeX className="h-3 w-3" />
                                            ) : (
                                                <Volume2 className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent variant="glass" side="top">
                                        {actions.isSpeaking ? "Stop" : "Read aloud"}
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {/* More Actions */}
                            {(actions.onEdit || actions.onDelete) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                        >
                                            <MoreVertical className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={isUser ? "end" : "start"} className="w-40">
                                        {actions.onEdit && (
                                            <DropdownMenuItem onClick={actions.onEdit}>
                                                <Edit2 className="h-3.5 w-3.5 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                        )}
                                        {actions.onDelete && (
                                            <DropdownMenuItem
                                                onClick={actions.onDelete}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
})

ChatMessage.displayName = "ChatMessage"

// Loading message with animated dots
const ChatMessageLoading = ({ className, ...props }) => (
    <div className={cn("flex gap-3 py-4 px-4", className)} {...props}>
        <Avatar size="sm" className="shrink-0 mt-0.5">
            <AvatarFallback>AI</AvatarFallback>
        </Avatar>
        <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-border/50 dark:border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
            <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    </div>
)

ChatMessageLoading.displayName = "ChatMessageLoading"

export { ChatMessage, ChatMessageLoading }
