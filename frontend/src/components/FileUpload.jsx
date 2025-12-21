import React, { useState, useRef } from 'react'
import { uploadFiles } from '../utils/api'

const FileUpload = ({ onUploadSuccess, isProcessing, setIsProcessing }) => {
  const [files, setFiles] = useState([])
  const [conversationTitle, setConversationTitle] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('offline') // 'online' or 'offline'
  const fileInputRef = useRef(null)

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
    const llmMode = mode === 'offline' ? 'local' : 'api'
    
    setIsProcessing(true)
    setError(null)
    try {
      const response = await uploadFiles(files, conversationTitle.trim(), llmMode)
      onUploadSuccess(response.conversation_id)
      setFiles([])
      setConversationTitle('')
    } catch (error) {
      console.error('Upload failed:', error)
      setError('Upload failed. Please check your files and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 text-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-6 text-gray-800">
              Meet <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">DocTalk</span>,<br />
              Your AI Document Assistant
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Upload multiple documents and have intelligent cross-document conversations with AI-powered insights.
            </p>
          </div>
        </div>

        {/* Main Content - Upload Demo */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-8 text-white min-h-[400px] flex flex-col shadow-xl">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Upload Multiple Documents</h3>
                <p className="text-white/80 text-sm">Upload multiple files to analyze and compare them together</p>
              </div>
            </div>
            
            {/* Mode Selector */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMode('online')}
                className={`flex-1 px-4 py-3 rounded-lg transition-all duration-200 ${
                  mode === 'online'
                    ? 'bg-white text-amber-600 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Cloud API</div>
                    <div className="text-xs opacity-80">Gemini (data leaves device)</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setMode('offline')}
                className={`flex-1 px-4 py-3 rounded-lg transition-all duration-200 ${
                  mode === 'offline'
                    ? 'bg-white text-amber-600 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Local (Ollama)</div>
                    <div className="text-xs opacity-80">Private on-device</div>
                  </div>
                </div>
              </button>
            </div>
            
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed border-white/30 rounded-xl p-6 text-center transition-all duration-300 flex-1 ${
                dragActive 
                  ? 'border-white/60 bg-white/10' 
                  : 'hover:border-white/50 hover:bg-white/5'
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
              
              <div className="space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium mb-2">Drop your files here</p>
                  <p className="text-white/70 text-sm mb-4">
                    or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-white underline hover:no-underline"
                    >
                      browse files
                    </button>
                  </p>
                  <div className="flex justify-center space-x-4 text-xs text-white/60">
                    <span>PDF</span>
                    <span>DOCX</span>
                    <span>TXT</span>
                    <span>Images</span>
                  </div>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <div>
                  <label className="block text-sm text-white/80 mb-2" htmlFor="conversationTitle">Conversation title</label>
                  <input
                    id="conversationTitle"
                    type="text"
                    value={conversationTitle}
                    onChange={(e) => setConversationTitle(e.target.value)}
                    placeholder="e.g. Project Contract Review"
                    className="w-full px-4 py-2 rounded-lg bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/60"
                  />
                </div>
              <div className="space-y-3">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-white/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-white/60 hover:text-white p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="w-full py-3 bg-white text-amber-600 rounded-lg font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Processing...' : mode === 'offline' ? 'Start with Local Model' : 'Start with Cloud API'}
                </button>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Features Section - Below Upload */}
        <div className="max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-800 text-center mb-12">Cross-Document Intelligence</h3>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 text-center border border-amber-100 shadow-lg">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                </svg>
              </div>
              <h4 className="text-gray-800 font-semibold mb-2">Multiple Formats</h4>
              <p className="text-gray-600 text-sm">Upload PDFs, Word docs, images, and text files together</p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 text-center border border-amber-100 shadow-lg">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-gray-800 font-semibold mb-2">Cross-Document Analysis</h4>
              <p className="text-gray-600 text-sm">Compare and analyze information across all uploaded files</p>
            </div>
            
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 text-center border border-amber-100 shadow-lg">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-gray-800 font-semibold mb-2">Smart Conversations</h4>
              <p className="text-gray-600 text-sm">Ask questions that span multiple documents with context-aware AI</p>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 text-center border border-amber-100 shadow-lg">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.894L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-gray-800 font-semibold mb-2">Multi-Lingual Support</h4>
            <p className="text-gray-600 text-sm">Process and understand documents in multiple languages seamlessly</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileUpload
