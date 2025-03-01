'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Share2, ArrowLeft, Loader2, ThumbsUp, ThumbsDown, LogIn } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from '@/hooks/useToast'
import { useAccount } from 'wagmi'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { CreateMemeFab } from '@/components/makeMemeNowBtn'
import MemeChat from './memeChat'

export interface Author {
  id: string
  username: string
  address: string
}

export interface UserInteraction {
  interaction_type: string
}

export interface Meme {
  id: string
  meme_cdn_url: string
  created_at: string
  thumbs_up: number
  thumbs_down: number
  template_id: string
  author: Author
  title?: string
  user_interaction?: UserInteraction
  pos_contributing_meme_ids?: string[]
  neg_contributing_meme_ids?: string[]
}

export default function MemeDetailPage() {
  const params = useParams()
  const memeId = params.id as string
  const router = useRouter()
  const [forceUpdate, setForceUpdate] = useState(0)
  const { isConnected } = useAccount()
  const { isAuthenticated: authFromWallet, authedWallet, checkSession} = useWalletAuth()
  const { isAuthenticated, isClientMounted } = useAuthStatus()


  useEffect(() => {
    const check = async () => {
      await checkSession()
      setForceUpdate(prev => prev + 1) // Force re-render
    }
    check()
  }, [checkSession])

  const [meme, setMeme] = useState<Meme | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if chat should be shown
  const showChat = authedWallet && meme?.author?.address && authedWallet === meme.author.address

  // Render vote buttons or login button based on authentication status
  const renderVoteButtons = () => {
    if (!isClientMounted) {
      // Return empty placeholder while checking auth state to prevent flashing
      return <div className="h-8"></div>
    }

    if (!isAuthenticated) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 bg-black/50 hover:bg-purple-900/50 text-white flex items-center"
          onClick={handleLoginRedirect}
        >
          <LogIn className="h-4 w-4 mr-1" />
          <span className="text-xs">Log in to vote</span>
        </Button>
      )
    }

    return (
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 bg-black/50 hover:bg-black/70 text-white flex items-center
            ${meme?.user_interaction ? (
        meme.user_interaction.interaction_type === 'like'
          ? 'text-green-400'
          : 'opacity-50'
      ) : 'hover:text-green-400'}`}
          onClick={() => handleInteraction('like')}
          disabled={isLoading || !meme || (meme?.user_interaction ? true : false)}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs ml-1">{meme?.thumbs_up || 0}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 bg-black/50 hover:bg-black/70 text-white flex items-center
            ${meme?.user_interaction ? (
        meme.user_interaction.interaction_type === 'dislike'
          ? 'text-red-400'
          : 'opacity-50'
      ) : 'hover:text-red-400'}`}
          onClick={() => handleInteraction('dislike')}
          disabled={isLoading || !meme || (meme?.user_interaction ? true : false)}
        >
          <ThumbsDown className="h-4 w-4" />
          <span className="text-xs ml-1">{meme?.thumbs_down || 0}</span>
        </Button>
      </div>
    )
  }

  // Fetch meme data
  useEffect(() => {
    async function fetchMemeData() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/memes/${memeId}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch meme')
        }

        const data = await response.json()

        // Check if data has the expected structure
        if (!data.meme) {
          console.warn('API response missing meme data:', data)
          throw new Error('Invalid API response format')
        }

        setMeme(data.meme)

        // For debugging
        console.log('Meme data loaded:', data.meme)
      } catch (err) {
        console.error('Error fetching meme:', err)
        setError(err instanceof Error ? err.message : 'An error occurred while fetching meme')
      } finally {
        setIsLoading(false)
      }
    }

    if (memeId) {
      fetchMemeData()
    }
  }, [memeId, isAuthenticated]) // Re-fetch when authentication status changes

  const handleBack = () => {
    router.back()
  }

  const handleCopyLink = (e: React.MouseEvent, memeURL: string) => {
    e.stopPropagation()
    if (memeURL.includes('memulacra.nyc3.digitaloceanspaces.com')) {
      memeURL = memeURL.replace('memulacra.nyc3.digitaloceanspaces.com', 'memes.memeulacra.com')
    }
    const url = `${memeURL}`

    try {
      navigator.clipboard.writeText(url)
      toast({
        title: 'Link copied!',
        description: 'Meme link copied to clipboard',
        variant: 'default',
      })
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast({
        title: 'Error',
        description: 'Failed to copy link. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleLoginRedirect = () => {
    // Get current path to redirect back after login
    const returnUrl = window.location.pathname
    router.push(`/profile?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  const handleInteraction = async (type: 'like' | 'dislike') => {
    if (!isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please connect your wallet to interact with this meme',
        variant: 'destructive',
      })
      return
    }

    if (!meme) return

    // Check if user has already voted on this meme
    if (meme.user_interaction) {
      toast({
        title: 'Already voted',
        description: `You've already ${meme.user_interaction.interaction_type === 'like' ? 'liked' : 'disliked'} this meme`,
        variant: 'default',
      })
      return
    }

    try {
      // Use the existing /api/memes/interaction endpoint
      const response = await fetch('/api/memes/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memeId: memeId,
          interactionType: type,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${type} meme`)
      }

      const result = await response.json()

      if (result.alreadyVoted) {
        toast({
          title: 'Already voted',
          description: `You've already ${result.interactionType === 'like' ? 'liked' : 'disliked'} this meme`,
          variant: 'default',
        })
        return
      }

      // Update local state with the new counts from the API response
      setMeme(prev => {
        if (!prev) return prev

        return {
          ...prev,
          thumbs_up: result.thumbs_up,
          thumbs_down: result.thumbs_down,
          user_interaction: { interaction_type: type }
        }
      })

      toast({
        title: type === 'like' ? 'Liked!' : 'Disliked',
        description: 'Your vote has been recorded',
        variant: 'default',
      })
    } catch (error) {
      console.error(`Error ${type}ing meme:`, error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${type} meme`,
        variant: 'destructive',
      })
    }
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center mb-6">
          <Button variant="ghost" onClick={handleBack} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
          <p className="mb-4">{error}</p>
          <Button
            onClick={() => router.refresh()}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-4 flex gap-2 items-center">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="flex items-center text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-bold">{meme?.title || 'Meme Details'}</h1>
        )}
      </div>

      <div className={`grid ${showChat ? 'lg:grid-cols-2 gap-6' : 'grid-cols-1'}`}>
        {/* Meme Image Section */}
        <div className={`flex flex-col space-y-4 ${!showChat ? 'mx-auto max-w-3xl w-full' : ''}`}>
          <div className={`relative ${!showChat ? 'aspect-auto h-[70vh]' : 'aspect-square'} w-full overflow-hidden rounded-lg border bg-muted`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Image
                src={meme?.meme_cdn_url || '/placeholder.svg'}
                alt={meme?.title || 'Meme image'}
                fill
                className="object-contain"
                priority
              />
            )}
          </div>

          <CreateMemeFab />

          <div className="flex items-center justify-between">
            {renderVoteButtons()}

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 bg-black/50 hover:bg-black/70 text-white"
                onClick={(e) => handleCopyLink(e, meme?.meme_cdn_url || '')}
                disabled={isLoading}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-4 w-full" />
          ) : (
            <div className="flex flex-col space-y-2">
              <p className="text-muted-foreground">
                Posted by {meme?.author?.username || 'Unknown'} • {
                  meme?.created_at
                    ? formatDistanceToNow(new Date(meme.created_at), { addSuffix: true })
                    : 'recently'
                }
              </p>
            </div>
          )}
        </div>

        {/* Chat Section - Only show if signed in wallet matches meme author */}
        {showChat ? (
          <MemeChat
            meme={meme}
          />
        ) : null}
      </div>
    </div>
  )
}
