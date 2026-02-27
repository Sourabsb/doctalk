import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isVerifying } = useAuth()

  // Show loading while verifying token
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f5]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#d97757] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[#78716c] text-sm">Verifying session...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  return children
}

export default ProtectedRoute
