import React, { useEffect, useState, useCallback } from 'react'
import ChatInterface from '../components/ChatInterface.jsx'
import ConversationSidebar from '../components/ConversationSidebar.jsx'
import ProfileSettingsModal from '../components/ProfileSettingsModal.jsx'
import UploadModal from '../components/UploadModal.jsx'
import { listConversations, deleteConversation } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

// Shadcn components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

// Lucide icons
import {
  Plus, Sun, Moon, Settings, LogOut, User, ChevronLeft,
  Trash2, Star, FileText, LayoutGrid, List, ChevronDown,
  Cloud, Lock, AlertTriangle, Loader2, Sparkles
} from 'lucide-react'

const Dashboard = () => {
  const { user, logout, updateUser } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [downloadHandler, setDownloadHandler] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('doctalkSidebarCollapsed')
    return stored ? stored === 'true' : true
  })
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('recent')
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('doctalk-theme') === 'dark'
    }
    return false
  })

  // Apply dark mode to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('doctalk-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const refreshConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await listConversations()
      setConversations(data)
      if (data.length === 0) {
        setActiveConversationId(null)
        return
      }
      if (activeConversationId && data.find((c) => c.id === activeConversationId)) {
        return
      }
    } catch (error) {
      console.error('Failed to load conversations', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeConversationId])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  const handleUploadSuccess = async (conversationId) => {
    setActiveConversationId(conversationId)
    setIsProcessing(false)
    setIsUploadModalOpen(false)
    try {
      const data = await listConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations', error)
    }
  }

  const handleDeleteConversation = async (conversationId) => {
    setIsDeleting(true)
    try {
      await deleteConversation(conversationId)
      if (activeConversationId === conversationId) {
        setActiveConversationId(null)
      }
      refreshConversations()
    } catch (error) {
      console.error('Failed to delete conversation', error)
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const handleToggleFavourite = async (conversationId, currentFav) => {
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, is_favourite: !currentFav } : c
    ))
  }

  const handleNewSession = () => {
    setIsUploadModalOpen(true)
  }

  const filteredConversations = conversations
    .filter(conv => activeTab === 'all' || conv.is_favourite)
    .sort((a, b) => {
      if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '')
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    })

  // Chat view when conversation is active
  if (activeConversationId) {
    return (
      <TooltipProvider>
        <div className="h-screen flex flex-col relative bg-background">
          {/* Ambient Background Glow removed */}

          {/* Chat Header */}
          <header className="relative z-10 w-full px-4 py-2 glass border-b border-border/50">
            <div className="flex justify-between items-center h-12">
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setActiveConversationId(null)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">Back to notebooks</TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-3">
                  <img 
                    src="/img/icon.png" 
                    alt="DocTalk Logo" 
                    className="w-9 h-9 object-contain"
                  />
                  <span className="text-lg font-bold text-foreground">DocTalk</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleTheme}
                    >
                      {isDark ? (
                        <Sun className="h-5 w-5" />
                      ) : (
                        <Moon className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">
                    {isDark ? 'Light mode' : 'Dark mode'}
                  </TooltipContent>
                </Tooltip>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewSession}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>New</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Chat Interface */}
          <div className="relative z-10 flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                conversationId={activeConversationId}
                onSetDownloadHandler={setDownloadHandler}
                onConversationUpdate={(newId) => {
                  setActiveConversationId(newId)
                  refreshConversations()
                }}
                isDark={isDark}
              />
            </div>
          </div>

          <ProfileSettingsModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            user={user}
            onProfileUpdated={updateUser}
            onAccountDeleted={() => {
              setIsProfileModalOpen(false)
              setConversations([])
              setActiveConversationId(null)
              logout()
            }}
            isDark={isDark}
          />

          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadSuccess={handleUploadSuccess}
            isDark={isDark}
          />
        </div>
      </TooltipProvider>
    )
  }

  // Dashboard view
  return (
    <TooltipProvider>
      <div className="min-h-screen relative bg-background">
        {/* Ambient Background Glow */}
        <div className="ambient-glow" />

        {/* Header */}
        <header className="sticky top-0 z-50 glass border-b border-border/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <img 
                  src="/img/icon.png" 
                  alt="DocTalk Logo" 
                  className="w-10 h-10 object-contain hover:scale-105 transition-transform cursor-pointer"
                  onClick={() => navigate('/')}
                />
                <span className="text-2xl font-bold text-foreground">DocTalk</span>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">
                    {isDark ? 'Light mode' : 'Dark mode'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsProfileModalOpen(true)}>
                      <Settings className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">Settings</TooltipContent>
                </Tooltip>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                      <AvatarFallback variant="primary">
                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
                      <User className="mr-2 h-4 w-4" />
                      Profile Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Tabs and Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList variant="glass">
                <TabsTrigger value="all" variant="glass">All</TabsTrigger>
                <TabsTrigger value="favourites" variant="glass">
                  <Star className="h-3.5 w-3.5 mr-1.5" />
                  Favourites
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center space-x-3">
              {/* View Mode Toggle */}
              <div className="glass-subtle rounded-lg p-1 flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">Grid view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent variant="glass">List view</TooltipContent>
                </Tooltip>
              </div>

              {/* Sort Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="glass" size="sm" className="gap-2">
                    <span>{sortBy === 'recent' ? 'Most recent' : 'Name'}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('recent')} className={sortBy === 'recent' ? 'text-primary' : ''}>
                    Most recent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('name')} className={sortBy === 'name' ? 'text-primary' : ''}>
                    Name
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Create New Button */}
              <Button variant="premium" size="default" onClick={handleNewSession} className="gap-2">
                <Plus className="h-5 w-5" />
                <span>Create new</span>
              </Button>
            </div>
          </div>

          {/* Section Title */}
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {activeTab === 'all' ? 'Recent notebooks' : 'Favourite notebooks'}
            </h2>
            <Badge variant="secondary">{filteredConversations.length}</Badge>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' : 'space-y-4'}>
              {[1, 2, 3, 4].map(i => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            /* Notebooks Grid/List */
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' : 'space-y-4'}>
              {/* Create New Card */}
              <Card
                variant="outline"
                onClick={handleNewSession}
                className={`group cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/20 ${viewMode === 'grid' ? 'min-h-[200px] flex flex-col items-center justify-center' : 'flex items-center'
                  }`}
              >
                <CardContent className={`flex ${viewMode === 'grid' ? 'flex-col items-center p-8' : 'items-center p-4 gap-4'}`}>
                  <div className={`rounded-2xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/20 ${viewMode === 'grid' ? 'w-16 h-16 mb-4' : 'w-12 h-12'
                    }`}>
                    <Plus className={`text-primary ${viewMode === 'grid' ? 'h-8 w-8' : 'h-6 w-6'}`} />
                  </div>
                  <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Create new notebook
                  </p>
                </CardContent>
              </Card>

              {/* Conversation Cards */}
              {filteredConversations.map((conv) => (
                <Card
                  key={conv.id}
                  variant="interactive"
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`group relative transition-all hover:shadow-lg hover:shadow-primary/5 ${viewMode === 'grid' ? 'min-h-[200px]' : ''
                    }`}
                >
                  <CardContent className={viewMode === 'grid' ? 'p-6' : 'p-4 flex items-center'}>
                    {/* Card Icon */}
                    <div className={`rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${viewMode === 'grid' ? 'w-14 h-14 mb-4' : 'w-12 h-12 mr-4 flex-shrink-0'
                      }`}>
                      <FileText className="w-7 h-7 text-primary" />
                    </div>

                    <div className={viewMode === 'list' ? 'flex-1' : ''}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold line-clamp-2 text-foreground">
                          {conv.title || 'Untitled notebook'}
                        </h3>
                        <Badge variant={conv.llm_mode === 'local' ? 'local' : 'cloud'} size="sm">
                          {conv.llm_mode === 'local' ? (
                            <>
                              <Lock className="h-2.5 w-2.5 mr-1" />
                              Local
                            </>
                          ) : (
                            <>
                              <Cloud className="h-2.5 w-2.5 mr-1" />
                              Cloud
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(conv.updated_at || conv.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                        {conv.document_count && ` • ${conv.document_count} sources`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className={`absolute ${viewMode === 'grid' ? 'top-4 right-4' : 'right-4'} flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleFavourite(conv.id, conv.is_favourite)
                            }}
                            className={conv.is_favourite ? 'text-amber-500' : ''}
                          >
                            <Star className={`h-4 w-4 ${conv.is_favourite ? 'fill-current' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent variant="glass">
                          {conv.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmId(conv.id)
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent variant="glass">Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredConversations.length === 0 && activeTab === 'favourites' && (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">
                No favourite notebooks yet. Star a notebook to add it here.
              </p>
            </div>
          )}
        </main>

        {/* Modals */}
        <ProfileSettingsModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdated={updateUser}
          onAccountDeleted={() => {
            setIsProfileModalOpen(false)
            setConversations([])
            setActiveConversationId(null)
            logout()
          }}
          isDark={isDark}
        />

        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={handleUploadSuccess}
          isDark={isDark}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent variant="glass">
            {isDeleting ? (
              <div className="flex flex-col items-center py-8">
                <div className="relative w-12 h-12 mb-4">
                  <Loader2 className="h-12 w-12 text-destructive animate-spin" />
                </div>
                <DialogTitle className="mb-1">Deleting notebook...</DialogTitle>
                <DialogDescription>Please wait</DialogDescription>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-full bg-destructive/10">
                      <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <DialogTitle>Delete Notebook?</DialogTitle>
                  </div>
                  <DialogDescription>
                    Are you sure you want to delete this notebook? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={() => handleDeleteConversation(deleteConfirmId)}>
                    Delete
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

export default Dashboard
