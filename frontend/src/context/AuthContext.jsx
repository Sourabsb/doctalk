import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { verifyToken } from '../utils/api'

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
    localStorage.removeItem('docTalkUser')
    return null
  }
}

const isNewBrowserSession = () => {
  if (typeof window === 'undefined') return true
  return !sessionStorage.getItem('docTalkSessionActive')
}

const markSessionActive = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('docTalkSessionActive', 'true')
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    if (isNewBrowserSession()) {
      localStorage.removeItem('docTalkToken')
      localStorage.removeItem('docTalkUser')
      return null
    }
    return readToken()
  })
  const [user, setUser] = useState(() => {
    if (isNewBrowserSession()) return null
    return readUser()
  })
  const [isVerifying, setIsVerifying] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)

  useEffect(() => {
    markSessionActive()
  }, [])

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
    setIsValidToken(true)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setIsValidToken(false)
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
    isAuthenticated: Boolean(token) && isValidToken,
    isVerifying
  }), [token, user, isValidToken, isVerifying])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
