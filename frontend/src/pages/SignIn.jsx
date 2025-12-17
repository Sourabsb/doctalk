import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signin } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const SignIn = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const data = await signin(form)
      login(data)
      navigate('/')
    } catch (err) {
      console.error('SignIn error:', err)
      let message = 'Unable to sign in. Please try again.'
      
      if (err?.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          message = err.response.data.detail
        } else if (Array.isArray(err.response.data.detail)) {
          message = err.response.data.detail.map(e => e.msg || e.message).join(', ')
        }
      } else if (err?.message) {
        message = err.message
      }
      
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome back to DocTalk</h1>
          <p className="text-gray-400 mt-2">Sign in to continue chatting with your documents.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-300 mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 rounded-xl font-semibold transition"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-6">
          New to DocTalk?{' '}
          <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default SignIn
