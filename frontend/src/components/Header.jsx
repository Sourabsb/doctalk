import React, { useState } from 'react'

const Header = ({ onNewSession, onDownload, activeConversationId, user, onLogout }) => {
  const [showExportMenu, setShowExportMenu] = useState(false)

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2.5">
            <img 
              src="/img/icon.png" 
              alt="DocTalk Logo" 
              className="w-8 h-8 object-contain"
            />
            <h1 className="text-xl font-bold text-white">DocTalk</h1>
          </div>
          <div className="flex items-center space-x-3">
            {user && (
              <p className="text-xs text-gray-400">Signed in as {user.name || user.email}</p>
            )}
            {activeConversationId && onDownload && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center space-x-1"
                >
                  <span>Export</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => { onDownload('txt'); setShowExportMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-t-lg transition"
                    >
                      TXT
                    </button>
                    <button
                      onClick={() => { onDownload('pdf'); setShowExportMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-b-lg transition"
                    >
                      PDF
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header