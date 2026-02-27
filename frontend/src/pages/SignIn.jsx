import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signin } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const SignIn = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slideDirection, setSlideDirection] = useState('next')
  
  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpired(true)
    }
  }, [searchParams])
  
  const slides = [
    {
      title: 'Chat with Your Documents',
      desc: 'Ask questions and get instant, accurate answers from your uploaded files.',
      visual: 'chat'
    },
    {
      title: 'Multi-Format Support',
      desc: 'Upload PDFs, Word documents, text files and more. We handle them all.',
      visual: 'formats'
    },
    {
      title: 'AI-Powered Insights',
      desc: 'Powered by Google Gemini for intelligent document understanding.',
      visual: 'ai'
    },
    {
      title: 'Secure & Private',
      desc: 'Your documents are encrypted and never shared with third parties.',
      visual: 'secure'
    }
  ]

  // Slideshow auto-advance with proper timing
  useEffect(() => {
    const interval = setInterval(() => {
      setSlideDirection('next')
      setCurrentSlide(prev => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [slides.length])

  const theme = {
    bg: 'bg-[#faf9f5]',
    cardBg: 'bg-white border-[#e7e5e4]',
    text: 'text-[#292524]',
    textMuted: 'text-[#78716c]',
    input: 'bg-white border-[#e7e5e4] text-[#292524]',
    accentText: 'text-[#d97757]',
  }

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
      navigate('/app')
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
    <div className={`min-h-screen ${theme.bg} flex items-center justify-center p-6 relative overflow-hidden`}>
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#faf9f5] via-white/30 to-[#faf9f5]" />
      </div>

      {/* Centered Glass Container */}
      <div className={`relative z-10 w-full max-w-5xl ${theme.cardBg} rounded-xl border shadow-sm overflow-hidden`}>
        <div className="flex flex-col lg:flex-row min-h-[600px]">
          
          {/* Left Panel - Form */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
            {/* Logo and Theme Toggle */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
                <img 
                  src="/img/icon.png" 
                  alt="DocTalk Logo" 
                  className="w-9 h-9 object-contain"
                />
                <span className={`text-xl font-semibold tracking-tight ${theme.text}`}>DocTalk</span>
              </div>

            </div>

            <div className="mb-8">
              <h1 className={`text-3xl lg:text-4xl font-bold ${theme.text} mb-3`}>Welcome back</h1>
              <p className={`${theme.textMuted} text-lg`}>Sign in to continue your journey.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={`block text-sm ${theme.textMuted} mb-2`} htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3.5 ${theme.input} border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d97757]/40 focus:border-[#d97757]/40 transition text-base`}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className={`block text-sm ${theme.textMuted} mb-2`} htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className={`w-full px-4 py-3.5 ${theme.input} border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d97757]/40 focus:border-[#d97757]/40 transition text-base`}
                  placeholder="••••••••"
                />
              </div>
              
              {sessionExpired && (
                <div className="text-sm text-[#d97757] bg-[#d97757]/10 border-[#d97757]/20 border rounded-xl p-4">
                  Your session has expired. Please sign in again.
                </div>
              )}
              
              {error && (
                <div className="text-sm text-destructive bg-destructive/5 border-destructive/20 border rounded-xl p-4">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#d97757] hover:bg-[#c4684a] text-white font-semibold rounded-lg disabled:opacity-60 transition-colors duration-200 text-base"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            
            <p className={`text-center ${theme.textMuted} mt-8`}>
              New to DocTalk?{' '}
              <Link to="/signup" className={`${theme.accentText} hover:underline font-medium`}>
                Create an account
              </Link>
            </p>
          </div>

          {/* Right Panel - Dynamic Slideshow */}
          <div className="flex-1 bg-[#f5f5f4] p-8 lg:p-12 flex flex-col justify-center relative overflow-hidden">
            {/* Slideshow Content */}
            <div className="relative h-80 flex flex-col justify-center">
              {slides.map((slide, idx) => (
                <div
                  key={slide.title}
                  className={`absolute inset-0 flex flex-col justify-center items-center transition-all duration-500 ease-in-out ${
                    currentSlide === idx 
                      ? 'opacity-100 scale-100 z-10' 
                      : 'opacity-0 scale-95 z-0'
                  }`}
                  style={{ visibility: currentSlide === idx ? 'visible' : 'hidden' }}
                >
                  {/* Visual */}
                  <div className="flex justify-center mb-8">
                    {slide.visual === 'chat' && (
                      <div className="w-48 h-36 rounded-xl bg-white p-4 shadow-sm border border-[#e7e5e4]">
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#e8a088] flex-shrink-0" />
                            <div className="h-6 bg-[#f0d9cf] rounded-lg" style={{width: '70%'}} />
                          </div>
                          <div className="flex items-start gap-2 justify-end">
                            <div className="h-6 bg-[#d97757] rounded-lg" style={{width: '60%'}} />
                            <div className="w-8 h-8 rounded-full bg-[#f0d9cf] flex-shrink-0" />
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#e8a088] flex-shrink-0" />
                            <div className="h-6 bg-[#f0d9cf] rounded-lg" style={{width: '50%'}} />
                          </div>
                        </div>
                      </div>
                    )}
                    {slide.visual === 'formats' && (
                      <div className="flex gap-3">
                        {['PDF', 'DOCX', 'TXT'].map((f, i) => (
                          <div
                            key={f}
                            className="w-16 h-20 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm border border-[#e7e5e4]"
                          >
                            <svg className="w-8 h-8 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className={`text-xs font-medium mt-1 ${theme.textMuted}`}>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {slide.visual === 'ai' && (
                      <div className="relative">
                        <div className={`w-28 h-28 rounded-full bg-[#d97757] flex items-center justify-center`}>
                          <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                      </div>
                    )}
                    {slide.visual === 'secure' && (
                      <div className="relative">
                        <div className="w-24 h-28 rounded-xl bg-white flex items-center justify-center shadow-sm border border-[#e7e5e4]">
                          <svg className="w-12 h-12 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg`}>
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="text-center">
                    <h2 className={`text-2xl font-bold ${theme.text} mb-3`}>{slide.title}</h2>
                    <p className={`${theme.textMuted} max-w-xs mx-auto`}>{slide.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Slide indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-[#d97757] w-6' : 'bg-[#e8a088]'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignIn
