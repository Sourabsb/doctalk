import React, { useState, useRef, useEffect } from 'react'
import { sendMessage, downloadChat, getConversation, addDocumentsToConversation, editMessage, deleteMessage } from '../utils/api'

const renderMarkdown = (text) => {
  if (!text) return text
  
  let formatted = text
  
  // Headers (# ## ###)
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
  
  // Bold (**text**)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
  
  // Italic (*text* or _text_)
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
  formatted = formatted.replace(/_([^_]+)_/g, '<em class="italic">$1</em>')
  
  // Bullet points (• or *)
  formatted = formatted.replace(/^[•\*]\s+(.+)$/gm, '<li class="ml-4 mb-1">• $1</li>')
  
  // Line breaks
  formatted = formatted.replace(/\n/g, '<br />')
  
  return formatted
}

const toBoolean = (value) => value === true || value === 1 || value === '1'

const normalizeResponseVariants = (variants = []) => {
  if (!Array.isArray(variants)) return []
  return variants
    .map((variant, index) => ({
      id: variant.id ?? `variant-${index}-${Date.now()}`,
      versionIndex: variant.version_index ?? variant.versionIndex ?? variant.version ?? index + 1,
      content: variant.content,
      sources: variant.sources || [],
      isActive: variant.is_active ?? variant.isActive ?? !toBoolean(variant.is_archived ?? variant.isArchived),
      createdAt: variant.created_at || variant.createdAt || new Date().toISOString(),
      promptContent: variant.prompt_content || variant.promptContent || variant.promptSnapshot || null
    }))
    .filter((variant) => !!variant.content)
    .sort((a, b) => (a.versionIndex || 0) - (b.versionIndex || 0))
}

const getActiveVariantIndex = (variants = []) => {
  if (!variants.length) return null
  const activeIndex = variants.findIndex((variant) => variant.isActive)
  return activeIndex !== -1 ? activeIndex : variants.length - 1
}

const mapServerMessage = (msg) => {
  if (!msg) return null
  return {
    id: msg.id,
    type: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
    sources: msg.sources || msg.sources_json || [],
    is_edited: Boolean(msg.is_edited),
    replyTo: msg.reply_to_message_id || msg.replyTo || null,
    versionIndex: msg.version_index || msg.versionIndex || 1,
    responseVersions: normalizeResponseVariants(msg.response_versions || msg.responseVersions || []),
    created_at: msg.created_at,
    is_archived: toBoolean(msg.is_archived),
    promptSnapshot: msg.prompt_snapshot || msg.promptSnapshot || null
  }
}

const shapeConversationMessages = (rawMessages = []) => {
  if (!Array.isArray(rawMessages)) return []
  const shaped = []
  const userMap = {}

  rawMessages.forEach((raw) => {
    const normalized = mapServerMessage(raw)
    if (!normalized) return

    if (normalized.type === 'user') {
      normalized.responseVersions = normalizeResponseVariants(normalized.responseVersions).map((variant) => ({
        ...variant,
        promptContent: variant.promptContent || normalized.content
      }))
      shaped.push(normalized)
      userMap[normalized.id] = normalized
      return
    }

    if (normalized.type === 'assistant' && normalized.replyTo) {
      if (userMap[normalized.replyTo]) {
        const variant = normalizeResponseVariants([
          {
            id: normalized.id,
            version_index: normalized.versionIndex,
            content: normalized.content,
            sources: normalized.sources,
            is_active: !normalized.is_archived,
            created_at: normalized.created_at,
            prompt_content: normalized.promptSnapshot || userMap[normalized.replyTo]?.content || null
          }
        ])
        userMap[normalized.replyTo].responseVersions = [
          ...(userMap[normalized.replyTo].responseVersions || []),
          ...variant
        ]
        userMap[normalized.replyTo].responseVersions = normalizeResponseVariants(userMap[normalized.replyTo].responseVersions)
      }
      return
    }

    shaped.push(normalized)
  })

  return shaped
}

