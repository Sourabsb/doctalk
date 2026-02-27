import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signup } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const SignUp = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slideDirection, setSlideDirection] = useState('next')

  const slides = [
    {
      title: 'Upload Your Documents',
      desc: 'Drag and drop PDFs, Word docs, or text files to get started instantly.',
      visual: 'upload'
    },
    {
      title: 'Ask Anything',
      desc: 'Get answers, summaries, and insights from your documents in seconds.',
      visual: 'ask'
    },
    {
      title: 'Stay Organized',
      desc: 'Keep all your conversations and documents organized in one place.',
      visual: 'organize'
    },
    {
      title: 'Free to Start',
      desc: 'No credit card required. Start chatting with your documents today.',
      visual: 'free'
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
      const data = await signup(form)
      login(data)
      navigate('/app')
    } catch (err) {
      console.error('SignUp error:', err)
      let message = 'Unable to sign up. Please try again.'
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
        <div className="flex flex-col lg:flex-row min-h-[650px]">
          
          {/* Left Panel - Form */}
          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
            {/* Logo and Theme Toggle */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
                <img 
                  src="/img/icon.png" 
                  alt="DocTalk Logo" 
                  className="w-9 h-9 object-contain"
                />
                <span className={`text-xl font-semibold tracking-tight ${theme.text}`}>DocTalk</span>
              </div>

            </div>

            <div className="mb-6">
              <h1 className={`text-3xl lg:text-4xl font-bold ${theme.text} mb-3`}>Create your account</h1>
              <p className={`${theme.textMuted} text-lg`}>Start exploring your documents with AI.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm ${theme.textMuted} mb-2`} htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3.5 ${theme.input} border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d97757]/40 focus:border-[#d97757]/40 transition text-base`}
                  placeholder="John Doe"
                />
              </div>
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
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
            
            <p className={`text-center ${theme.textMuted} mt-6`}>
              Already have an account?{' '}
              <Link to="/signin" className={`${theme.accentText} hover:underline font-medium`}>
                Sign in
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
                    {slide.visual === 'upload' && (
                      <div className="w-40 h-32 rounded-xl border-2 border-dashed border-[#d97757]/40 bg-white flex flex-col items-center justify-center shadow-sm">
                        <svg className="w-12 h-12 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className={`text-sm mt-2 ${theme.textMuted}`}>Drop files here</span>
                      </div>
                    )}
                    {slide.visual === 'ask' && (
                      <div className="w-48 h-36 rounded-xl bg-white p-4 shadow-sm border border-[#e7e5e4]">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f0d9cf]">
                            <svg className="w-5 h-5 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className={`text-sm ${theme.textMuted}`}>What is...?</span>
                          </div>
                          <div className="h-4 bg-[#f0d9cf] rounded-lg" style={{width: '90%'}} />
                          <div className="h-4 bg-[#f5ebe5] rounded-lg" style={{width: '70%'}} />
                        </div>
                      </div>
                    )}
                    {slide.visual === 'organize' && (
                      <div className="flex gap-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-14 h-18 rounded-xl bg-white p-2 shadow-sm border border-[#e7e5e4] flex flex-col items-center"
                          >
                            <svg className="w-8 h-8 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            <div className="w-full h-1.5 bg-[#f0d9cf] rounded-full mt-2" />
                          </div>
                        ))}
                      </div>
                    )}
                    {slide.visual === 'free' && (
                      <div className="relative">
                        <div className={`w-28 h-28 rounded-full bg-[#d97757] flex items-center justify-center`}>
                          <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

export default SignUp
