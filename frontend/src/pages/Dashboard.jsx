import React, { useEffect, useState, useCallback } from 'react'
import ChatInterface from '../components/ChatInterface.jsx'
import ConversationSidebar from '../components/ConversationSidebar.jsx'
import ProfileSettingsModal from '../components/ProfileSettingsModal.jsx'
import UploadModal from '../components/UploadModal.jsx'
import { listConversations, deleteConversation } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const Dashboard = () => {
  const { user, logout, updateUser } = useAuth()
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [downloadHandler, setDownloadHandler] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('doctalkSidebarCollapsed')
    return stored ? stored === 'true' : true
  })
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [sortBy, setSortBy] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('doctalk-theme') === 'dark'
    }
    return false
  })

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('doctalk-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const refreshConversations = useCallback(async () => {
    try {
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
    try {
      await deleteConversation(conversationId)
      if (activeConversationId === conversationId) {
        setActiveConversationId(null)
      }
      refreshConversations()
    } catch (error) {
      console.error('Failed to delete conversation', error)
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
      <div className={`h-screen flex flex-col relative ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#fefcf9]'}`}>
        {/* Glass background with ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-br from-amber-950/20 via-transparent to-orange-950/10' : 'bg-gradient-to-br from-amber-100/30 via-transparent to-orange-50/20'}`} />
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] ${isDark ? 'bg-amber-500/8' : 'bg-amber-300/15'} blur-[180px] rounded-full`} />
          <div className={`absolute bottom-0 right-0 w-[600px] h-[400px] ${isDark ? 'bg-orange-500/5' : 'bg-orange-200/10'} blur-[150px] rounded-full`} />
          <div className={`absolute top-1/2 left-0 w-[400px] h-[400px] ${isDark ? 'bg-amber-400/5' : 'bg-amber-200/10'} blur-[120px] rounded-full`} />
        </div>
        
        {/* Chat Header - Full width navbar */}
        <header className={`relative z-10 w-full px-4 py-2 ${isDark ? 'bg-black/40 backdrop-blur-2xl' : 'bg-white/60 backdrop-blur-2xl'} border-b ${isDark ? 'border-white/10' : 'border-amber-100/50'}`}>
          <div className="flex justify-between items-center h-12">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveConversationId(null)}
                className={`p-2 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md`}>
                  <span className="text-white text-lg font-bold">D</span>
                </div>
                <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>DocTalk</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl transition-all ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleNewSession}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New</span>
              </button>
            </div>
          </div>
        </header>

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
    )
  }

  // NotebookLM-style dashboard
  return (
    <div className={`min-h-screen relative ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#fefcf9]'}`}>
      {/* Glass background with ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-br from-amber-950/20 via-transparent to-orange-950/10' : 'bg-gradient-to-br from-amber-100/30 via-transparent to-orange-50/20'}`} />
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] ${isDark ? 'bg-amber-500/8' : 'bg-amber-300/15'} blur-[180px] rounded-full`} />
        <div className={`absolute bottom-0 right-0 w-[600px] h-[400px] ${isDark ? 'bg-orange-500/5' : 'bg-orange-200/10'} blur-[150px] rounded-full`} />
        <div className={`absolute top-1/2 left-0 w-[400px] h-[400px] ${isDark ? 'bg-amber-400/5' : 'bg-amber-200/10'} blur-[120px] rounded-full`} />
      </div>
      
      {/* Header */}
      <header className={`sticky top-0 z-50 ${isDark ? 'bg-black/40 backdrop-blur-2xl' : 'bg-white/60 backdrop-blur-2xl'} border-b ${isDark ? 'border-white/10' : 'border-amber-100/50'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg ${isDark ? 'shadow-amber-500/20' : 'shadow-amber-200/50'}`}>
                <span className="text-white text-xl font-bold">D</span>
              </div>
              <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>DocTalk</span>
            </div>

            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-800 hover:bg-amber-50'}`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className={`p-2 rounded-lg transition ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-800 hover:bg-amber-50'}`}
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {/* Profile Avatar with Dropdown */}
              <div className="relative">
                <div 
                  className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all" 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                >
                  <span className="text-white text-sm font-bold">{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
                </div>
                {/* Dropdown Menu */}
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-2xl z-50 overflow-hidden border ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}>
                      <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.name || 'User'}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>{user?.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          setIsProfileModalOpen(true)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Settings
                      </button>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false)
                          logout()
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-red-500 ${isDark ? 'hover:bg-white/10' : 'hover:bg-red-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Tabs and Controls */}
        <div className="flex items-center justify-between mb-8">
          <div className={`flex items-center space-x-1 backdrop-blur-xl rounded-xl p-1 border ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/60 border-amber-100/50'}`}>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'all'
                  ? isDark 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'bg-white text-gray-800 shadow-sm'
                  : isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('favourites')}
              className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'favourites'
                  ? isDark 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'bg-white text-gray-800 shadow-sm'
                  : isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
              }`}
            >
              Favourites
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className={`flex items-center backdrop-blur-xl rounded-lg border p-1 ${isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white/60 border-amber-100/50'}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition ${viewMode === 'grid' ? (isDark ? 'bg-white/10 shadow-sm text-amber-400' : 'bg-white shadow-sm text-amber-600') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition ${viewMode === 'list' ? (isDark ? 'bg-white/10 shadow-sm text-amber-400' : 'bg-white shadow-sm text-amber-600') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')}`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Sort Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center space-x-2 px-4 py-2 backdrop-blur-xl rounded-lg border transition ${isDark ? 'bg-white/[0.03] border-white/10 text-gray-300 hover:bg-white/5' : 'bg-white/60 border-amber-100/50 text-gray-700 hover:bg-white/80'}`}
              >
                <span className="text-sm">{sortBy === 'recent' ? 'Most recent' : 'Name'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSortMenu && (
                <div className={`absolute right-0 mt-2 w-40 rounded-xl shadow-xl border py-1 z-10 backdrop-blur-xl ${isDark ? 'bg-black/80 border-white/10' : 'bg-white/90 border-amber-100/50'}`}>
                  <button
                    onClick={() => { setSortBy('recent'); setShowSortMenu(false) }}
                    className={`w-full px-4 py-2 text-left text-sm ${sortBy === 'recent' ? 'text-amber-500 bg-amber-500/10' : (isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-amber-50')}`}
                  >
                    Most recent
                  </button>
                  <button
                    onClick={() => { setSortBy('name'); setShowSortMenu(false) }}
                    className={`w-full px-4 py-2 text-left text-sm ${sortBy === 'name' ? 'text-amber-500 bg-amber-500/10' : (isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-amber-50')}`}
                  >
                    Name
                  </button>
                </div>
              )}
            </div>

            {/* Create New Button */}
            <button
              onClick={handleNewSession}
              className={`flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-medium shadow-lg transition-all ${isDark ? 'shadow-amber-500/20 hover:shadow-amber-500/30' : 'shadow-amber-200/50 hover:shadow-amber-300/50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create new</span>
            </button>
          </div>
        </div>

        {/* Section Title */}
        <h2 className={`text-xl font-semibold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {activeTab === 'all' ? 'Recent notebooks' : 'Favourite notebooks'}
        </h2>

        {/* Notebooks Grid/List */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' : 'space-y-4'}>
          {/* Create New Card */}
          <div
            onClick={handleNewSession}
            className={`group border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center backdrop-blur-xl ${
              isDark 
                ? 'bg-white/[0.02] border-white/10 hover:border-amber-400/50 hover:bg-white/[0.05]' 
                : 'bg-white/60 border-amber-200/50 hover:border-amber-400 hover:bg-white/80'
            } ${viewMode === 'grid' ? 'p-8 min-h-[200px]' : 'p-4 flex-row'}`}
          >
            <div className={`rounded-2xl flex items-center justify-center transition ${isDark ? 'bg-amber-500/20 group-hover:bg-amber-500/30' : 'bg-amber-100 group-hover:bg-amber-200'} ${viewMode === 'grid' ? 'w-16 h-16 mb-4' : 'w-12 h-12 mr-4'}`}>
              <svg className={`text-amber-500 ${viewMode === 'grid' ? 'w-8 h-8' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Create new notebook</p>
          </div>

          {/* Conversation Cards */}
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`group backdrop-blur-xl border rounded-2xl cursor-pointer transition-all relative ${
                isDark 
                  ? 'bg-white/[0.03] border-white/10 hover:border-amber-500/30 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-amber-500/10' 
                  : 'bg-white/70 border-amber-100/50 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/50'
              } ${viewMode === 'grid' ? 'p-6 min-h-[200px]' : 'p-4 flex items-center'}`}
            >
              {/* Card Icon */}
              <div className={`rounded-xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' : 'bg-gradient-to-br from-amber-100 to-orange-100'} ${viewMode === 'grid' ? 'w-14 h-14 mb-4' : 'w-12 h-12 mr-4 flex-shrink-0'}`}>
                <svg className={`w-7 h-7 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                <h3 className={`font-semibold mb-1 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>{conv.title || 'Untitled notebook'}</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date(conv.updated_at || conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {conv.document_count && ` • ${conv.document_count} sources`}
                </p>
              </div>

              {/* Actions */}
              <div className={`absolute ${viewMode === 'grid' ? 'top-4 right-4' : 'right-4'} flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleFavourite(conv.id, conv.is_favourite)
                  }}
                  className={`p-2 rounded-lg transition ${conv.is_favourite ? 'text-amber-500 bg-amber-500/10' : (isDark ? 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/10' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50')}`}
                  title={conv.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                >
                  <svg className="w-5 h-5" fill={conv.is_favourite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirmId(conv.id)
                  }}
                  className={`p-2 rounded-lg transition ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredConversations.length === 0 && activeTab === 'favourites' && (
          <p className={`text-center mt-8 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>No favourite notebooks yet. Star a notebook to add it here.</p>
        )}
      </main>

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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-sm mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white border border-gray-200'} p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Delete Notebook?</h3>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Are you sure you want to delete this notebook? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className={`px-4 py-2 rounded-lg transition ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteConversation(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
