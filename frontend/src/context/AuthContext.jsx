import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'

const AuthContext = createContext({})

const readToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('docTalkToken')
}

const readUser = () => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('docTalkUser')
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch (error) {
    console.warn('Invalid user data in storage, resetting.', error)
    localStorage.removeItem('docTalkUser')
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(readToken)
  const [user, setUser] = useState(readUser)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (token) {
      localStorage.setItem('docTalkToken', token)
    } else {
      localStorage.removeItem('docTalkToken')
    }
  }, [token])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (user) {
      localStorage.setItem('docTalkUser', JSON.stringify(user))
    } else {
      localStorage.removeItem('docTalkUser')
    }
  }, [user])

  const login = (authPayload) => {
    setToken(authPayload.access_token)
    setUser(authPayload.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    // Clear any active session data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeConversationId')
    }
  }

  const updateUser = (nextUser) => {
    setUser(nextUser)
  }

  const value = useMemo(() => ({
    token,
    user,
    login,
    logout,
    updateUser,
    isAuthenticated: Boolean(token)
  }), [token, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
