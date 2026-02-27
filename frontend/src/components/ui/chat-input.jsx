import * as React from "react"
import { Send, Mic, MicOff, Paperclip, Square, Sparkles, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const ChatInput = React.forwardRef(({
    value,
    onChange,
    onSubmit,
    onFileClick,
    onVoiceClick,
    onStopGeneration,
    isLoading = false,
    isRecording = false,
    isStreaming = false,
    placeholder = "Ask anything about your documents...",
    className,
    disabled = false,
    maxRows = 6,
    ...props
}, ref) => {
    const textareaRef = React.useRef(null)
    const [rows, setRows] = React.useState(1)

    // Auto-resize textarea
    React.useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.style.height = 'auto'
        const lineHeight = 24
        const maxHeight = lineHeight * maxRows
        const newHeight = Math.min(textarea.scrollHeight, maxHeight)
        textarea.style.height = `${newHeight}px`

        const calculatedRows = Math.ceil(newHeight / lineHeight)
        setRows(calculatedRows)
    }, [value, maxRows])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (value.trim() && !isLoading && !disabled) {
                onSubmit?.(e)
            }
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (value.trim() && !isLoading && !disabled) {
            onSubmit?.(e)
        }
    }

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative flex flex-col",
                    "bg-white",
                    "border border-border",
                    "rounded-xl shadow-sm",
                    "transition-all duration-300",
                    "hover:border-primary/30 hover:shadow-md",
                    "focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10",
                    disabled && "opacity-50 cursor-not-allowed",
                    className
                )}
                {...props}
            >
                {/* Main Input Area */}
                <div className="flex items-end gap-2 p-3">
                    {/* File Upload */}
                    {onFileClick && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onFileClick}
                                    disabled={disabled || isLoading}
                                    className="shrink-0 text-muted-foreground hover:text-foreground"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent variant="glass">Add files</TooltipContent>
                        </Tooltip>
                    )}

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={onChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled || isLoading}
                        rows={1}
                        className={cn(
                            "flex-1 resize-none bg-transparent outline-none",
                            "text-foreground placeholder:text-muted-foreground",
                            "text-sm leading-6",
                            "min-h-[24px] max-h-[144px]",
                            "py-0.5",
                            disabled && "cursor-not-allowed"
                        )}
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                        {/* Voice Input */}
                        {onVoiceClick && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={onVoiceClick}
                                        disabled={disabled}
                                        className={cn(
                                            "text-muted-foreground hover:text-foreground",
                                            isRecording && "text-red-500 hover:text-red-600 animate-pulse"
                                        )}
                                    >
                                        {isRecording ? (
                                            <MicOff className="h-4 w-4" />
                                        ) : (
                                            <Mic className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent variant="glass">
                                    {isRecording ? "Stop recording" : "Voice input"}
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {/* Submit / Stop */}
                        {isStreaming ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="icon-sm"
                                        onClick={onStopGeneration}
                                        className="shrink-0"
                                    >
                                        <Square className="h-3.5 w-3.5 fill-current" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent variant="glass">Stop generating</TooltipContent>
                            </Tooltip>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={value.trim() ? "default" : "ghost"}
                                        size="icon-sm"
                                        onClick={handleSubmit}
                                        disabled={!value.trim() || isLoading || disabled}
                                        className={cn(
                                            "shrink-0 transition-all",
                                            !value.trim() && "text-muted-foreground"
                                        )}
                                    >
                                        {isLoading ? (
                                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent variant="glass">
                                    {isLoading ? "Generating..." : "Send message"}
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Footer hint */}
                <div className="flex items-center justify-between px-3 pb-2 pt-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary/60" />
                        <span className="text-[10px] text-muted-foreground">
                            Powered by AI • Press Enter to send
                        </span>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
})

ChatInput.displayName = "ChatInput"

export { ChatInput }
