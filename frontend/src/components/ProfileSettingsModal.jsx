import React, { useEffect, useState } from 'react'
import { updateProfile, changePassword, deleteAccount } from '../utils/api'

const ProfileSettingsModal = ({ isOpen, onClose, user, onProfileUpdated, onAccountDeleted }) => {
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
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Security</h3>
              <p className="text-sm text-gray-400">Change your password to keep your account secure.</p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
              {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
              {passwordMessage && <p className="text-sm text-green-400">{passwordMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-semibold rounded-xl hover:bg-white disabled:opacity-50"
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
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Danger zone</h3>
              <p className="text-sm text-gray-400">Delete your DocTalk account and all related data.</p>
            </div>
            <form onSubmit={handleAccountDelete} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type DELETE to confirm</label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="DELETE"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
                <button
                  type="submit"
                  disabled={isDeletingAccount}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-500 disabled:opacity-50"
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
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Profile</h3>
              <p className="text-sm text-gray-400">Update how your name appears inside DocTalk.</p>
            </div>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Your name"
                />
              </div>
              {profileError && <p className="text-sm text-red-400">{profileError}</p>}
              {profileMessage && <p className="text-sm text-green-400">{profileMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-500 disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.573.99c.857-.495 1.91.358 1.654 1.287a1.724 1.724 0 001.357 2.17c.95.21 1.278 1.36.6 2.012a1.724 1.724 0 000 2.486c.678.652.35 1.802-.6 2.011a1.724 1.724 0 00-1.357 2.171c.256.929-.797 1.782-1.654 1.287a1.724 1.724 0 00-2.573.989c-.299.922-1.603.922-1.902 0a1.724 1.724 0 00-2.573-.99c-.857.495-1.91-.358-1.654-1.287a1.724 1.724 0 00-1.357-2.17c-.95-.21-1.278-1.36-.6-2.012a1.724 1.724 0 000-2.486c-.678-.652-.35-1.802.6-2.011a1.724 1.724 0 001.357-2.171c-.256-.929.797-1.782 1.654-1.287.91.526 2.063-.087 2.573-.989z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Profile & Settings</h2>
              <p className="text-sm text-gray-400">Manage your DocTalk account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-full p-2 hover:bg-gray-800"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex max-h-[80vh]">
          <nav className="w-60 border-r border-gray-800 bg-gray-900/60 p-6 space-y-2 hidden md:flex md:flex-col">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition ${
                  activeSection === section.id
                    ? 'bg-gray-800 text-white shadow-inner'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <svg className={`w-5 h-5 ${section.accent || 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {section.icon}
                </svg>
                <div>
                  <p className="text-sm font-semibold">{section.label}</p>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-6">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsModal
