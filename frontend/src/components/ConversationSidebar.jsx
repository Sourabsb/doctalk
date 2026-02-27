import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

// Shadcn components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Lucide icons
import {
  Plus, Search, ChevronLeft, ChevronRight, Trash2,
  Settings, LogOut, ChevronDown, MessageSquare, FileText
} from 'lucide-react'

const ConversationSidebar = ({
  conversations,
  activeId,
  onSelect,
  onRefresh,
  onDelete,
  user,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  onNewChat,
  onOpenProfileSettings = () => { },
}) => {
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.last_message && conv.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Theme colors matching ChatInterface
  const theme = {
    text: 'text-[#292524]',
    textSecondary: 'text-[#78716c]',
    textMuted: 'text-[#a8a29e]',
  }

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex flex-col transition-all duration-300 glass border-r border-border/50",
          isCollapsed ? "w-16" : "w-80"
        )}
      >
        {/* Top Section */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleCollapse}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" variant="glass">
                {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              </TooltipContent>
            </Tooltip>

            {!isCollapsed && (
              <Button
                variant="default"
                size="sm"
                onClick={onNewChat}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            )}
          </div>

          {!isCollapsed && (
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${theme.textSecondary}`} />
              <Input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 h-9 ${theme.text} placeholder:${theme.textMuted}`}
                variant="filled"
              />
            </div>
          )}

          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={onNewChat}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" variant="glass">
                New Chat
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <Separator />

        {/* Conversations List */}
        <ScrollArea className="flex-1 px-1">
          <div className="pr-2 pl-2 py-2 space-y-1">
            {!isCollapsed ? (
              <>
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className={`h-8 w-8 ${theme.textSecondary} opacity-40 mx-auto mb-2`} />
                    <p className={`text-sm ${theme.textSecondary}`}>
                      {searchQuery ? 'No matching chats' : 'No conversations yet'}
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => onSelect(conversation.id)}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                        activeId === conversation.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                        activeId === conversation.id
                          ? "bg-primary/20"
                          : "bg-muted"
                      )}>
                        <FileText className={cn(
                          "h-4 w-4",
                          activeId === conversation.id ? "text-primary" : theme.textSecondary
                        )} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          activeId === conversation.id ? "text-primary" : theme.text
                        )}>
                          {conversation.title || 'Untitled'}
                        </p>
                        <p className={cn(
                          "text-xs truncate",
                          activeId === conversation.id ? "text-primary/70" : theme.textSecondary
                        )}>
                          {formatDistanceToNow(new Date(conversation.updated_at || conversation.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(conversation.id)
                            }}
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent variant="glass">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  ))
                )}
              </>
            ) : (
              // Collapsed state - show icons only
              filteredConversations.slice(0, 8).map((conversation) => (
                <Tooltip key={conversation.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelect(conversation.id)}
                      className={cn(
                        "w-full p-2.5 rounded-xl transition-all flex items-center justify-center",
                        activeId === conversation.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <FileText className={cn(
                        "h-4 w-4",
                        activeId === conversation.id ? "text-primary" : "text-muted-foreground"
                      )} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" variant="glass">
                    {conversation.title || 'Untitled'}
                  </TooltipContent>
                </Tooltip>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Bottom User Section */}
        <div className="p-3">
          {!isCollapsed ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <Avatar size="sm">
                  <AvatarFallback variant="primary" className="text-xs">
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left overflow-hidden">
                  <p className={`text-sm font-medium ${theme.text} truncate`}>{user?.name || 'User'}</p>
                  <p className={`text-xs ${theme.textSecondary} truncate`}>{user?.email}</p>
                </div>
                <ChevronDown className={cn(
                  `h-4 w-4 ${theme.textSecondary} transition-transform`,
                  showSettings && "rotate-180"
                )} />
              </button>

              {showSettings && (
                <div className="space-y-1 animate-fade-in-up">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenProfileSettings}
                    className="w-full justify-start gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Profile & Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLogout}
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="transition-transform"
                  >
                    <Avatar size="default">
                      <AvatarFallback variant="primary" className="text-sm">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" variant="glass">
                  {user?.name || user?.email}
                </TooltipContent>
              </Tooltip>

              {showSettings && (
                <div className="flex flex-col items-center space-y-1 animate-fade-in-up">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onOpenProfileSettings}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" variant="glass">Settings</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onLogout}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" variant="glass">Sign out</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

export default ConversationSidebar
