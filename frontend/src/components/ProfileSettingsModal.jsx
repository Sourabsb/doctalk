import React, { useEffect, useState } from 'react'
import { updateProfile, changePassword, deleteAccount } from '../utils/api'

// Shadcn components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// Lucide icons
import { User, Shield, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react'

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
      description: 'Update how you appear',
      icon: User,
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Password & safety',
      icon: Shield,
    },
    {
      id: 'danger',
      label: 'Danger zone',
      description: 'Delete account',
      icon: Trash2,
      variant: 'danger',
    }
  ]

  useEffect(() => {
    setDisplayName(user?.name || '')
    setProfileMessage('')
    setProfileError('')
  }, [user, isOpen])

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

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'security':
        return (
          <section className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Shield className="w-5 h-5 text-primary" />
                Security
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Change your password to keep your account secure.
              </p>
            </div>

            <Separator className="bg-border" />

            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Current password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    New password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-background border-input"
                  />
                </div>
              </div>

              {passwordError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {passwordError}
                </div>
              )}

              {passwordMessage && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  {passwordMessage}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )

      case 'danger':
        return (
          <section className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete your DocTalk account and all associated data.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <p className="text-sm text-destructive">
                ⚠️ This action is irreversible. All your notebooks and data will be permanently deleted.
              </p>
            </div>

            <Separator className="bg-border" />

            <form onSubmit={handleAccountDelete} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Type DELETE to confirm
                  </label>
                  <Input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="bg-background border-destructive/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Your password
                  </label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-destructive/30"
                  />
                </div>
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="destructive" type="submit" disabled={isDeletingAccount}>
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete my account'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )

      case 'profile':
      default:
        return (
          <section className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <User className="w-5 h-5 text-primary" />
                Profile
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Update how your name appears in DocTalk.
              </p>
            </div>

            <Separator className="bg-border" />

            {/* User Card */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{user?.name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Display name
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="bg-background border-input"
                />
              </div>

              {profileError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {profileError}
                </div>
              )}

              {profileMessage && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  {profileMessage}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            </form>
          </section>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl text-foreground">Profile & Settings</DialogTitle>
              <DialogDescription className="text-muted-foreground">Manage your DocTalk account</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-[400px] max-h-[70vh]">
          {/* Sidebar Navigation */}
          <nav className="w-56 border-r border-border p-4 space-y-1 hidden md:block bg-muted/30">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              const isDanger = section.variant === 'danger'

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all
                    ${isActive
                      ? 'bg-background shadow-sm border border-border'
                      : 'hover:bg-background/50'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isDanger ? 'text-destructive' : isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className={`text-sm font-medium ${isDanger ? 'text-destructive' : 'text-foreground'}`}>
                      {section.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </nav>

          {/* Mobile Section Picker */}
          <div className="md:hidden p-4 border-b border-border flex gap-2 bg-card">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id

              return (
                <Button
                  key={section.id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveSection(section.id)}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </Button>
              )
            })}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 bg-card">
            <div className="p-6">
              {renderSectionContent()}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProfileSettingsModal
