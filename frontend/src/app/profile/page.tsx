'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet'
import { Avatar, Name, Address, Identity, EthBalance } from '@coinbase/onchainkit/identity'
import { useAccount } from 'wagmi'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useToast } from '@/hooks/useToast'
import { Check, LogOut, Copy, Loader2 } from 'lucide-react'

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    id: '',
    username: '',
    npub: '',
    address: '',
  })
  const [originalProfile, setOriginalProfile] = useState({
    id: '',
    username: '',
    npub: '',
    address: '',
  })
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const { toast } = useToast()
  const { address, isConnected } = useAccount()
  const {
    isAuthenticated,
    isAuthenticating,
    error,
    checkSession,
    login,
    logout
  } = useWalletAuth()

  // Set isMounted on initial component mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update profile address when wallet connects
  useEffect(() => {
    if (address) {
      setProfile(prev => ({
        ...prev,
        address: address
      }))
    }
  }, [address])

  // Check session only once on initial mount
  useEffect(() => {
    checkSession()
  }, [checkSession])

  // Load user profile data when authenticated
  useEffect(() => {
    if (isAuthenticated && address) {
      fetchUserProfile(address)
    }
  }, [isAuthenticated, address])

  // Watch for connection changes - but don't create an infinite loop
  useEffect(() => {
    if (isConnected && !isAuthenticated && !isAuthenticating) {
      // Delay the login attempt slightly to avoid race conditions
      const timer = setTimeout(() => {
        console.log('Wallet detected as connected, triggering login...')
        login()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [isConnected, isAuthenticated, isAuthenticating, login])

  // Handle disconnection
  useEffect(() => {
    if (!isConnected && isAuthenticated) {
      console.log('Wallet disconnected, logging out...')
      logout()
    }
  }, [isConnected, isAuthenticated, logout])

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const fetchUserProfile = async (address: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/user/profile?address=${address}`)
      if (response.ok) {
        const userData = await response.json()
        setProfile(userData)
        setOriginalProfile(userData) // Store original data for cancel comparison
      } else {
        const error = await response.json()
        toast({
          title: 'Error loading profile',
          description: error.error || 'Failed to load user profile',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      toast({
        title: 'Connection error',
        description: 'Failed to connect to the server',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)

    toast({
      title: 'Copied to clipboard',
      description: 'User ID has been copied to clipboard',
      duration: 2000,
    })
  }

  const handleCancel = () => {
    // Reset form to original values
    setProfile(originalProfile)
    setIsEditing(false)
  }

  const handleSave = async () => {
    // Check if anything has changed
    if (profile.username === originalProfile.username &&
        profile.npub === originalProfile.npub) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/user/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: profile.username,
          npub: profile.npub,
        }),
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setProfile(updatedUser)
        setOriginalProfile(updatedUser)
        setIsEditing(false)
        toast({
          title: 'Profile updated',
          description: 'Your profile has been successfully updated',
        })
      } else {
        const error = await response.json()
        toast({
          title: 'Update failed',
          description: error.error || 'Failed to update profile',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Connection error',
        description: 'Failed to connect to the server',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  function renderAuthContent() {
    if (isAuthenticating) {
      return (
        <div className="text-center py-4">
          <div className="animate-pulse text-md">Authenticating with wallet...</div>
          <div className="text-sm text-gray-400 mt-2">
            Please check your wallet for signature requests
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-4 text-red-300">
          <h3 className="font-semibold mb-2">Authentication error</h3>
          <p>{error.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => login()}
          >
            Try Again
          </Button>
        </div>
      )
    }

    // Only show the wallet connection UI if not authenticated
    if (!isAuthenticated) {
      return (
        <div className="text-center py-8">
          <div className="text-lg mb-4">Connect your wallet to view your profile</div>
          <div className="flex justify-center mb-6">
            <Wallet>
              <ConnectWallet>
                <span>Connect Wallet</span>
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
          <div className="text-gray-400">Loading your profile...</div>
        </div>
      )
    }

    // Show the user profile when authenticated
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10" />
            <div>
              <div className="font-medium">{profile.address && `${profile.address.slice(0, 6)}...${profile.address.slice(-4)}`}</div>
              <EthBalance className="text-sm text-gray-400" />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={logout}
            className="border-purple-500/50 hover:bg-purple-500/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* User ID section */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-1">User ID</div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono bg-gray-900/50 px-3 py-1.5 rounded overflow-hidden overflow-ellipsis">
              {profile.id || 'Not available'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(profile.id)}
              className="ml-2"
              disabled={!profile.id}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profile.username || ''}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            disabled={!isEditing}
            className="bg-gray-700/50"
          />
        </div>

        {/* <div>
          <Label htmlFor="npub">Nostr Public Key (npub)</Label>
          <Input
            id="npub"
            value={profile.npub || ''}
            onChange={(e) => setProfile({ ...profile, npub: e.target.value })}
            disabled={!isEditing}
            className="bg-gray-700/50"
            placeholder="npub1..."
          />
          <p className="text-xs text-gray-400 mt-1">Optional: Your Nostr public key for connecting to the Nostr network</p>
        </div> */}

        <div>
          <Label htmlFor="ethAddress">ETH Address</Label>
          <Input
            id="ethAddress"
            value={profile.address || ''}
            readOnly
            className="bg-gray-700/50 text-gray-400 cursor-not-allowed"
          />
        </div>

        {/* <div className="flex justify-end space-x-2 pt-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="border-purple-500/50 hover:bg-purple-500/10"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              Edit
            </Button>
          )}
        </div> */}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      {isMounted ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-2xl mx-auto border border-transparent animate-gradient-glow">
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderAuthContent()}
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </div>
  )
}
