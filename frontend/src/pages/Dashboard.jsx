import React, { useEffect, useState, useCallback } from 'react'
import Header from '../components/Header.jsx'
import FileUpload from '../components/FileUpload.jsx'
import ChatInterface from '../components/ChatInterface.jsx'
import ConversationSidebar from '../components/ConversationSidebar.jsx'
import ProfileSettingsModal from '../components/ProfileSettingsModal.jsx'
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
  const [forceNewSession, setForceNewSession] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations()
      setConversations(data)
      if (data.length === 0) {
        setActiveConversationId(null)
        return
      }
      // Don't change activeConversationId if one is already set
      if (activeConversationId && data.find((c) => c.id === activeConversationId)) {
        return
      }
      // Don't auto-select if user explicitly chose new session
      if (forceNewSession) {
        setActiveConversationId(null)
        return
      }
    } catch (error) {
      console.error('Failed to load conversations', error)
    }
  }, [activeConversationId, forceNewSession])

  useEffect(() => {
    refreshConversations()
  }, [refreshConversations])

  const handleUploadSuccess = async (conversationId) => {
    // Set active conversation immediately
    setActiveConversationId(conversationId)
    setIsProcessing(false)
    setForceNewSession(false)
    // Then refresh the conversations list
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

  const handleNewSession = () => {
    setActiveConversationId(null)
    setDownloadHandler(null)
    setForceNewSession(true)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Header
        onNewSession={handleNewSession}
        onDownload={downloadHandler}
        activeConversationId={activeConversationId}
        user={user}
        onLogout={logout}
      />
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => {
            setActiveConversationId(id)
            setForceNewSession(false)
          }}
          onRefresh={refreshConversations}
          onDelete={handleDeleteConversation}
          user={user}
          onLogout={logout}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => {
            setIsSidebarCollapsed((prev) => {
              const next = !prev
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('doctalkSidebarCollapsed', String(next))
              }
              return next
            })
          }}
          onNewChat={handleNewSession}
          onOpenProfileSettings={() => setIsProfileModalOpen(true)}
        />
        <div className="flex-1 overflow-y-auto bg-gray-900">
          {activeConversationId ? (
            <ChatInterface
              conversationId={activeConversationId}
              onSetDownloadHandler={setDownloadHandler}
            />
          ) : (
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          )}
        </div>
      </div>

        <ProfileSettingsModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          onProfileUpdated={(updatedUser) => {
            updateUser(updatedUser)
          }}
          onAccountDeleted={() => {
            setIsProfileModalOpen(false)
            setConversations([])
            setActiveConversationId(null)
            logout()
          }}
        />
    </div>
  )
}

export default Dashboard