const buildDefaultVersionSelections = (messages) => {
  const selections = {}
  messages.forEach((msg) => {
    if (msg.type === 'user' && msg.responseVersions?.length) {
      const activeIndex = getActiveVariantIndex(msg.responseVersions)
      selections[msg.id] = activeIndex ?? (msg.responseVersions.length - 1)
    }
  })
  return selections
}

const ChatInterface = ({ conversationId, onSetDownloadHandler }) => {
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState(null)
  const [supportsSpeechInput, setSupportsSpeechInput] = useState(false)
  const [supportsSpeechOutput, setSupportsSpeechOutput] = useState(false)
  const [speechVoice, setSpeechVoice] = useState(null)
  const [isUploadingDocs, setIsUploadingDocs] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [versionSelections, setVersionSelections] = useState({})
  const messagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    setSupportsSpeechInput(true)

    return () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const synth = window.speechSynthesis
    if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') return

    setSupportsSpeechOutput(true)

    const selectVoice = () => {
      const voices = synth.getVoices()
      if (!voices?.length) return
      const localePrefs = ['en-IN', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN', 'mr-IN']
      let preferred = null
      for (const locale of localePrefs) {
        preferred = voices.find((voice) => voice.lang?.toLowerCase() === locale.toLowerCase())
        if (preferred) break
      }
      if (!preferred) {
        preferred = voices.find((voice) => voice.name?.toLowerCase().includes('india'))
      }
      if (!preferred) {
        preferred = voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
      }
      setSpeechVoice(preferred || null)
    }

    selectVoice()

    const handleVoicesChanged = () => selectVoice()
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', handleVoicesChanged)
    } else {
      synth.onvoiceschanged = handleVoicesChanged
    }

    return () => {
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', handleVoicesChanged)
      } else if (synth.onvoiceschanged === handleVoicesChanged) {
        synth.onvoiceschanged = null
      }
      synth.cancel()
    }
  }, [])

  const stopSpeaking = () => {
    if (!supportsSpeechOutput) return
    window.speechSynthesis?.cancel()
    setSpeakingMessageId(null)
  }

  useEffect(() => {
    let isMounted = true

    const loadConversation = async () => {
      if (!conversationId) {
        setMessages([])
        setDocuments([])
        setError('')
        setVersionSelections({})
        return
      }

      setIsFetching(true)
      setError('')
      try {
        const data = await getConversation(conversationId)
        if (!isMounted) return

        let shapedMessages = shapeConversationMessages(data.messages || [])

        if (!shapedMessages.length) {
          const docCount = data.documents?.length || 0
          if (docCount > 0) {
            const docNames = (data.documents || []).map((doc) => doc?.filename || doc?.name || doc?.title || doc).filter(Boolean)
            const docList = docNames.length ? docNames.join(', ') : 'your document'
            shapedMessages = [
              {
                id: 'documents-ready',
                type: 'assistant',
                content: docCount > 1
                  ? `📄 ${docCount} documents uploaded: ${docList}\n\nYou can ask questions that span across all files! Try:\n• "Summarize all documents"\n• "Compare the key points across files"\n• "What are the differences between [file1] and [file2]?"`
                  : `Document ready! Ask anything about ${docList} to get started.`,
                sources: [],
                responseVersions: [],
                replyTo: null
              }
            ]
          }
        }

        setMessages(shapedMessages)
        setVersionSelections(buildDefaultVersionSelections(shapedMessages))
        setDocuments(data.documents || [])
      } catch (err) {
        console.error('Failed to fetch conversation', err)
        if (isMounted) {
          setError('Unable to load conversation history right now.')
        }
      } finally {
        if (isMounted) {
          setIsFetching(false)
        }
      }
    }

    loadConversation()
    return () => {
      isMounted = false
    }
  }, [conversationId])

  useEffect(() => {
    if (!onSetDownloadHandler) return
    if (!conversationId) {
      onSetDownloadHandler(null)
      return
    }
    onSetDownloadHandler((format) => downloadChat(conversationId, format))
  }, [conversationId, onSetDownloadHandler])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || !conversationId) return

    const prompt = input.trim()
    const tempId = `temp-${Date.now()}`
    const optimisticUserMessage = {
      id: tempId,
      type: 'user',
      content: prompt,
      sources: [],
      responseVersions: [],
      isPending: true
    }
    setMessages((prev) => [...prev, optimisticUserMessage])
    setVersionSelections((prev) => ({ ...prev, [tempId]: 0 }))
    setInput('')
    setIsLoading(true)

    try {
      const response = await sendMessage(conversationId, prompt)
      const resolvedUser = response.user_message
        ? mapServerMessage(response.user_message)
        : { ...optimisticUserMessage, id: response.user_message?.id || tempId }

      let responseVariants = normalizeResponseVariants(
        response.response_versions || resolvedUser.responseVersions || []
      )

      if (!responseVariants.length) {
        const assistantVariantSource = response.assistant_message
          ? mapServerMessage(response.assistant_message)
          : null
        responseVariants = normalizeResponseVariants([
          {
            id: assistantVariantSource?.id || `${resolvedUser.id}-assistant` || `${Date.now()}-assistant`,
            version_index: assistantVariantSource?.versionIndex,
            content: assistantVariantSource?.content || response.response,
            sources: assistantVariantSource?.sources || response.sources || [],
            is_active: true,
            created_at: assistantVariantSource?.created_at,
            prompt_content: resolvedUser.content
          }
        ])
      }

      const normalizedResponseVariants = responseVariants.map((variant) => ({
        ...variant,
        promptContent: variant.promptContent || resolvedUser.content
      }))
      resolvedUser.responseVersions = normalizedResponseVariants
      resolvedUser.isPending = false

      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? resolvedUser : msg)))
      setVersionSelections((prev) => {
        const next = { ...prev }
        delete next[tempId]
        if (normalizedResponseVariants.length) {
          next[resolvedUser.id] = getActiveVariantIndex(normalizedResponseVariants) ?? (normalizedResponseVariants.length - 1)
        }
        return next
      })
    } catch (err) {
      console.error('Chat error', err)
      setMessages((prev) => prev.map((msg) => {
        if (msg.id === tempId) {
          return {
            ...msg,
            isPending: false,
            responseVersions: normalizeResponseVariants([
              {
                id: `${tempId}-error`,
                version_index: 1,
                content: 'Sorry, I ran into an issue answering that. Please try again.',
                sources: [],
                is_active: true,
                created_at: new Date().toISOString(),
                prompt_content: msg.content
              }
            ])
          }
        }
        return msg
      }))
      setVersionSelections((prev) => ({ ...prev, [tempId]: 0 }))
    } finally {
      setIsLoading(false)
    }
  }

  const handleVoiceToggle = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.error('Speech recognition error', err)
      }
    }
  }

  const speakMessage = (messageId, text) => {
    if (!supportsSpeechOutput || !text) return
    stopSpeaking()
    const utterance = new window.SpeechSynthesisUtterance(text)
    if (speechVoice) {
      utterance.voice = speechVoice
      if (speechVoice.lang) {
        utterance.lang = speechVoice.lang
      }
    } else {
      utterance.lang = 'en-IN'
    }
    setSpeakingMessageId(messageId)
    utterance.onend = () => setSpeakingMessageId((prev) => (prev === messageId ? null : prev))
    utterance.onerror = () => setSpeakingMessageId((prev) => (prev === messageId ? null : prev))
    window.speechSynthesis.speak(utterance)
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setIsUploadingDocs(true)
    setError('')

    try {
      const response = await addDocumentsToConversation(conversationId, files)
      
      // Add system message
      const systemMessage = {
        id: `${Date.now()}-system`,
        type: 'assistant',
        content: `✅ Successfully added ${response.processed_files.length} document(s): ${response.processed_files.join(', ')}. You can now ask questions about them!`,
        sources: response.processed_files,
        responseVersions: []
      }
      setMessages((prev) => [...prev, systemMessage])
      
      // Refresh conversation to update documents list
      const data = await getConversation(conversationId)
      setDocuments(data.documents || [])
      
    } catch (err) {
      console.error('Document upload error', err)
      setError(err.response?.data?.detail || 'Failed to upload documents')
      const errorMessage = {
        id: `${Date.now()}-error`,
        type: 'assistant',
        content: '❌ Failed to upload documents. Please try again.',
        sources: [],
        responseVersions: []
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsUploadingDocs(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleEditMessage = async (messageId) => {
    const trimmed = editContent.trim()
    if (!trimmed) return

    try {
      setIsLoading(true)
      const result = await editMessage(messageId, trimmed, true)
      const normalizedVariants = normalizeResponseVariants(
        result.response_versions || (result.regenerated_response ? [result.regenerated_response] : [])
      ).map((variant) => ({
        ...variant,
        promptContent: variant.promptContent || result.updated_message?.content || trimmed
      }))

      setMessages((prev) => prev.map((msg) => {
        if (msg.id !== messageId || msg.type !== 'user') {
          return msg
        }
        return {
          ...msg,
          content: result.updated_message.content,
          is_edited: true,
          responseVersions: normalizedVariants.length ? normalizedVariants : msg.responseVersions,
          isPending: false
        }
      }))

      setEditingMessageId(null)
      setEditContent('')

      if (normalizedVariants.length) {
        setVersionSelections((prev) => ({
          ...prev,
          [messageId]: getActiveVariantIndex(normalizedVariants) ?? (normalizedVariants.length - 1)
        }))
      }
    } catch (err) {
      console.error('Edit failed', err)
      setError('Failed to edit message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessage(messageId)
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
      setVersionSelections((prev) => {
        if (!(messageId in prev)) return prev
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    } catch (err) {
      console.error('Delete failed', err)
      setError('Failed to delete message')
    }
  }

  const showGlobalSpinner = isFetching && messages.length === 0

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white font-sans">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {documents.length > 0 && (
            <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
              <p className="font-semibold text-white mb-2">Documents in this chat</p>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <span key={doc} className="px-3 py-1 bg-gray-700 rounded-full text-xs">{doc}</span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {messages.map((message) => {
            if (message.type === 'user') {
              const versions = message.responseVersions || []
              let selectedIndex = versionSelections[message.id]
              if (
                selectedIndex === undefined ||
                selectedIndex === null ||
                selectedIndex >= versions.length ||
                selectedIndex < 0
              ) {
                selectedIndex = versions.length ? getActiveVariantIndex(versions) ?? (versions.length - 1) : null
              }
              const activeVariant = selectedIndex !== null ? versions[selectedIndex] : null
              const userPromptContent = activeVariant?.promptContent || message.content
              const assistantContent = activeVariant?.content || (message.isPending ? 'Generating response...' : '')
              const assistantSources = activeVariant?.sources || []
              const assistantKey = activeVariant?.id || `${message.id}-assistant`
              const showVersionControls = versions.length > 1

              const moveVersion = (direction) => {
                if (!versions.length) return
                setVersionSelections((prev) => {
                  const current = prev[message.id] ?? (versions.length - 1)
                  const target = direction === 'prev'
                    ? Math.max(0, current - 1)
                    : Math.min(versions.length - 1, current + 1)
                  if (target === current) return prev
                  return { ...prev, [message.id]: target }
                })
              }

              return (
                <div key={message.id} className="group py-6 border-b border-gray-800 space-y-4">
                  <div className="flex flex-row-reverse space-x-reverse space-x-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-sm font-semibold flex-shrink-0">
                      U
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                            rows="3"
                            autoFocus
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleEditMessage(message.id)}
                              disabled={isLoading}
                              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:opacity-50"
                            >
                              Update response
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(null)
                                setEditContent('')
                              }}
                              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-white leading-relaxed font-sans text-base text-right whitespace-pre-wrap">
                            {userPromptContent || message.content}
                            {message.is_edited && (
                              <span className="ml-2 text-xs text-gray-500">(edited)</span>
                            )}
                          </div>
                          {showVersionControls && (
                            <div className="mt-2 text-xs text-gray-400 flex items-center justify-end gap-3">
                              <span>Prompt {selectedIndex + 1} / {versions.length}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => moveVersion('prev')}
                                  disabled={selectedIndex === 0}
                                  className="p-1 rounded border border-gray-700 hover:border-gray-500 disabled:opacity-40"
                                  title="Show previous prompt"
                                >
                                  {'<'}
                                </button>
                                <button
                                  onClick={() => moveVersion('next')}
                                  disabled={selectedIndex === versions.length - 1}
                                  className="p-1 rounded border border-gray-700 hover:border-gray-500 disabled:opacity-40"
                                  title="Show next prompt"
                                >
                                  {'>'}
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="mt-3 flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setEditingMessageId(message.id)
                                setEditContent(userPromptContent || message.content)
                              }}
                              className="opacity-0 group-hover:opacity-100 inline-flex items-center space-x-1 text-sm text-gray-400 hover:text-white transition-opacity"
                              title="Edit message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this message?')) {
                                  handleDeleteMessage(message.id)
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 inline-flex items-center space-x-1 text-sm text-gray-400 hover:text-red-400 transition-opacity"
                              title="Delete message"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white text-sm font-semibold flex-shrink-0">
                      AI
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white leading-relaxed font-sans text-base text-left">
                        {assistantContent ? (
                          <div
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(assistantContent) }}
                          />
                        ) : (
                          <div className="text-sm text-gray-400">{message.isPending ? 'Generating response...' : 'No response yet.'}</div>
                        )}
                      </div>

                      {assistantSources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-700 text-left">
                          <p className="text-sm text-gray-400 font-sans">📄 Sources: {assistantSources.join(', ')}</p>
                        </div>
                      )}

                      {supportsSpeechOutput && assistantContent && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              if (speakingMessageId === assistantKey) {
                                stopSpeaking()
                              } else {
                                speakMessage(assistantKey, assistantContent)
                              }
                            }}
                            className="inline-flex items-center space-x-1.5 text-sm text-gray-400 hover:text-white"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {speakingMessageId === assistantKey ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              )}
                            </svg>
                            <span>{speakingMessageId === assistantKey ? 'Stop' : 'Listen'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={message.id} className="group py-6 border-b border-gray-800">
                <div className="flex space-x-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white text-sm font-semibold flex-shrink-0">
                    AI
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white leading-relaxed font-sans text-base text-left">
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-700 text-left">
                        <p className="text-sm text-gray-400 font-sans">📄 Sources: {message.sources.join(', ')}</p>
                      </div>
                    )}
                    {supportsSpeechOutput && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            if (speakingMessageId === message.id) {
                              stopSpeaking()
                            } else {
                              speakMessage(message.id, message.content)
                            }
                          }}
                          className="inline-flex items-center space-x-1.5 text-sm text-gray-400 hover:text-white"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {speakingMessageId === message.id ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            )}
                          </svg>
                          <span>{speakingMessageId === message.id ? 'Stop' : 'Listen'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {showGlobalSpinner && (
            <div className="py-6 border-b border-gray-800">
              <div className="flex space-x-4">
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  AI
                </div>
                <div className="flex-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-gray-900 p-4 border-t border-gray-800">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingDocs}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Add more documents"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={documents.length > 1 ? "Ask questions across all your documents..." : "Ask anything about your documents..."}
                className="w-full px-12 py-3 pr-28 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none overflow-hidden bg-gray-700 text-white font-sans shadow-sm"
                rows="1"
                style={{ minHeight: '48px', maxHeight: '160px' }}
                disabled={isLoading}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                {supportsSpeechInput && (
                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    className={`p-2 rounded-lg ${isListening ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'} hover:bg-gray-700 transition`}
                    title={isListening ? 'Stop listening' : 'Start voice input'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isListening ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      )}
                    </svg>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
