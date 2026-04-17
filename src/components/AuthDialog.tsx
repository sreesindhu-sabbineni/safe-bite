import { useState } from 'react'
import { GoogleLogo, FacebookLogo, InstagramLogo, AppleLogo } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { AuthProvider, UserProfile } from '@/lib/types'
import { XLogo } from '@phosphor-icons/react'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthSuccess: (profile: UserProfile) => void
}

export function AuthDialog({ open, onOpenChange, onAuthSuccess }: AuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleAuth = async (provider: AuthProvider) => {
    setIsLoading(true)
    
    try {
      const user = await window.spark.user()
      
      const mockProfile: UserProfile = {
        id: user?.id?.toString() || `user_${Date.now()}`,
        email: user?.email || `${provider}@example.com`,
        displayName: user?.login || `${provider} User`,
        photoUrl: user?.avatarUrl,
        authProvider: provider,
        createdAt: Date.now(),
        lastLogin: Date.now()
      }
      
      onAuthSuccess(mockProfile)
      toast.success(`Signed in with ${provider}!`)
      onOpenChange(false)
    } catch (error) {
      toast.error('Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign In to Safe Bite</DialogTitle>
          <DialogDescription>
            Create an account to save your preferences and scan history across devices
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-4">
          <Button
            variant="outline"
            className="w-full gap-3 h-12"
            onClick={() => handleAuth('google')}
            disabled={isLoading}
          >
            <GoogleLogo size={24} weight="bold" />
            <span>Continue with Google</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full gap-3 h-12"
            onClick={() => handleAuth('facebook')}
            disabled={isLoading}
          >
            <FacebookLogo size={24} weight="fill" />
            <span>Continue with Facebook</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full gap-3 h-12"
            onClick={() => handleAuth('instagram')}
            disabled={isLoading}
          >
            <InstagramLogo size={24} weight="fill" />
            <span>Continue with Instagram</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full gap-3 h-12"
            onClick={() => handleAuth('x')}
            disabled={isLoading}
          >
            <XLogo size={24} weight="fill" />
            <span>Continue with X</span>
          </Button>
          
          <Button
            variant="outline"
            className="w-full gap-3 h-12"
            onClick={() => handleAuth('apple')}
            disabled={isLoading}
          >
            <AppleLogo size={24} weight="fill" />
            <span>Continue with Apple</span>
          </Button>
        </div>
        
        <p className="text-xs text-center text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </DialogContent>
    </Dialog>
  )
}
