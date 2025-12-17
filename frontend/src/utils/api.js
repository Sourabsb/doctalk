import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('docTalkToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const signup = async ({ name, email, password }) => {
  const response = await api.post('/auth/signup', { name, email, password })
  return response.data
}

export const signin = async ({ email, password }) => {
  const response = await api.post('/auth/signin', { email, password })
  return response.data
}

export const uploadFiles = async (files, title) => {
  const formData = new FormData()
  if (title) {
    formData.append('title', title)
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

export const sendMessage = async (conversationId, message) => {
  const response = await api.post('/api/chat', {
    conversation_id: conversationId,
    message,
  })
  
  return response.data
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
