import React, { useEffect, useState } from 'react'
import { updateProfile, changePassword, deleteAccount } from '../utils/api'

const ProfileSettingsModal = ({ isOpen, onClose, user, onProfileUpdated, onAccountDeleted, isDark }) => {
  const [displayName, setDisplayName] = useState(user?.name || '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  const sections = [
    {
      id: 'profile',
      label: 'Profile',
      description: 'Update how you appear in DocTalk',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      )
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Passwords and safety controls',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c-1.654 0-3-1.346-3-3V5.5a2.5 2.5 0 115 0V8c0 1.654-1.346 3-3 3zm-5 2h10a1 1 0 011 1v4.5a2.5 2.5 0 01-2.5 2.5h-7a2.5 2.5 0 01-2.5-2.5V14a1 1 0 011-1z"
        />
      )
    },
    {
      id: 'danger',
      label: 'Danger zone',
      description: 'Delete your DocTalk account',
      accent: 'text-red-400',
      icon: (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      )
    }
  ]

  useEffect(() => {
    setDisplayName(user?.name || '')
    setProfileMessage('')
    setProfileError('')
  }, [user, isOpen])

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'security':
        return (
          <section className="space-y-4">
            <div>
              <h3 className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Security</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Change your password to keep your account secure.</p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-amber-50 border-amber-200 text-gray-800'}`}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-amber-50 border-amber-200 text-gray-800'}`}
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              {passwordMessage && <p className="text-sm text-green-600">{passwordMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-semibold rounded-xl hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
                >
                  Update password
                </button>
              </div>
            </form>
          </section>
        )
      case 'danger':
        return (
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide">Danger zone</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Delete your DocTalk account and all related data.</p>
            </div>
            <form onSubmit={handleAccountDelete} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Type DELETE to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 ${isDark ? 'bg-white/5 border-red-500/30 text-white placeholder-gray-500' : 'bg-red-50 border-red-200 text-gray-800'}`}
                    placeholder="DELETE"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 ${isDark ? 'bg-white/5 border-red-500/30 text-white placeholder-gray-500' : 'bg-red-50 border-red-200 text-gray-800'}`}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <div className="flex justify-between items-center">
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>This action cannot be undone.</p>
                <button
                  type="submit"
                  disabled={isDeletingAccount}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50"
                >
                  Delete account
                </button>
              </div>
            </form>
          </section>
        )
      case 'profile':
      default:
        return (
          <section className="space-y-4">
            <div>
              <h3 className={`text-sm font-semibold uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Profile</h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Update how your name appears inside DocTalk.</p>
            </div>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-amber-50 border-amber-200 text-gray-800'}`}
                  placeholder="Your name"
                />
              </div>
              {profileError && <p className="text-sm text-red-500">{profileError}</p>}
              {profileMessage && <p className="text-sm text-green-600">{profileMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-semibold rounded-xl hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>
        )
    }
  }

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')
    setIsSavingProfile(true)
    try {
      const updatedUser = await updateProfile({ name: displayName })
      setProfileMessage('Profile updated successfully')
      onProfileUpdated?.(updatedUser)
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to update profile'
      setProfileError(detail)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    if (!currentPassword || !newPassword) {
      setPasswordError('Both current and new password are required')
      return
    }
    setPasswordError('')
    setPasswordMessage('')
    setIsUpdatingPassword(true)
    try {
      const payload = {
        current_password: currentPassword,
        new_password: newPassword
      }
      const result = await changePassword(payload)
      setPasswordMessage(result.message || 'Password updated successfully')
      resetPasswordForm()
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to change password'
      setPasswordError(detail)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleAccountDelete = async (event) => {
    event.preventDefault()
    setDeleteError('')
    if (deleteConfirm !== 'DELETE') {
      setDeleteError('Type DELETE in uppercase to confirm')
      return
    }
    if (!deletePassword) {
      setDeleteError('Password is required to delete your account')
      return
    }
    setIsDeletingAccount(true)
    try {
      await deleteAccount({ password: deletePassword })
      onAccountDeleted?.()
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to delete account'
      setDeleteError(detail)
    } finally {
      setIsDeletingAccount(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#0f0f0f] border border-white/10' : 'bg-white border border-amber-100'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10 bg-[#0f0f0f]' : 'border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <span className="text-sm font-bold">{user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Profile & Settings</h2>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Manage your DocTalk account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`rounded-full p-2 transition ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-amber-50'}`}
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex max-h-[80vh]">
          <nav className={`w-60 border-r p-4 space-y-1 hidden md:flex md:flex-col ${isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-amber-100 bg-amber-50/50'}`}>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                  activeSection === section.id
                    ? isDark 
                      ? 'bg-white/10 text-white' 
                      : 'bg-white text-gray-800 shadow-sm border border-amber-100'
                    : isDark 
                      ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white/60'
                }`}
              >
                <svg className={`w-5 h-5 ${section.accent || 'text-amber-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {section.icon}
                </svg>
                <div>
                  <p className={`text-sm font-medium ${activeSection === section.id ? (isDark ? 'text-white' : 'text-gray-800') : ''}`}>{section.label}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{section.description}</p>
                </div>
              </button>
            ))}
          </nav>
          <div className={`flex-1 overflow-y-auto p-6 ${isDark ? 'bg-[#0f0f0f]' : 'bg-white'}`}>
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsModal
