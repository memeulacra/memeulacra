'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet'
import { Avatar, Name, Address, Identity, EthBalance } from '@coinbase/onchainkit/identity'
import { useAccount } from 'wagmi'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useToast } from '@/hooks/useToast'
import { Check, LogOut, Copy, Loader2, Coins, Image as ImageIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClaim } from '@/hooks/useClaim'

// Types for token data
interface MsimToken {
  name: string;
  symbol: string;
  balance: string;
}

interface MemeToken {
  address: string;
  name: string;
  symbol: string;
  balance: string;
}

interface MemeNft {
  tokenId: string;
  imageUrl: string;
}

interface TokenData {
  msimToken: MsimToken | null;
  memeTokens: MemeToken[];
  memeNfts: MemeNft[];
  isLoading: boolean;
}

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
  const [tokenData, setTokenData] = useState<TokenData>({
    msimToken: null,
    memeTokens: [],
    memeNfts: [],
    isLoading: false
  })
  const { toast } = useToast()
  const { address, isConnected } = useAccount()
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    isAuthenticated,
    isAuthenticating,
    error,
    checkSession,
    login,
    logout
  } = useWalletAuth()
  const { sendTransaction } = useClaim()

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

  // Load user profile data when authenticated and redirect if needed
  useEffect(() => {
    if (isAuthenticated && address) {
      fetchUserProfile(address)
      fetchUserTokens(address)

      // Check if we have a returnUrl and redirect
      const returnUrl = searchParams.get('returnUrl')
      if (returnUrl) {
        router.push(returnUrl)
      }
    }
  }, [isAuthenticated, address, searchParams, router])

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
    if (!isConnected && isAuthenticated && !isAuthenticating) {
      console.log('Wallet disconnected, logging out...')
      logout()
    }
  }, [isConnected, isAuthenticated, isAuthenticating, logout])

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

  const fetchUserTokens = async (address: string) => {
    setTokenData(prev => ({ ...prev, isLoading: true }))
    try {
      const response = await fetch(`/api/tokens?address=${address}`)
      if (response.ok) {
        const data = await response.json()
        setTokenData({
          msimToken: data.msimToken,
          memeTokens: data.memeTokens || [],
          memeNfts: data.memeNfts || [],
          isLoading: false
        })
      } else {
        const errorData = await response.json()
        console.error('Failed to fetch token data:', errorData)
        toast({
          title: 'Error loading token data',
          description: errorData.error || 'Failed to load blockchain data',
          variant: 'destructive'
        })
        setTokenData(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Error fetching token data:', error)
      toast({
        title: 'Connection error',
        description: 'Failed to connect to blockchain data services',
        variant: 'destructive'
      })
      setTokenData(prev => ({ ...prev, isLoading: false }))
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
      <div className="space-y-6">
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

        <div>
          <Label htmlFor="ethAddress">ETH Address</Label>
          <Input
            id="ethAddress"
            value={profile.address || ''}
            readOnly
            className="bg-gray-700/50 text-gray-400 cursor-not-allowed"
          />
        </div>

        {/* Tokens Section */}
        <div className="mt-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
              Your Tokens
            </h3>
            <div>
              {/* <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  console.log('clicked')
                  await makePayment()
                  // Refresh token data after payment
                  await fetchUserTokens(profile.address || '')
                }}
                disabled={tokenData.isLoading}
                className="text-xs"
              >
                Pay
              </Button> */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  console.log('clicked')
                  await sendTransaction()
                  await fetchUserTokens(profile.address || '')
                }}
                disabled={tokenData.isLoading}
                className="text-xs"
              >
                Claim 200 MSIM
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => profile.address && fetchUserTokens(profile.address)}
                disabled={tokenData.isLoading}
                className="text-xs"
              >
                {tokenData.isLoading ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : null}
                Refresh
              </Button>
            </div>
          </div>

          {tokenData.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* MSIM Token Section */}
              <Card className="border border-purple-800/30 bg-gray-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium flex items-center">
                    <Coins className="h-5 w-5 mr-2 text-purple-400" />
                    MSIM Token <span className="ml-2 text-xs text-gray-400 bg-gray-800/50 rounded-md px-2 py-1 flex items-center">
                      <span className="truncate">0x96BeEBB6bC25362baeE97d5a97157AE6314219ef</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-5 w-5 p-0"
                        onClick={() => copyToClipboard('0x96BeEBB6bC25362baeE97d5a97157AE6314219ef')}
                      >
                        {copied ? 
                          <Check className="h-3 w-3 text-green-500" /> : 
                          <Copy className="h-3 w-3 text-gray-400 hover:text-white" />
                        }
                      </Button>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tokenData.msimToken ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-gray-400">Token Name</Label>
                        <Input
                          value={tokenData.msimToken.name || 'N/A'}
                          readOnly
                          className="bg-gray-700/30 text-gray-300 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Symbol</Label>
                        <Input
                          value={tokenData.msimToken.symbol || 'N/A'}
                          readOnly
                          className="bg-gray-700/30 text-gray-300 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Balance</Label>
                        <Input
                          value={tokenData.msimToken.balance || '0.00'}
                          readOnly
                          className="bg-gray-700/30 text-gray-300 mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-400">
                      No MSIM token data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Meme Tokens Section */}
              <Card className="border border-blue-800/30 bg-gray-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium flex items-center">
                    <Coins className="h-5 w-5 mr-2 text-blue-400" />
                    Owned Meme Tokens
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tokenData.memeTokens && tokenData.memeTokens.length > 0 ? (
                    <div className="space-y-4">
                      {tokenData.memeTokens.map((token, index) => (
                        <div key={index} className="p-3 bg-gray-700/20 rounded-md">
                          <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-4 md:col-span-1">
                              <Label className="text-xs text-gray-400">Token Address</Label>
                              <div className="font-mono text-xs text-gray-300 bg-gray-800/50 p-1.5 rounded mt-1 overflow-hidden overflow-ellipsis">
                                {token.address}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-400">Name</Label>
                              <Input
                                value={token.name}
                                readOnly
                                className="bg-gray-700/30 text-gray-300 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-400">Symbol</Label>
                              <Input
                                value={token.symbol}
                                readOnly
                                className="bg-gray-700/30 text-gray-300 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-400">Balance</Label>
                              <Input
                                value={token.balance}
                                readOnly
                                className="bg-gray-700/30 text-gray-300 mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-400">
                      You don&apos;t own any meme tokens yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Meme NFTs Section */}
              <Card className="border border-green-800/30 bg-gray-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-md font-medium flex items-center">
                    <ImageIcon className="h-5 w-5 mr-2 text-green-400" />
                    Owned Meme NFTs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tokenData.memeNfts && tokenData.memeNfts.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {tokenData.memeNfts.map((nft, index) => (
                        <div key={index} className="flex flex-col space-y-2">
                          <div className="aspect-square bg-gray-800 rounded-md overflow-hidden relative">
                            {/* Use Next.js Image component for actual implementation */}
                            <img
                              src={nft.imageUrl || '/placeholder.svg'}
                              alt={`NFT #${nft.tokenId}`}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div className="text-xs text-gray-300 text-center">
                            Token ID: {nft.tokenId}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 text-gray-400">
                      You don&apos;t own any meme NFTs yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
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
          <Card className="w-full max-w-4xl mx-auto border border-transparent animate-gradient-glow">
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
