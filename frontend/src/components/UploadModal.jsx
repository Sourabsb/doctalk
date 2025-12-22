import React, { useState, useRef } from 'react'
import { uploadFiles } from '../utils/api'

const UploadModal = ({ isOpen, onClose, onUploadSuccess, isDark }) => {
  const [files, setFiles] = useState([])
  const [conversationTitle, setConversationTitle] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [llmMode, setLlmMode] = useState('local') // 'local' | 'api'
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...droppedFiles])
  }

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    
    setIsProcessing(true)
    setError(null)
    try {
      const response = await uploadFiles(files, conversationTitle.trim(), llmMode)
      onUploadSuccess(response.conversation_id)
      setFiles([])
      setConversationTitle('')
      setLlmMode('local')
      onClose()
    } catch (error) {
      console.error('Upload failed:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed. Please check your files and try again.'
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setFiles([])
      setConversationTitle('')
      setError(null)
      setLlmMode('local')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#0f0f0f] border border-white/10' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-amber-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Add sources</h2>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Upload documents to analyze</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className={`rounded-full p-2 transition disabled:opacity-50 ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-amber-50'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-amber-400 bg-amber-500/10' 
                : isDark 
                  ? 'border-white/20 hover:border-amber-400/50 bg-white/5'
                  : 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              className="hidden"
            />
            
            <div className="space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className={`text-lg font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>Drop your files here</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 rounded-lg text-white font-medium transition shadow-lg shadow-amber-500/25"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload files
                </button>
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Supported: PDF, DOCX, TXT, Images</p>
            </div>
          </div>

          {/* Choose model mode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLlmMode('local')}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                llmMode === 'local'
                  ? isDark
                    ? 'border-amber-400/70 bg-amber-500/10'
                    : 'border-amber-400 bg-amber-50'
                  : isDark
                    ? 'border-white/10 bg-white/5 hover:border-amber-300/40'
                    : 'border-amber-100 bg-white hover:border-amber-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Local (Ollama)</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Private on-device</p>
              </div>
              {llmMode === 'local' && (
                <span className={`text-lg font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>✓</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setLlmMode('api')}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                llmMode === 'api'
                  ? isDark
                    ? 'border-amber-400/70 bg-amber-500/10'
                    : 'border-amber-400 bg-amber-50'
                  : isDark
                    ? 'border-white/10 bg-white/5 hover:border-amber-300/40'
                    : 'border-amber-100 bg-white hover:border-amber-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cloud</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Faster, uses cloud</p>
              </div>
              {llmMode === 'api' && (
                <span className={`text-lg font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>✓</span>
              )}
            </button>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className={`block text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Notebook title (optional)</label>
                <input
                  type="text"
                  value={conversationTitle}
                  onChange={(e) => setConversationTitle(e.target.value)}
                  placeholder="e.g. Project Research Notes"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' 
                      : 'bg-white border-amber-200 text-gray-800 placeholder-gray-400'
                  }`}
                />
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-amber-50'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                        <span className="text-xs font-medium text-amber-500">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium truncate max-w-[200px] ${isDark ? 'text-white' : 'text-gray-800'}`}>{file.name}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-500 hover:text-red-400 p-1 transition"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm max-h-32 overflow-y-auto custom-scrollbar">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-white/10' : 'border-amber-100'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {files.length > 0 ? `${files.length} source${files.length > 1 ? 's' : ''} selected` : 'Upload a source to get started'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className={`px-4 py-2 transition disabled:opacity-50 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || isProcessing}
              className="px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-medium hover:from-amber-500 hover:to-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Create notebook
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadModal
