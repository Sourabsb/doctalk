import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const Landing = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isVerifying } = useAuth()

  // Initialize theme from localStorage
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('doctalk-theme')
    if (saved === 'light') return false
    if (saved === 'dark') return true
    return true // default to dark
  })

  const [activeSlide, setActiveSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [featureAnimFrame, setFeatureAnimFrame] = useState(0)

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('doctalk-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const handleTry = () => {
    // If still verifying, wait for it to complete
    if (isVerifying) return
    // Only go to app if actually authenticated (token verified)
    navigate(isAuthenticated ? '/app' : '/signin')
  }

  const goToSlide = (idx) => {
    if (isAnimating) return
    setIsAnimating(true)
    setTimeout(() => {
      setActiveSlide(idx)
      setIsAnimating(false)
    }, 200)
  }

  const nextSlide = () => goToSlide((activeSlide + 1) % 3)
  const prevSlide = () => goToSlide((activeSlide - 1 + 3) % 3)

  useEffect(() => {
    if (isHovered) return
    const interval = setInterval(nextSlide, 4000)
    return () => clearInterval(interval)
  }, [activeSlide, isHovered])

  // Feature animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setFeatureAnimFrame(prev => (prev + 1) % 100)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const slides = [
    {
      title: 'Ask anything about your docs',
      desc: 'Get instant answers from your uploaded documents. AI understands context across all your files.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Get instant insights',
      desc: 'Generate summaries, key points, and actionable insights from your content automatically.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      title: 'See the source, not just answers',
      desc: 'Every response comes with citations. Gain confidence with transparent, grounded answers.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ]

  const useCases = [
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      title: 'Power study',
      desc: 'Upload lecture notes, textbook chapters, and research papers. Get complex concepts explained simply.'
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      title: 'Organize your thinking',
      desc: 'Upload source material and create polished presentation outlines with key talking points.'
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      title: 'Spark new ideas',
      desc: 'Upload brainstorming notes and market research. Identify trends and uncover hidden opportunities.'
    }
  ]

  const features = [
    {
      title: 'Multi-format support',
      desc: 'Upload PDFs, DOC, and TXT files. All your documents processed seamlessly.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      visual: ['PDF', 'DOC', 'TXT']
    },
    {
      title: 'Cross-document Q&A',
      desc: 'Ask questions that span multiple files. Get unified answers with source citations.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      visual: 'chat'
    },
    {
      title: 'Voice input',
      desc: 'Speak your questions naturally. Voice-to-text for hands-free document queries.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      ),
      visual: 'voice'
    },
    {
      title: 'Response regeneration',
      desc: 'Not satisfied? Regenerate responses to get a fresh AI perspective.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      visual: 'versions'
    },
    {
      title: 'Secure & private',
      desc: 'Your data stays safe and confidential. Enterprise-grade security.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      visual: 'secure'
    },
    {
      title: 'Export conversations',
      desc: 'Download chats as PDF, TXT, or JSON. Keep your insights forever.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      visual: 'export'
    }
  ]

  const theme = {
    bg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#fefcf9]',
    text: isDark ? 'text-white' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-600',
    textSubtle: isDark ? 'text-gray-500' : 'text-gray-500',
    card: isDark ? 'bg-white/[0.03] border-white/10 backdrop-blur-xl' : 'bg-white/70 border-amber-100/50 backdrop-blur-xl',
    cardHover: isDark ? 'hover:bg-white/[0.06] hover:border-white/20' : 'hover:bg-white/90 hover:border-amber-200',
    navBg: isDark ? 'bg-black/40 backdrop-blur-2xl' : 'bg-white/60 backdrop-blur-2xl',
    accent: 'from-amber-300 to-amber-500',
    accentLight: 'from-amber-200 to-amber-400',
    accentText: isDark ? 'text-amber-300' : 'text-amber-600',
    btnPrimary: 'bg-gradient-to-r from-amber-300 to-amber-500',
    btnSecondary: isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-amber-50/80 border-amber-200/50 hover:bg-amber-100/80',
    divider: isDark ? 'border-white/5' : 'border-amber-100/50',
    glass: isDark ? 'bg-white/[0.02] backdrop-blur-3xl' : 'bg-white/40 backdrop-blur-3xl',
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-500 relative`}>

      {/* Glass background with ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-br from-amber-950/20 via-transparent to-orange-950/10' : 'bg-gradient-to-br from-amber-100/30 via-transparent to-orange-50/20'}`} />
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] ${isDark ? 'bg-amber-500/8' : 'bg-amber-300/15'} blur-[180px] rounded-full`} />
        <div className={`absolute bottom-0 right-0 w-[600px] h-[400px] ${isDark ? 'bg-orange-500/5' : 'bg-orange-200/10'} blur-[150px] rounded-full`} />
        <div className={`absolute top-1/2 left-0 w-[400px] h-[400px] ${isDark ? 'bg-amber-400/5' : 'bg-amber-200/10'} blur-[120px] rounded-full`} />
      </div>

      {/* Navigation */}
      <header className={`sticky top-0 z-50 ${theme.navBg} border-b ${theme.divider} transition-all duration-500`}>
        <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${theme.accent} flex items-center justify-center shadow-lg shadow-amber-500/25`}>
              <span className="text-gray-900 font-bold text-base">D</span>
            </div>
            <span className={`text-lg font-semibold tracking-tight ${theme.text}`}>DocTalk</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-full ${theme.btnSecondary} transition-all duration-300 border`}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => navigate('/signin')}
              className={`text-sm ${theme.textMuted} hover:${theme.text} transition px-3 py-1.5`}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className={`text-sm font-medium ${theme.btnPrimary} text-gray-900 rounded-full px-5 py-2 transition shadow-md shadow-amber-500/20 hover:shadow-amber-500/30`}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - Full screen height */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
        <p className={`text-4xl md:text-5xl font-semibold mb-6`}>
          <span className={theme.text}>Meet </span>
          <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">DocTalk</span>
        </p>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-8">
          <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
            Your AI Document Assistant
          </span>
        </h1>
        <p className={`text-xl md:text-2xl ${theme.textMuted} max-w-3xl mx-auto mb-14 leading-relaxed`}>
          Transform any document into intelligent conversations. Upload, ask questions, and get instant AI-powered insights.
        </p>
        <button
          onClick={handleTry}
          className={`${theme.btnPrimary} text-gray-900 font-semibold px-12 py-4 rounded-full shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all duration-300 text-lg`}
        >
          Try DocTalk
        </button>
      </section>

      {/* Slideshow Section - with navigation arrows */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>Your AI-Powered Research Partner</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>
          A seamless workflow from upload to insight
        </p>

        {/* Slide Container with arrows */}
        <div
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left Arrow */}
          <button
            onClick={prevSlide}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full ${theme.card} border flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:-translate-x-6 transition-all duration-300 hover:scale-110 ${theme.accentText}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right Arrow */}
          <button
            onClick={nextSlide}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full ${theme.card} border flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-6 transition-all duration-300 hover:scale-110 ${theme.accentText}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Slide Content */}
          <div className="grid md:grid-cols-2 gap-16 items-center min-h-[350px] px-8">
            <div className={`space-y-6 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
              <div className={`w-14 h-14 rounded-2xl ${isDark ? 'bg-amber-400/10' : 'bg-amber-100'} flex items-center justify-center ${theme.accentText}`}>
                {slides[activeSlide].icon}
              </div>
              <h3 className={`text-3xl font-semibold ${theme.text}`}>{slides[activeSlide].title}</h3>
              <p className={`text-xl ${theme.textMuted} leading-relaxed`}>{slides[activeSlide].desc}</p>
            </div>

            {/* Preview Card */}
            <div className={`rounded-3xl ${theme.card} border p-8 shadow-2xl transition-all duration-300 ${isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                <div className="w-3 h-3 rounded-full bg-green-400/60" />
              </div>
              <div className={`rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-400/10 via-amber-500/5 to-transparent' : 'bg-gradient-to-br from-amber-100 via-amber-50 to-white'} p-10 min-h-[220px] flex items-center justify-center`}>
                <div className="text-center space-y-5">
                  <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${theme.accent} shadow-lg shadow-amber-500/30 flex items-center justify-center transition-transform duration-300 ${isAnimating ? 'scale-90 rotate-12' : 'scale-100 rotate-0'}`}>
                    <span className="text-gray-900">{slides[activeSlide].icon}</span>
                  </div>
                  <p className={`${theme.textMuted} font-medium`}>{slides[activeSlide].title}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="flex items-center justify-center gap-3 mt-14">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${idx === activeSlide
                ? `w-10 bg-gradient-to-r ${theme.accent}`
                : `w-2 ${isDark ? 'bg-white/20 hover:bg-white/30' : 'bg-amber-200 hover:bg-amber-300'}`
                }`}
            />
          ))}
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>How people are using DocTalk</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>From students to professionals</p>

        <div className="grid md:grid-cols-3 gap-10">
          {/* Power Study Card */}
          <div className={`p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] ${theme.card} border group overflow-hidden`}>
            {/* Animated visual area */}
            <div className={`w-full h-44 rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent' : 'bg-gradient-to-br from-amber-50 via-orange-50/50 to-white'} flex items-center justify-center mb-6 relative overflow-hidden`}>
              {/* Multiple books with visible page flipping */}
              <div className="relative flex items-end justify-center gap-3">

                {/* Small Book - Left (closed, tilted) */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(-12deg) translateY(${Math.sin(featureAnimFrame * 0.08) * 3}px)`
                  }}
                >
                  <div className={`w-8 h-14 ${isDark ? 'bg-orange-400' : 'bg-orange-300'} rounded-sm shadow-lg relative`}>
                    <div className={`absolute left-0 top-0 w-1 h-full ${isDark ? 'bg-orange-600' : 'bg-orange-400'} rounded-l-sm`} />
                    <div className="absolute inset-1 flex flex-col justify-center gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className={`h-0.5 ${isDark ? 'bg-orange-200/50' : 'bg-orange-100'} rounded mx-0.5`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Open Book - Center with flipping pages */}
                <div className="relative" style={{ perspective: '500px' }}>
                  {/* Book base/spine */}
                  <div className={`w-28 h-20 relative`}>
                    {/* Center spine */}
                    <div className={`absolute left-1/2 -translate-x-1/2 top-0 w-2 h-full ${isDark ? 'bg-amber-700' : 'bg-amber-400'} rounded-sm z-20`} />

                    {/* Left page (static) */}
                    <div className={`absolute left-0 top-0 w-14 h-20 ${isDark ? 'bg-amber-100' : 'bg-white'} rounded-l-md shadow-md`}>
                      <div className="p-2 space-y-1.5">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className={`h-1 ${isDark ? 'bg-amber-300/60' : 'bg-amber-200'} rounded`} style={{ width: `${70 + (i % 3) * 10}%`, marginLeft: 'auto' }} />
                        ))}
                      </div>
                    </div>

                    {/* Right page (static) */}
                    <div className={`absolute right-0 top-0 w-14 h-20 ${isDark ? 'bg-amber-100' : 'bg-white'} rounded-r-md shadow-md`}>
                      <div className="p-2 space-y-1.5">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className={`h-1 ${isDark ? 'bg-amber-300/60' : 'bg-amber-200'} rounded`} style={{ width: `${60 + (i % 3) * 12}%` }} />
                        ))}
                      </div>
                    </div>

                    {/* Flipping page - animates from right to left */}
                    {(() => {
                      const flipProgress = (featureAnimFrame * 3) % 360
                      const rotation = Math.min(flipProgress, 180)
                      const isFlipping = flipProgress < 180

                      return (
                        <div
                          className={`absolute top-0 w-14 h-20 rounded-md shadow-lg z-30`}
                          style={{
                            left: '50%',
                            transformOrigin: 'left center',
                            transform: `rotateY(${-rotation}deg)`,
                            transformStyle: 'preserve-3d',
                          }}
                        >
                          {/* Front of page */}
                          <div
                            className={`absolute inset-0 ${isDark ? 'bg-amber-50' : 'bg-white'} rounded-r-md backface-hidden`}
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className={`h-1 ${isDark ? 'bg-amber-400/50' : 'bg-amber-300'} rounded`} style={{ width: `${50 + (i % 4) * 12}%` }} />
                              ))}
                            </div>
                          </div>
                          {/* Back of page */}
                          <div
                            className={`absolute inset-0 ${isDark ? 'bg-amber-100' : 'bg-gray-50'} rounded-l-md`}
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className={`h-1 ${isDark ? 'bg-amber-300/40' : 'bg-gray-200'} rounded`} style={{ width: `${60 + (i % 3) * 10}%`, marginLeft: 'auto' }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Second flipping page (offset timing) */}
                    {(() => {
                      const flipProgress = ((featureAnimFrame * 3) + 120) % 360
                      const rotation = Math.min(flipProgress, 180)

                      return (
                        <div
                          className={`absolute top-0 w-14 h-20 rounded-md shadow-lg z-25`}
                          style={{
                            left: '50%',
                            transformOrigin: 'left center',
                            transform: `rotateY(${-rotation}deg)`,
                            transformStyle: 'preserve-3d',
                          }}
                        >
                          <div
                            className={`absolute inset-0 ${isDark ? 'bg-orange-50' : 'bg-amber-50'} rounded-r-md`}
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className={`h-1 ${isDark ? 'bg-orange-300/50' : 'bg-amber-200'} rounded`} style={{ width: `${55 + (i % 3) * 15}%` }} />
                              ))}
                            </div>
                          </div>
                          <div
                            className={`absolute inset-0 ${isDark ? 'bg-orange-100' : 'bg-amber-100'} rounded-l-md`}
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className={`h-1 ${isDark ? 'bg-orange-200/40' : 'bg-amber-200/60'} rounded`} style={{ width: `${65 + (i % 2) * 10}%`, marginLeft: 'auto' }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Medium Book - Right (slightly open) */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(8deg) translateY(${Math.sin((featureAnimFrame + 20) * 0.08) * 3}px)`,
                    perspective: '300px'
                  }}
                >
                  <div className={`w-12 h-16 relative`}>
                    {/* Spine */}
                    <div className={`absolute left-1/2 -translate-x-1/2 top-0 w-1 h-full ${isDark ? 'bg-amber-600' : 'bg-amber-400'} z-10`} />
                    {/* Left cover */}
                    <div
                      className={`absolute left-0 top-0 w-6 h-16 ${isDark ? 'bg-amber-500' : 'bg-amber-300'} rounded-l-sm shadow-md origin-right`}
                      style={{ transform: 'rotateY(-30deg)' }}
                    />
                    {/* Right cover */}
                    <div
                      className={`absolute right-0 top-0 w-6 h-16 ${isDark ? 'bg-amber-500' : 'bg-amber-300'} rounded-r-sm shadow-md origin-left`}
                      style={{ transform: 'rotateY(30deg)' }}
                    />
                    {/* Page peek */}
                    <div className={`absolute left-1 top-1 w-4 h-14 ${isDark ? 'bg-amber-100' : 'bg-white'} rounded-l-sm origin-right`} style={{ transform: 'rotateY(-20deg)' }} />
                  </div>
                </div>

                {/* Tiny book - Far right */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(15deg) translateY(${Math.sin((featureAnimFrame + 40) * 0.1) * 2}px)`
                  }}
                >
                  <div className={`w-6 h-10 ${isDark ? 'bg-orange-500' : 'bg-orange-400'} rounded-sm shadow-md`}>
                    <div className={`absolute left-0 top-0 w-0.5 h-full ${isDark ? 'bg-orange-700' : 'bg-orange-500'}`} />
                  </div>
                </div>
              </div>

              {/* Floating sparkles/highlights */}
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`absolute w-2 h-2 rounded-full ${isDark ? 'bg-amber-400/60' : 'bg-amber-400/80'}`}
                  style={{
                    left: `${25 + i * 18}%`,
                    top: `${20 + Math.sin((featureAnimFrame + i * 30) * 0.1) * 15}%`,
                    opacity: 0.5 + Math.sin((featureAnimFrame + i * 20) * 0.12) * 0.4,
                    transform: `scale(${0.5 + Math.sin((featureAnimFrame + i * 15) * 0.15) * 0.5})`
                  }}
                />
              ))}
            </div>
            <h3 className={`text-2xl font-semibold ${theme.text} mb-3`}>Power study</h3>
            <p className={`${theme.textMuted} leading-relaxed text-lg`}>Upload lecture notes, textbook chapters, and research papers. Get complex concepts explained simply.</p>
          </div>

          {/* Organize Thinking Card */}
          <div className={`p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] ${theme.card} border group overflow-hidden`}>
            {/* Animated visual area */}
            <div className={`w-full h-44 rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent' : 'bg-gradient-to-br from-amber-50 via-orange-50/50 to-white'} flex items-center justify-center mb-6 relative overflow-hidden`}>
              {/* Clipboard with checkmarks appearing */}
              <div className="relative">
                {/* Clipboard */}
                <div className={`w-20 h-28 rounded-lg ${isDark ? 'bg-amber-500/30' : 'bg-amber-200'} relative`}>
                  {/* Clipboard clip */}
                  <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 ${isDark ? 'bg-amber-600/60' : 'bg-amber-400'} rounded-t-lg`}>
                    <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-6 h-2 ${isDark ? 'bg-amber-300/50' : 'bg-amber-100'} rounded`} />
                  </div>
                  {/* Paper */}
                  <div className={`absolute top-4 left-2 right-2 bottom-2 ${isDark ? 'bg-amber-100/90' : 'bg-white'} rounded`}>
                    {/* Checklist items */}
                    {[0, 1, 2, 3].map((i) => {
                      const checkDelay = (featureAnimFrame * 0.08 + i * 0.8) % 4
                      const isChecked = checkDelay > 0.5
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1.5 py-1">
                          <div className={`w-3 h-3 rounded border ${isDark ? 'border-amber-400' : 'border-amber-400'} flex items-center justify-center transition-all duration-200`}>
                            {isChecked && (
                              <svg className={`w-2 h-2 ${isDark ? 'text-amber-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className={`h-1.5 ${isDark ? 'bg-amber-300/50' : 'bg-amber-200'} rounded flex-1`} style={{ opacity: isChecked ? 0.5 : 1 }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Floating organization elements */}
                <div
                  className={`absolute -right-6 top-2 w-8 h-8 rounded ${isDark ? 'bg-orange-400/30' : 'bg-orange-200'} flex items-center justify-center`}
                  style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.1) * 5}px) rotate(${Math.sin(featureAnimFrame * 0.08) * 5}deg)` }}
                >
                  <span className="text-xs">1</span>
                </div>
                <div
                  className={`absolute -left-5 bottom-4 w-8 h-8 rounded ${isDark ? 'bg-amber-400/30' : 'bg-amber-200'} flex items-center justify-center`}
                  style={{ transform: `translateY(${Math.sin((featureAnimFrame + 20) * 0.1) * 5}px) rotate(${Math.sin((featureAnimFrame + 20) * 0.08) * -5}deg)` }}
                >
                  <span className="text-xs">2</span>
                </div>
              </div>
            </div>
            <h3 className={`text-2xl font-semibold ${theme.text} mb-3`}>Organize your thinking</h3>
            <p className={`${theme.textMuted} leading-relaxed text-lg`}>Upload source material and create polished presentation outlines with key talking points.</p>
          </div>

          {/* Spark Ideas Card */}
          <div className={`p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02] ${theme.card} border group overflow-hidden`}>
            {/* Animated visual area */}
            <div className={`w-full h-40 rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent' : 'bg-gradient-to-br from-amber-50 via-orange-50/50 to-white'} flex items-center justify-center mb-6 relative overflow-hidden`}>
              {/* Lightbulb with glowing effect */}
              <div className="relative">
                {/* Glow effect */}
                <div
                  className={`absolute inset-0 ${isDark ? 'bg-amber-400' : 'bg-amber-300'} rounded-full blur-xl`}
                  style={{
                    transform: `scale(${1.5 + Math.sin(featureAnimFrame * 0.12) * 0.5})`,
                    opacity: 0.2 + Math.sin(featureAnimFrame * 0.12) * 0.15
                  }}
                />
                {/* Lightbulb */}
                <div className="relative">
                  <svg
                    className={`w-16 h-16 ${isDark ? 'text-amber-400' : 'text-amber-500'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ filter: `drop-shadow(0 0 ${8 + Math.sin(featureAnimFrame * 0.12) * 4}px ${isDark ? 'rgba(251, 191, 36, 0.5)' : 'rgba(251, 191, 36, 0.4)'})` }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                {/* Spark particles */}
                {[...Array(6)].map((_, i) => {
                  const angle = (i * 60 + featureAnimFrame * 2) * (Math.PI / 180)
                  const radius = 35 + Math.sin((featureAnimFrame + i * 10) * 0.15) * 10
                  return (
                    <div
                      key={i}
                      className={`absolute w-2 h-2 ${isDark ? 'bg-amber-400' : 'bg-amber-400'}`}
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                        opacity: 0.3 + Math.sin((featureAnimFrame + i * 15) * 0.2) * 0.4,
                        borderRadius: i % 2 === 0 ? '50%' : '2px',
                        width: i % 2 === 0 ? '6px' : '8px',
                        height: i % 2 === 0 ? '6px' : '3px',
                        rotate: `${angle * 180 / Math.PI}deg`
                      }}
                    />
                  )
                })}
              </div>
            </div>
            <h3 className={`text-2xl font-semibold ${theme.text} mb-3`}>Spark new ideas</h3>
            <p className={`${theme.textMuted} leading-relaxed text-lg`}>Upload brainstorming notes and market research. Identify trends and uncover hidden opportunities.</p>
          </div>
        </div>
      </section>

      {/* Features Grid - Large cards with dynamic visuals */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>What's included</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>Everything you need for document intelligence</p>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((item, idx) => (
            <div
              key={item.title}
              className={`rounded-3xl border ${theme.card} ${theme.cardHover} p-8 transition-all duration-500 group overflow-hidden`}
            >
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1 space-y-4">
                  <div className={`w-14 h-14 rounded-2xl ${isDark ? 'bg-amber-400/10' : 'bg-amber-100'} flex items-center justify-center ${theme.accentText} group-hover:scale-110 transition-transform duration-300`}>
                    {item.icon}
                  </div>
                  <h3 className={`text-2xl font-semibold ${theme.text}`}>{item.title}</h3>
                  <p className={`${theme.textMuted} leading-relaxed text-lg`}>{item.desc}</p>
                </div>

                {/* Dynamic Visual area */}
                <div className={`w-full md:w-56 h-36 rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent' : 'bg-gradient-to-br from-amber-100 via-orange-50 to-white'} flex items-center justify-center overflow-hidden relative`}>
                  {item.visual === 'chat' && (
                    <div className="space-y-3 p-4 w-full">
                      <div className="flex items-start gap-2">
                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-amber-400/30' : 'bg-amber-300'} flex-shrink-0`} />
                        <div className={`h-4 ${isDark ? 'bg-white/20' : 'bg-amber-200'} rounded-lg`} style={{ width: `${40 + (featureAnimFrame % 30)}%` }} />
                      </div>
                      <div className="flex items-start gap-2 justify-end">
                        <div className={`h-4 ${isDark ? 'bg-amber-400/40' : 'bg-amber-400'} rounded-lg`} style={{ width: `${30 + ((featureAnimFrame + 10) % 25)}%` }} />
                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-white/20' : 'bg-amber-200'} flex-shrink-0`} />
                      </div>
                      <div className="flex items-start gap-2">
                        <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-amber-400/30' : 'bg-amber-300'} flex-shrink-0`} />
                        <div className={`h-4 ${isDark ? 'bg-white/20' : 'bg-amber-200'} rounded-lg`} style={{ width: `${50 + ((featureAnimFrame + 20) % 20)}%` }} />
                      </div>
                    </div>
                  )}
                  {item.visual === 'voice' && (
                    <div className="flex items-end gap-1 h-20 px-4">
                      {[...Array(12)].map((_, i) => {
                        const height = Math.sin((featureAnimFrame + i * 8) * 0.15) * 25 + 30
                        return (
                          <div
                            key={i}
                            className={`w-2 ${isDark ? 'bg-amber-400/70' : 'bg-amber-400'} rounded-full transition-all duration-100`}
                            style={{ height: `${height}px` }}
                          />
                        )
                      })}
                    </div>
                  )}
                  {item.visual === 'versions' && (
                    <div className="flex gap-3 items-end">
                      {['V1', 'V2', 'V3'].map((v, i) => {
                        const isActive = Math.floor(featureAnimFrame / 20) % 3 === i
                        return (
                          <div
                            key={v}
                            className={`w-14 rounded-xl border flex flex-col items-center justify-center text-xs font-medium transition-all duration-300 ${isActive
                              ? (isDark ? 'bg-amber-400/40 border-amber-400 h-20' : 'bg-amber-300 border-amber-400 h-20')
                              : (isDark ? 'bg-white/10 border-white/20 h-16' : 'bg-amber-100 border-amber-200 h-16')
                              } ${theme.textMuted}`}
                          >
                            {v}
                            {isActive && <span className="text-[10px] mt-1 opacity-70">Active</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {item.visual === 'secure' && (
                    <div className="relative">
                      <div className={`w-20 h-24 rounded-xl ${isDark ? 'bg-amber-400/20' : 'bg-amber-200'} flex items-center justify-center transition-all duration-300`} style={{ transform: `scale(${1 + Math.sin(featureAnimFrame * 0.05) * 0.05})` }}>
                        <svg className={`w-10 h-10 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className={`absolute -top-2 -right-2 w-7 h-7 rounded-full ${isDark ? 'bg-green-500' : 'bg-green-400'} flex items-center justify-center shadow-lg`}>
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {/* Animated ring */}
                      <div className={`absolute inset-0 -m-2 rounded-2xl border-2 ${isDark ? 'border-amber-400/30' : 'border-amber-300'} animate-ping opacity-30`} style={{ animationDuration: '2s' }} />
                    </div>
                  )}
                  {item.visual === 'export' && (
                    <div className="flex flex-col gap-2">
                      {['PDF', 'TXT', 'JSON'].map((f, i) => {
                        const isDownloading = Math.floor(featureAnimFrame / 25) % 3 === i
                        return (
                          <div
                            key={f}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 ${isDownloading
                              ? (isDark ? 'bg-amber-400/30 scale-105' : 'bg-amber-300 scale-105')
                              : (isDark ? 'bg-white/10' : 'bg-amber-100')
                              } text-sm font-medium ${theme.textMuted}`}
                          >
                            <span>.{f.toLowerCase()}</span>
                            {isDownloading && (
                              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {Array.isArray(item.visual) && (
                    <div className="flex flex-wrap gap-2 justify-center p-2">
                      {item.visual.map((f, i) => {
                        const isActive = Math.floor(featureAnimFrame / 15) % item.visual.length === i
                        return (
                          <div
                            key={f}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isActive
                              ? (isDark ? 'bg-amber-400/40 scale-110 shadow-lg' : 'bg-amber-300 scale-110 shadow-lg')
                              : (isDark ? 'bg-white/10' : 'bg-amber-100')
                              } ${theme.textMuted}`}
                          >
                            {f}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>How it works</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>Three simple steps to unlock your document intelligence</p>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              num: '01',
              title: 'Upload your files',
              desc: 'Drag and drop your documents. We support PDFs, DOC, TXT, images, and more.',
              visual: 'upload'
            },
            {
              num: '02',
              title: 'Ask anything',
              desc: 'Type or speak your questions. AI understands context across all your files.',
              visual: 'chat'
            },
            {
              num: '03',
              title: 'Get cited answers',
              desc: 'Receive accurate responses with direct citations back to your source material.',
              visual: 'answers'
            }
          ].map((item, idx) => (
            <div
              key={item.num}
              className={`rounded-3xl border ${theme.card} ${theme.cardHover} p-6 transition-all duration-500 group overflow-hidden hover:shadow-2xl ${isDark ? 'hover:shadow-amber-500/10' : 'hover:shadow-amber-500/20'}`}
            >
              <div className="flex flex-col gap-5">
                {/* Dynamic Visual area */}
                <div className={`w-full h-44 rounded-2xl ${isDark ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent' : 'bg-gradient-to-br from-amber-50 via-orange-50/50 to-white'} flex items-center justify-center overflow-hidden relative group-hover:scale-[1.02] transition-transform duration-500`}>
                  {item.visual === 'upload' && (() => {
                    // Animation cycle: 0-25 files floating, 25-40 files moving in, 40-60 green tick
                    const cycle = featureAnimFrame % 60
                    const isUploading = cycle >= 25 && cycle < 40
                    const isComplete = cycle >= 40

                    return (
                      <div className="relative flex items-center justify-center">
                        {/* Main upload zone */}
                        <div className={`w-28 h-32 rounded-2xl border-2 border-dashed ${isDark ? 'border-amber-400/40 bg-amber-400/5' : 'border-amber-300 bg-amber-50/50'} flex flex-col items-center justify-center transition-all duration-300 ${isComplete ? (isDark ? 'border-green-400/60 bg-green-400/10' : 'border-green-400 bg-green-50') : ''}`}>
                          {isComplete ? (
                            /* Green tick when complete */
                            <div className="flex flex-col items-center">
                              <div className={`w-14 h-14 rounded-full ${isDark ? 'bg-green-500/30' : 'bg-green-100'} flex items-center justify-center`}>
                                <svg className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className={`text-xs mt-2 ${isDark ? 'text-green-400' : 'text-green-600'} font-medium`}>Uploaded!</span>
                            </div>
                          ) : (
                            /* Cloud icon when not complete */
                            <>
                              <svg className={`w-12 h-12 ${isDark ? 'text-amber-400' : 'text-amber-500'} transition-transform duration-300`} style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.15) * 3}px)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className={`text-xs mt-2 ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>Drop files</span>
                            </>
                          )}
                        </div>

                        {/* Floating files - animate into upload zone */}
                        {!isComplete && [
                          { color: isDark ? 'bg-amber-400/30' : 'bg-amber-200', startX: -45, startY: -25 },
                          { color: isDark ? 'bg-orange-400/30' : 'bg-orange-200', startX: 45, startY: -20 },
                          { color: isDark ? 'bg-amber-500/30' : 'bg-amber-300', startX: 0, startY: -50 }
                        ].map((file, i) => {
                          // Calculate position based on animation phase
                          const progress = isUploading ? Math.min(1, (cycle - 25) / 15) : 0
                          const floatOffset = isUploading ? 0 : Math.sin((featureAnimFrame + i * 25) * 0.12) * 5
                          const currentX = file.startX * (1 - progress)
                          const currentY = file.startY * (1 - progress) + floatOffset
                          const scale = isUploading ? 1 - progress * 0.5 : 1
                          const opacity = isUploading ? 1 - progress : 1

                          return (
                            <div
                              key={i}
                              className={`absolute w-10 h-12 rounded-lg ${file.color} shadow-lg flex items-center justify-center`}
                              style={{
                                transform: `translate(${currentX}px, ${currentY}px) scale(${scale})`,
                                opacity: opacity,
                                transition: 'transform 0.08s ease-out, opacity 0.08s ease-out'
                              }}
                            >
                              <svg className={`w-5 h-5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {item.visual === 'chat' && (
                    <div className="w-full h-full p-4 flex flex-col justify-center">
                      {/* Chat messages with typing effect */}
                      <div className="space-y-3">
                        {/* User message */}
                        <div className="flex items-end gap-2 justify-end" style={{ opacity: Math.min(1, (featureAnimFrame % 60) / 10) }}>
                          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-sm ${isDark ? 'bg-amber-400/30' : 'bg-amber-400'} ${isDark ? 'text-amber-100' : 'text-amber-900'}`}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">What does this say?</span>
                            </div>
                          </div>
                          <div className={`w-7 h-7 rounded-full ${isDark ? 'bg-amber-400/40' : 'bg-amber-300'} flex-shrink-0`} />
                        </div>

                        {/* AI response with typing indicator */}
                        <div className="flex items-end gap-2">
                          <div className={`w-7 h-7 rounded-full ${isDark ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-amber-400 to-orange-400'} flex-shrink-0 flex items-center justify-center`}>
                            <span className="text-white text-xs font-bold">D</span>
                          </div>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-sm ${isDark ? 'bg-white/10' : 'bg-white'} shadow-sm`}>
                            {(featureAnimFrame % 60) < 30 ? (
                              <div className="flex gap-1 py-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`}
                                    style={{
                                      animation: 'bounce 1s infinite',
                                      animationDelay: `${i * 0.15}s`
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Based on page 3, it states...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.visual === 'answers' && (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                      {/* Main document */}
                      <div className={`w-36 h-32 rounded-xl ${isDark ? 'bg-white/10' : 'bg-white'} shadow-xl p-3 border ${isDark ? 'border-white/20' : 'border-amber-100'} transition-transform duration-500`} style={{ transform: `rotate(${Math.sin(featureAnimFrame * 0.03) * 2}deg)` }}>
                        {/* Document lines with highlights */}
                        <div className="space-y-2">
                          <div className={`h-2 ${isDark ? 'bg-white/20' : 'bg-gray-200'} rounded-full w-full`} />
                          <div className="flex items-center gap-1">
                            <div className={`h-2 ${isDark ? 'bg-amber-400/60' : 'bg-amber-400'} rounded-full flex-1 transition-all duration-300`} style={{ width: `${50 + (featureAnimFrame % 30)}%` }} />
                            <span className={`text-[8px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>[1]</span>
                          </div>
                          <div className={`h-2 ${isDark ? 'bg-white/20' : 'bg-gray-200'} rounded-full w-4/5`} />
                          <div className="flex items-center gap-1">
                            <div className={`h-2 ${isDark ? 'bg-amber-400/60' : 'bg-amber-400'} rounded-full flex-1 transition-all duration-300`} style={{ width: `${30 + ((featureAnimFrame + 15) % 25)}%` }} />
                            <span className={`text-[8px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>[2]</span>
                          </div>
                          <div className={`h-2 ${isDark ? 'bg-white/15' : 'bg-gray-100'} rounded-full w-3/5`} />
                        </div>
                      </div>

                      {/* Success checkmark */}
                      <div
                        className={`absolute top-3 right-6 w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30`}
                        style={{ transform: `scale(${1 + Math.sin(featureAnimFrame * 0.1) * 0.1})` }}
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>

                      {/* Floating citation badges */}
                      <div
                        className={`absolute bottom-4 left-4 px-2 py-1 rounded-lg text-[10px] font-bold ${isDark ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-amber-100 text-amber-700 border border-amber-200'} shadow-md`}
                        style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.08) * 3}px)` }}
                      >
                        Page 3, Para 2
                      </div>
                    </div>
                  )}
                </div>

                {/* Number badge */}
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent`}>{item.num}</span>
                  <div className={`flex-1 h-0.5 ${isDark ? 'bg-gradient-to-r from-amber-400/30 to-transparent' : 'bg-gradient-to-r from-amber-300 to-transparent'} group-hover:from-amber-400 transition-all duration-500`} />
                </div>

                <div>
                  <h3 className={`text-xl font-semibold ${theme.text} mb-2`}>{item.title}</h3>
                  <p className={`${theme.textMuted} leading-relaxed`}>{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 py-24">
        <div className={`rounded-3xl ${theme.card} border p-14 text-center`}>
          <h2 className={`text-4xl font-bold ${theme.text} mb-6`}>Ready to get started?</h2>
          <p className={`${theme.textMuted} text-xl max-w-2xl mx-auto mb-12`}>
            Join researchers, students, and professionals using DocTalk to understand their documents better.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleTry}
              className={`w-full sm:w-auto ${theme.btnPrimary} text-gray-900 font-semibold px-12 py-4 rounded-full shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] transition-all duration-300 text-lg`}
            >
              Start for free
            </button>
            <button
              onClick={() => navigate('/signup')}
              className={`w-full sm:w-auto ${theme.btnSecondary} ${theme.text} font-medium px-12 py-4 rounded-full transition-all duration-300 border`}
            >
              Create account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`relative z-10 max-w-7xl mx-auto px-8 py-10 border-t ${theme.divider}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${theme.accent} flex items-center justify-center`}>
              <span className="text-gray-900 font-bold text-xs">D</span>
            </div>
            <span className={theme.textSubtle}>DocTalk</span>
          </div>
          <p className={theme.textSubtle}>© 2025 DocTalk. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}

export default Landing
