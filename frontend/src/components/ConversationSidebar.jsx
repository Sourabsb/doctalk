import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

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
  onOpenProfileSettings = () => {}
}) => {
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredConversations = conversations.filter(conv => 
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.last_message && conv.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-full md:w-80'} bg-white/90 backdrop-blur-md border-r border-amber-100 flex flex-col transition-all duration-300`}>
      {/* Top Section with Toggle and Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleCollapse}
            className="text-gray-500 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {!isCollapsed && (
          <>
            <button
              onClick={onNewChat}
              className="w-full flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Chat</span>
            </button>
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-9 bg-amber-50 border border-amber-100 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        {!isCollapsed && (
          <div className="space-y-0">
            {filteredConversations.length === 0 && (
              <p className="text-sm text-gray-500 px-3 py-2">{searchQuery ? 'No matching conversations.' : 'No conversations yet.'}</p>
            )}
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative px-3 py-2.5 rounded-lg transition cursor-pointer ${
                  activeId === conversation.id ? 'bg-amber-100' : 'hover:bg-amber-50'
                }`}
                onClick={() => onSelect(conversation.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm text-gray-700 truncate flex-1">
                    {conversation.title}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(conversation.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom User Section */}
      <div className="p-3 border-t border-amber-100">
        {!isCollapsed ? (
          <div className="space-y-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-amber-50 transition text-gray-700"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSettings && (
              <div className="space-y-1 pl-2">
                <button
                  onClick={onOpenProfileSettings}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-amber-50 transition text-gray-600 hover:text-amber-700 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.573.99c.857-.495 1.91.358 1.654 1.287a1.724 1.724 0 001.357 2.17c.95.21 1.278 1.36.6 2.012a1.724 1.724 0 000 2.486c.678.652.35 1.802-.6 2.011a1.724 1.724 0 00-1.357 2.171c.256.929-.797 1.782-1.654 1.287a1.724 1.724 0 00-2.573.989c-.299.922-1.603.922-1.902 0a1.724 1.724 0 00-2.573-.99c-.857.495-1.91-.358-1.654-1.287a1.724 1.724 0 00-1.357-2.17c-.95-.21-1.278-1.36-.6-2.012a1.724 1.724 0 000-2.486c-.678-.652-.35-1.802.6-2.011a1.724 1.724 0 001.357-2.171c-.256-.929.797-1.782 1.654-1.287.91.526 2.063-.087 2.573-.989z" />
                  </svg>
                  <span>Profile & Settings</span>
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-amber-50 transition text-gray-600 hover:text-amber-700 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-10 h-10 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center hover:opacity-80 transition"
              title={user?.name || user?.email}
            >
              <span className="text-sm font-bold text-white">{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
            </button>
            {showSettings && (
              <div className="flex flex-col items-center space-y-2">
                <button
                  onClick={onOpenProfileSettings}
                  className="w-10 h-10 rounded-lg hover:bg-amber-50 transition text-gray-600 hover:text-amber-700 flex items-center justify-center"
                  title="Profile & Settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.573.99c.857-.495 1.91.358 1.654 1.287a1.724 1.724 0 001.357 2.17c.95.21 1.278 1.36.6 2.012a1.724 1.724 0 000 2.486c.678.652.35 1.802-.6 2.011a1.724 1.724 0 00-1.357 2.171c.256.929-.797 1.782-1.654 1.287a1.724 1.724 0 00-2.573.989c-.299.922-1.603.922-1.902 0a1.724 1.724 0 00-2.573-.99c-.857.495-1.91-.358-1.654-1.287a1.724 1.724 0 00-1.357-2.17c-.95-.21-1.278-1.36-.6-2.012a1.724 1.724 0 000-2.486c-.678-.652-.35-1.802.6-2.011a1.724 1.724 0 001.357-2.171c-.256-.929.797-1.782 1.654-1.287.91.526 2.063-.087 2.573-.989z" />
                  </svg>
                </button>
                <button
                  onClick={onLogout}
                  className="w-10 h-10 rounded-lg hover:bg-amber-50 transition text-gray-600 hover:text-amber-700 flex items-center justify-center"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

export default ConversationSidebar
