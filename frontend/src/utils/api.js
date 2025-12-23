import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes timeout for slow local LLM operations
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('docTalkToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors (token expired) - automatically log out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear auth data and redirect to sign in
      localStorage.removeItem('docTalkToken')
      localStorage.removeItem('docTalkUser')
      // Only redirect if we're not already on auth pages
      if (!window.location.pathname.includes('/signin') && !window.location.pathname.includes('/signup')) {
        window.location.href = '/signin?expired=true'
      }
    }
    return Promise.reject(error)
  }
)

export const signup = async ({ name, email, password }) => {
  const response = await api.post('/auth/signup', { name, email, password })
  return response.data
}

export const signin = async ({ email, password }) => {
  const response = await api.post('/auth/signin', { email, password })
  return response.data
}

export const uploadFiles = async (files, title, llmMode = 'local') => {
  const formData = new FormData()
  if (title) {
    formData.append('title', title)
  }
  if (llmMode) {
    formData.append('llm_mode', llmMode)
  }
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await api.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export const sendMessage = async (conversationId, message, cloudModel = null) => {
  const response = await api.post('/api/chat', {
    conversation_id: conversationId,
    message,
    cloud_model: cloudModel,
  })

  return response.data
}

// Streaming chat for word-by-word responses
export const sendMessageStream = async (conversationId, message, onToken, onMeta, onDone, onError, signal = null, regenerate = false, editOptions = null, cloudModel = null, parentMessageId = undefined) => {
  const token = localStorage.getItem('docTalkToken')

  try {
    const body = {
      conversation_id: conversationId,
      message,
      regenerate,
      cloud_model: cloudModel,
    }

    // Add parent message ID for explicit branching.
    // Important: allow explicit null to represent a root message.
    if (parentMessageId !== undefined) {
      body.parent_message_id = parentMessageId
    }

    // Add edit options if provided
    if (editOptions) {
      body.is_edit = true
      body.edit_group_id = editOptions.edit_group_id
    }

    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'meta') {
              onMeta?.(data)
            } else if (data.type === 'token') {
              onToken?.(data.content)
            } else if (data.type === 'done') {
              onDone?.(data)
            } else if (data.type === 'error') {
              onError?.(data.message)
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e)
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      // User stopped generation - don't report as error
      return
    }
    onError?.(error.message)
  }
}

export const downloadChat = async (conversationId, format = 'txt') => {
  const response = await api.post('/api/download', {
    conversation_id: conversationId,
    format,
  }, {
    responseType: 'blob',
  })

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `chat_history.${format}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const listConversations = async () => {
  const response = await api.get('/api/conversations')
  return response.data
}

export const getConversation = async (conversationId) => {
  const response = await api.get(`/api/conversations/${conversationId}`)
  return response.data
}

export const deleteConversation = async (conversationId) => {
  await api.delete(`/api/conversations/${conversationId}`)
}

export const addDocumentsToConversation = async (conversationId, files) => {
  const formData = new FormData()
  files.forEach(file => {
    formData.append('files', file)
  })

  const response = await api.post(`/api/add-documents/${conversationId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export const editMessage = async (messageId, content, regenerate = false) => {
  const response = await api.put(`/api/messages/${messageId}`,
    { content },
    { params: { regenerate } }
  )
  return response.data
}

export const deleteMessage = async (messageId) => {
  await api.delete(`/api/messages/${messageId}`)
}

export const updateProfile = async (updates) => {
  const response = await api.put('/auth/profile', updates)
  return response.data
}

export const changePassword = async (payload) => {
  const response = await api.post('/auth/change-password', payload)
  return response.data
}

export const deleteAccount = async (payload) => {
  const response = await api.delete('/auth/account', { data: payload })
  return response.data
}

export const verifyToken = async () => {
  const response = await api.get('/auth/verify-token')
  return response.data
}

export const deleteDocument = async (conversationId, documentId) => {
  await api.delete(`/api/conversations/${conversationId}/documents/${documentId}`)
}

export const createNote = async (conversationId, title, content) => {
  const response = await api.post(`/api/conversations/${conversationId}/notes`, { title, content })
  return response.data
}

export const updateNote = async (conversationId, noteId, title, content) => {
  const response = await api.put(`/api/conversations/${conversationId}/notes/${noteId}`, { title, content })
  return response.data
}

export const convertNoteToSource = async (conversationId, noteId) => {
  const response = await api.post(`/api/conversations/${conversationId}/notes/${noteId}/convert`)
  return response.data
}

export const unconvertNoteFromSource = async (conversationId, noteId) => {
  const response = await api.post(`/api/conversations/${conversationId}/notes/${noteId}/unconvert`)
  return response.data
}

export const toggleDocument = async (conversationId, documentId, isActive) => {
  const response = await api.patch(`/api/conversations/${conversationId}/documents/${documentId}/toggle`, { is_active: isActive })
  return response.data
}

export const getFlashcards = async (conversationId) => {
  const response = await api.get(`/api/conversations/${conversationId}/flashcards`)
  return response.data
}

export const generateFlashcards = async (conversationId, cloudModel = null) => {
  const token = localStorage.getItem('docTalkToken');
  const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

  console.log('[Flashcards] Starting generation for conversation:', conversationId, 'model:', cloudModel, 'API:', API_BASE_URL);

  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/flashcards/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ cloud_model: cloudModel })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Flashcards] Generation failed:', errorData);
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  console.log('[Flashcards] Generation complete, cards:', data?.flashcards?.length);
  return data;
}

export const deleteFlashcard = async (conversationId, flashcardId) => {
  await api.delete(`/api/conversations/${conversationId}/flashcards/${flashcardId}`)
}

export const deleteAllFlashcards = async (conversationId) => {
  await api.delete(`/api/conversations/${conversationId}/flashcards`)
}

export const getMindMap = async (conversationId) => {
  const response = await api.get(`/api/conversations/${conversationId}/mindmap`)
  return response.data
}

export const generateMindMap = async (conversationId, cloudModel = null) => {
  const token = localStorage.getItem('docTalkToken');
  const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/mindmap/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ cloud_model: cloudModel })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }

  return await response.json();
}

export const deleteMindMap = async (conversationId) => {
  await api.delete(`/api/conversations/${conversationId}/mindmap`)
}
