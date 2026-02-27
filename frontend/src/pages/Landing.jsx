import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const Landing = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isVerifying } = useAuth()

  const [activeSlide, setActiveSlide] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [featureAnimFrame, setFeatureAnimFrame] = useState(0)

  const handleTry = () => {
    if (isVerifying) return
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
    bg: 'bg-[#faf9f5]',
    text: 'text-[#292524]',
    textMuted: 'text-[#78716c]',
    textSubtle: 'text-[#a8a29e]',
    card: 'bg-white border-[#e7e5e4]',
    cardHover: 'hover:border-[#d6d3d1] hover:shadow-md',
    navBg: 'bg-[#faf9f5]/95 backdrop-blur-md',
    accentText: 'text-[#d97757]',
    btnPrimary: 'bg-[#d97757] hover:bg-[#c4684a]',
    btnSecondary: 'bg-white border-[#e7e5e4] hover:bg-[#f5f5f4]',
    divider: 'border-[#e7e5e4]',
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} relative`}>

      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#faf9f5] via-white/50 to-[#faf9f5]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#d97757]/[0.04] blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <header className={`sticky top-0 z-50 ${theme.navBg} border-b ${theme.divider}`}>
        <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img
              src="/img/icon.png"
              alt="DocTalk Logo"
              className="w-8 h-8 object-contain"
            />
            <span className={`text-lg font-semibold tracking-tight ${theme.text}`}>DocTalk</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/signin')}
              className={`text-sm ${theme.textMuted} hover:text-[#292524] transition px-3 py-1.5`}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className={`text-sm font-medium ${theme.btnPrimary} text-white rounded-lg px-5 py-2 transition-colors`}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
        <p className="text-4xl md:text-5xl font-semibold mb-6">
          <span className={theme.text}>Meet </span>
          <span className="text-[#d97757]">DocTalk</span>
        </p>
        <h1 className={`text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-8 ${theme.text}`}>
          Your AI Document Assistant
        </h1>
        <p className={`text-xl md:text-2xl ${theme.textMuted} max-w-3xl mx-auto mb-14 leading-relaxed`}>
          Transform any document into intelligent conversations. Upload, ask questions, and get instant AI-powered insights.
        </p>
        <button
          onClick={handleTry}
          className={`${theme.btnPrimary} text-white font-semibold px-12 py-4 rounded-xl shadow-sm transition-colors text-lg`}
        >
          Try DocTalk
        </button>
      </section>

      {/* Slideshow Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>Your AI-Powered Research Partner</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>
          A seamless workflow from upload to insight
        </p>

        <div
          className="relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left Arrow */}
          <button
            onClick={prevSlide}
            className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full bg-white border border-[#e7e5e4] shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:-translate-x-6 transition-all duration-300 ${theme.accentText}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Right Arrow */}
          <button
            onClick={nextSlide}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full bg-white border border-[#e7e5e4] shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-6 transition-all duration-300 ${theme.accentText}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Slide Content */}
          <div className="grid md:grid-cols-2 gap-16 items-center min-h-[350px] px-8">
            <div className={`space-y-6 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
              <div className="w-14 h-14 rounded-2xl bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
                {slides[activeSlide].icon}
              </div>
              <h3 className={`text-3xl font-semibold ${theme.text}`}>{slides[activeSlide].title}</h3>
              <p className={`text-xl ${theme.textMuted} leading-relaxed`}>{slides[activeSlide].desc}</p>
            </div>

            {/* Preview Card */}
            <div className={`rounded-2xl bg-white border border-[#e7e5e4] p-8 shadow-sm transition-all duration-300 ${isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-[#d97757]/60" />
                <div className="w-3 h-3 rounded-full bg-green-400/60" />
              </div>
              <div className="rounded-xl bg-[#f5f5f4] p-10 min-h-[220px] flex items-center justify-center">
                <div className="text-center space-y-5">
                  <div className={`w-20 h-20 mx-auto rounded-full bg-[#d97757] shadow-md flex items-center justify-center transition-transform duration-300 ${isAnimating ? 'scale-90 rotate-12' : 'scale-100 rotate-0'}`}>
                    <span className="text-white">{slides[activeSlide].icon}</span>
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
                ? 'w-10 bg-[#d97757]'
                : 'w-2 bg-[#e7e5e4] hover:bg-[#d6d3d1]'
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
          <div className="p-8 rounded-2xl transition-all duration-300 bg-white border border-[#e7e5e4] hover:border-[#d6d3d1] hover:shadow-md group overflow-hidden">
            {/* Animated visual area */}
            <div className="w-full h-44 rounded-xl bg-[#f5f5f4] flex items-center justify-center mb-6 relative overflow-hidden">
              {/* Multiple books with visible page flipping */}
              <div className="relative flex items-end justify-center gap-3">

                {/* Small Book - Left */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(-12deg) translateY(${Math.sin(featureAnimFrame * 0.08) * 3}px)`
                  }}
                >
                  <div className="w-8 h-14 bg-[#e8a088] rounded-sm shadow-lg relative">
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#c4684a] rounded-l-sm" />
                    <div className="absolute inset-1 flex flex-col justify-center gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-0.5 bg-[#d97757]/30 rounded mx-0.5" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Open Book - Center with flipping pages */}
                <div className="relative" style={{ perspective: '500px' }}>
                  <div className="w-28 h-20 relative">
                    {/* Center spine */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2 h-full bg-[#d97757] rounded-sm z-20" />

                    {/* Left page */}
                    <div className="absolute left-0 top-0 w-14 h-20 bg-white rounded-l-md shadow-md">
                      <div className="p-2 space-y-1.5">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-1 bg-[#d97757]/20 rounded" style={{ width: `${70 + (i % 3) * 10}%`, marginLeft: 'auto' }} />
                        ))}
                      </div>
                    </div>

                    {/* Right page */}
                    <div className="absolute right-0 top-0 w-14 h-20 bg-white rounded-r-md shadow-md">
                      <div className="p-2 space-y-1.5">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="h-1 bg-[#d97757]/20 rounded" style={{ width: `${60 + (i % 3) * 12}%` }} />
                        ))}
                      </div>
                    </div>

                    {/* Flipping page */}
                    {(() => {
                      const flipProgress = (featureAnimFrame * 3) % 360
                      const rotation = Math.min(flipProgress, 180)

                      return (
                        <div
                          className="absolute top-0 w-14 h-20 rounded-md shadow-lg z-30"
                          style={{
                            left: '50%',
                            transformOrigin: 'left center',
                            transform: `rotateY(${-rotation}deg)`,
                            transformStyle: 'preserve-3d',
                          }}
                        >
                          <div
                            className="absolute inset-0 bg-white rounded-r-md"
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-1 bg-[#d97757]/30 rounded" style={{ width: `${50 + (i % 4) * 12}%` }} />
                              ))}
                            </div>
                          </div>
                          <div
                            className="absolute inset-0 bg-[#faf9f5] rounded-l-md"
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-1 bg-[#d6d3d1] rounded" style={{ width: `${60 + (i % 3) * 10}%`, marginLeft: 'auto' }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Second flipping page */}
                    {(() => {
                      const flipProgress = ((featureAnimFrame * 3) + 120) % 360
                      const rotation = Math.min(flipProgress, 180)

                      return (
                        <div
                          className="absolute top-0 w-14 h-20 rounded-md shadow-lg z-25"
                          style={{
                            left: '50%',
                            transformOrigin: 'left center',
                            transform: `rotateY(${-rotation}deg)`,
                            transformStyle: 'preserve-3d',
                          }}
                        >
                          <div
                            className="absolute inset-0 bg-[#faf9f5] rounded-r-md"
                            style={{ backfaceVisibility: 'hidden' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-1 bg-[#d97757]/25 rounded" style={{ width: `${55 + (i % 3) * 15}%` }} />
                              ))}
                            </div>
                          </div>
                          <div
                            className="absolute inset-0 bg-[#f0d9cf] rounded-l-md"
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          >
                            <div className="p-2 space-y-1.5">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-1 bg-[#d97757]/20 rounded" style={{ width: `${65 + (i % 2) * 10}%`, marginLeft: 'auto' }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Medium Book - Right */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(8deg) translateY(${Math.sin((featureAnimFrame + 20) * 0.08) * 3}px)`,
                    perspective: '300px'
                  }}
                >
                  <div className="w-12 h-16 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 w-1 h-full bg-[#d97757] z-10" />
                    <div
                      className="absolute left-0 top-0 w-6 h-16 bg-[#e8a088] rounded-l-sm shadow-md origin-right"
                      style={{ transform: 'rotateY(-30deg)' }}
                    />
                    <div
                      className="absolute right-0 top-0 w-6 h-16 bg-[#e8a088] rounded-r-sm shadow-md origin-left"
                      style={{ transform: 'rotateY(30deg)' }}
                    />
                    <div className="absolute left-1 top-1 w-4 h-14 bg-white rounded-l-sm origin-right" style={{ transform: 'rotateY(-20deg)' }} />
                  </div>
                </div>

                {/* Tiny book */}
                <div
                  className="relative"
                  style={{
                    transform: `rotate(15deg) translateY(${Math.sin((featureAnimFrame + 40) * 0.1) * 2}px)`
                  }}
                >
                  <div className="w-6 h-10 bg-[#d97757] rounded-sm shadow-md">
                    <div className="absolute left-0 top-0 w-0.5 h-full bg-[#c4684a]" />
                  </div>
                </div>
              </div>

              {/* Floating sparkles */}
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-[#d97757]/60"
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
          <div className="p-8 rounded-2xl transition-all duration-300 bg-white border border-[#e7e5e4] hover:border-[#d6d3d1] hover:shadow-md group overflow-hidden">
            <div className="w-full h-44 rounded-xl bg-[#f5f5f4] flex items-center justify-center mb-6 relative overflow-hidden">
              <div className="relative">
                {/* Clipboard */}
                <div className="w-20 h-28 rounded-lg bg-[#f0d9cf] relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-[#d97757] rounded-t-lg">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-[#f0d9cf] rounded" />
                  </div>
                  <div className="absolute top-4 left-2 right-2 bottom-2 bg-white rounded">
                    {[0, 1, 2, 3].map((i) => {
                      const checkDelay = (featureAnimFrame * 0.08 + i * 0.8) % 4
                      const isChecked = checkDelay > 0.5
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1.5 py-1">
                          <div className="w-3 h-3 rounded border border-[#d97757] flex items-center justify-center transition-all duration-200">
                            {isChecked && (
                              <svg className="w-2 h-2 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="h-1.5 bg-[#f0d9cf] rounded flex-1" style={{ opacity: isChecked ? 0.5 : 1 }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
                {/* Floating elements */}
                <div
                  className="absolute -right-6 top-2 w-8 h-8 rounded bg-[#f0d9cf] flex items-center justify-center"
                  style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.1) * 5}px) rotate(${Math.sin(featureAnimFrame * 0.08) * 5}deg)` }}
                >
                  <span className="text-xs text-[#d97757]">1</span>
                </div>
                <div
                  className="absolute -left-5 bottom-4 w-8 h-8 rounded bg-[#f0d9cf] flex items-center justify-center"
                  style={{ transform: `translateY(${Math.sin((featureAnimFrame + 20) * 0.1) * 5}px) rotate(${Math.sin((featureAnimFrame + 20) * 0.08) * -5}deg)` }}
                >
                  <span className="text-xs text-[#d97757]">2</span>
                </div>
              </div>
            </div>
            <h3 className={`text-2xl font-semibold ${theme.text} mb-3`}>Organize your thinking</h3>
            <p className={`${theme.textMuted} leading-relaxed text-lg`}>Upload source material and create polished presentation outlines with key talking points.</p>
          </div>

          {/* Spark Ideas Card */}
          <div className="p-8 rounded-2xl transition-all duration-300 bg-white border border-[#e7e5e4] hover:border-[#d6d3d1] hover:shadow-md group overflow-hidden">
            <div className="w-full h-44 rounded-xl bg-[#f5f5f4] flex items-center justify-center mb-6 relative overflow-hidden">
              <div className="relative">
                {/* Glow effect */}
                <div
                  className="absolute inset-0 bg-[#d97757] rounded-full blur-xl"
                  style={{
                    transform: `scale(${1.5 + Math.sin(featureAnimFrame * 0.12) * 0.5})`,
                    opacity: 0.15 + Math.sin(featureAnimFrame * 0.12) * 0.1
                  }}
                />
                {/* Lightbulb */}
                <div className="relative">
                  <svg
                    className="w-16 h-16 text-[#d97757]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ filter: `drop-shadow(0 0 ${6 + Math.sin(featureAnimFrame * 0.12) * 3}px rgba(217, 119, 87, 0.3))` }}
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
                      className="absolute w-2 h-2 bg-[#d97757]"
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

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 py-24">
        <h2 className={`text-4xl font-bold text-center mb-4 ${theme.text}`}>What's included</h2>
        <p className={`text-center ${theme.textMuted} mb-16 text-lg`}>Everything you need for document intelligence</p>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((item, idx) => (
            <div
              key={item.title}
              className="rounded-2xl border bg-white border-[#e7e5e4] hover:border-[#d6d3d1] hover:shadow-md p-8 transition-all duration-300 group overflow-hidden"
            >
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#d97757]/10 flex items-center justify-center text-[#d97757]">
                    {item.icon}
                  </div>
                  <h3 className={`text-2xl font-semibold ${theme.text}`}>{item.title}</h3>
                  <p className={`${theme.textMuted} leading-relaxed text-lg`}>{item.desc}</p>
                </div>

                {/* Dynamic Visual area */}
                <div className="w-full md:w-56 h-36 rounded-xl bg-[#f5f5f4] flex items-center justify-center overflow-hidden relative">
                  {item.visual === 'chat' && (
                    <div className="space-y-3 p-4 w-full">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#e8a088] flex-shrink-0" />
                        <div className="h-4 bg-[#f0d9cf] rounded-lg" style={{ width: `${40 + (featureAnimFrame % 30)}%` }} />
                      </div>
                      <div className="flex items-start gap-2 justify-end">
                        <div className="h-4 bg-[#d97757] rounded-lg" style={{ width: `${30 + ((featureAnimFrame + 10) % 25)}%` }} />
                        <div className="w-6 h-6 rounded-full bg-[#f0d9cf] flex-shrink-0" />
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#e8a088] flex-shrink-0" />
                        <div className="h-4 bg-[#f0d9cf] rounded-lg" style={{ width: `${50 + ((featureAnimFrame + 20) % 20)}%` }} />
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
                            className="w-2 bg-[#d97757] rounded-full transition-all duration-100"
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
                              ? 'bg-[#d97757] border-[#c4684a] text-white h-20'
                              : 'bg-[#f0d9cf] border-[#e8a088] text-[#78716c] h-16'
                              }`}
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
                      <div className="w-20 h-24 rounded-xl bg-[#f0d9cf] flex items-center justify-center transition-all duration-300" style={{ transform: `scale(${1 + Math.sin(featureAnimFrame * 0.05) * 0.05})` }}>
                        <svg className="w-10 h-10 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-green-400 flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="absolute inset-0 -m-2 rounded-2xl border border-[#d97757]/20" />
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
                              ? 'bg-[#d97757] text-white'
                              : 'bg-[#f0d9cf] text-[#78716c]'
                              } text-sm font-medium`}
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
                              ? 'bg-[#d97757] text-white shadow-sm'
                              : 'bg-[#f0d9cf] text-[#78716c]'
                              }`}
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
              className="rounded-2xl border bg-white border-[#e7e5e4] hover:border-[#d6d3d1] hover:shadow-md p-6 transition-all duration-300 group overflow-hidden"
            >
              <div className="flex flex-col gap-5">
                {/* Dynamic Visual area */}
                <div className="w-full h-44 rounded-xl bg-[#f5f5f4] flex items-center justify-center overflow-hidden relative">
                  {item.visual === 'upload' && (() => {
                    const cycle = featureAnimFrame % 60
                    const isUploading = cycle >= 25 && cycle < 40
                    const isComplete = cycle >= 40

                    return (
                      <div className="relative flex items-center justify-center">
                        <div className={`w-28 h-32 rounded-2xl border-2 border-dashed transition-all duration-300 ${isComplete ? 'border-green-400 bg-green-50' : 'border-[#d97757]/40 bg-[#d97757]/5'} flex flex-col items-center justify-center`}>
                          {isComplete ? (
                            <div className="flex flex-col items-center">
                              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-xs mt-2 text-green-600 font-medium">Uploaded!</span>
                            </div>
                          ) : (
                            <>
                              <svg className="w-12 h-12 text-[#d97757] transition-transform duration-300" style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.15) * 3}px)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-xs mt-2 text-[#d97757]">Drop files</span>
                            </>
                          )}
                        </div>

                        {!isComplete && [
                          { color: 'bg-[#f0d9cf]', startX: -45, startY: -25 },
                          { color: 'bg-[#e8a088]', startX: 45, startY: -20 },
                          { color: 'bg-[#f0d9cf]', startX: 0, startY: -50 }
                        ].map((file, i) => {
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
                              <svg className="w-5 h-5 text-[#d97757]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      <div className="space-y-3">
                        <div className="flex items-end gap-2 justify-end" style={{ opacity: Math.min(1, (featureAnimFrame % 60) / 10) }}>
                          <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-[#d97757] text-white">
                            <span className="text-xs font-medium">What does this say?</span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-[#e8a088] flex-shrink-0" />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#d97757] flex-shrink-0 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">D</span>
                          </div>
                          <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white shadow-sm">
                            {(featureAnimFrame % 60) < 30 ? (
                              <div className="flex gap-1 py-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-[#d97757]"
                                    style={{
                                      animation: 'bounce 1s infinite',
                                      animationDelay: `${i * 0.15}s`
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[#57534e]">Based on page 3, it states...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.visual === 'answers' && (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                      <div className="w-36 h-32 rounded-xl bg-white shadow-sm p-3 border border-[#e7e5e4] transition-transform duration-500" style={{ transform: `rotate(${Math.sin(featureAnimFrame * 0.03) * 2}deg)` }}>
                        <div className="space-y-2">
                          <div className="h-2 bg-[#e7e5e4] rounded-full w-full" />
                          <div className="flex items-center gap-1">
                            <div className="h-2 bg-[#d97757] rounded-full flex-1 transition-all duration-300" style={{ width: `${50 + (featureAnimFrame % 30)}%` }} />
                            <span className="text-[8px] font-bold text-[#d97757]">[1]</span>
                          </div>
                          <div className="h-2 bg-[#e7e5e4] rounded-full w-4/5" />
                          <div className="flex items-center gap-1">
                            <div className="h-2 bg-[#d97757] rounded-full flex-1 transition-all duration-300" style={{ width: `${30 + ((featureAnimFrame + 15) % 25)}%` }} />
                            <span className="text-[8px] font-bold text-[#d97757]">[2]</span>
                          </div>
                          <div className="h-2 bg-[#f5f5f4] rounded-full w-3/5" />
                        </div>
                      </div>

                      <div
                        className="absolute top-3 right-6 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm"
                        style={{ transform: `scale(${1 + Math.sin(featureAnimFrame * 0.1) * 0.1})` }}
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>

                      <div
                        className="absolute bottom-4 left-4 px-2 py-1 rounded-lg text-[10px] font-bold bg-[#d97757]/15 text-[#d97757] border border-[#d97757]/30 shadow-sm"
                        style={{ transform: `translateY(${Math.sin(featureAnimFrame * 0.08) * 3}px)` }}
                      >
                        Page 3, Para 2
                      </div>
                    </div>
                  )}
                </div>

                {/* Number badge */}
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-[#d97757]">{item.num}</span>
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-[#d97757]/40 to-transparent group-hover:from-[#d97757] transition-all duration-500" />
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
        <div className="rounded-2xl bg-white border border-[#e7e5e4] p-14 text-center">
          <h2 className={`text-4xl font-bold ${theme.text} mb-6`}>Ready to get started?</h2>
          <p className={`${theme.textMuted} text-xl max-w-2xl mx-auto mb-12`}>
            Join researchers, students, and professionals using DocTalk to understand their documents better.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleTry}
              className="w-full sm:w-auto bg-[#d97757] hover:bg-[#c4684a] text-white font-semibold px-12 py-4 rounded-xl transition-colors text-lg"
            >
              Start for free
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto bg-white border border-[#e7e5e4] hover:bg-[#f5f5f4] text-[#292524] font-medium px-12 py-4 rounded-xl transition-colors"
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
            <img
              src="/img/icon.png"
              alt="DocTalk Logo"
              className="w-6 h-6 object-contain"
            />
            <span className={theme.textSubtle}>DocTalk</span>
          </div>
          <p className={theme.textSubtle}>© 2026 DocTalk. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}

export default Landing
