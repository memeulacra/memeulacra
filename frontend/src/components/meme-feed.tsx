'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Share2, ThumbsUp, ThumbsDown, Clock, LogIn, Maximize2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/hooks/useToast'
import { useAuthStatus } from '@/hooks/useAuthStatus'

interface Author {
  id: string
  username: string
  address: string
}

interface UserInteraction {
  interaction_type: string
}

interface Meme {
  id: string
  context: string
  meme_cdn_url: string
  created_at: string
  thumbs_up: number
  thumbs_down: number
  template_id: string
  author: Author
  title?: string
  user_interaction?: UserInteraction
}

interface MemeFeedProps {
  initialSort?: 'newest' | 'popular' | 'trending'
}

export default function MemeFeed({ initialSort = 'newest' }: MemeFeedProps) {
  const [memes, setMemes] = useState<Meme[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'popular' | 'trending'>(initialSort)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [zoomedMeme, setZoomedMeme] = useState<Meme | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { isAuthenticated, isClientMounted } = useAuthStatus()

  // Set up IntersectionObserver for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  })

  // Initial load
  useEffect(() => {
    loadMemes(true)
  }, [sort]) // Reload when sort changes

  // Load more when the user scrolls to the bottom
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      loadMemes(false)
    }
  }, [inView, hasMore, isLoading])

  // Handle ESC key to close zoomed image
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedMeme) {
        setZoomedMeme(null)
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [zoomedMeme])

  const loadMemes = async (reset: boolean) => {
    if (isLoading) return

    try {
      setIsLoading(true)
      setError(null)

      // Build the API URL
      const params = new URLSearchParams()
      params.append('sort', sort)
      params.append('limit', '25')

      if (!reset && nextCursor) {
        params.append('cursor', nextCursor)
      }

      const response = await fetch(`/api/memes/feed?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch memes')
      }

      const data = await response.json()

      setMemes(prev => reset ? data.memes : [...prev, ...data.memes])
      setNextCursor(data.pagination.nextCursor)
      setHasMore(data.pagination.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error loading memes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSortChange = (newSort: 'newest' | 'popular' | 'trending') => {
    if (newSort !== sort) {
      setSort(newSort)
      // Reset will happen in the useEffect
    }
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

  const handleZoom = (e: React.MouseEvent, meme: Meme) => {
    e.preventDefault()
    e.stopPropagation()
    setZoomedMeme(meme)
  }

  const handleLike = async (e: React.MouseEvent, memeId: string) => {
    e.stopPropagation()

    // Check if user has already voted on this meme
    const meme = memes.find(m => m.id === memeId)
    if (meme?.user_interaction) {
      // User has already voted, don't allow changes
      toast({
        title: 'Already voted',
        description: `You've already ${meme.user_interaction.interaction_type === 'like' ? 'liked' : 'disliked'} this meme`,
        variant: 'default',
      })
      return
    }

    try {
      const response = await fetch('/api/memes/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memeId,
          interactionType: 'like',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to like meme')
      }

      const result = await response.json()

      // If already voted, just return
      if (result.alreadyVoted) {
        toast({
          title: 'Already voted',
          description: `You've already ${result.interactionType} this meme`,
          variant: 'default',
        })
        return
      }

      // Update local state
      setMemes(prev =>
        prev.map(meme =>
          meme.id === memeId
            ? {
              ...meme,
              thumbs_up: result.thumbs_up,
              thumbs_down: result.thumbs_down,
              user_interaction: { interaction_type: 'like' }
            }
            : meme
        )
      )

      toast({
        title: 'Liked!',
        description: 'Your vote has been recorded',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error liking meme:', error)
      toast({
        title: 'Error',
        description: 'Failed to like this meme. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDislike = async (e: React.MouseEvent, memeId: string) => {
    e.stopPropagation()

    // Check if user has already voted on this meme
    const meme = memes.find(m => m.id === memeId)
    if (meme?.user_interaction) {
      // User has already voted, don't allow changes
      toast({
        title: 'Already voted',
        description: `You've already ${meme.user_interaction.interaction_type === 'like' ? 'liked' : 'disliked'} this meme`,
        variant: 'default',
      })
      return
    }

    try {
      const response = await fetch('/api/memes/interaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memeId,
          interactionType: 'dislike',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to dislike meme')
      }

      const result = await response.json()

      // If already voted, just return
      if (result.alreadyVoted) {
        toast({
          title: 'Already voted',
          description: `You've already ${result.interactionType} this meme`,
          variant: 'default',
        })
        return
      }

      // Update local state
      setMemes(prev =>
        prev.map(meme =>
          meme.id === memeId
            ? {
              ...meme,
              thumbs_up: result.thumbs_up,
              thumbs_down: result.thumbs_down,
              user_interaction: { interaction_type: 'dislike' }
            }
            : meme
        )
      )

      toast({
        title: 'Disliked',
        description: 'Your vote has been recorded',
        variant: 'default',
      })
    } catch (error) {
      console.error('Error disliking meme:', error)
      toast({
        title: 'Error',
        description: 'Failed to dislike this meme. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleLoginRedirect = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Get current path to redirect back after login
    const returnUrl = window.location.pathname
    router.push(`/profile?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  // Render vote buttons or login button based on authentication status
  const renderVoteButtons = (meme: Meme) => {
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
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 bg-black/50 hover:bg-black/70 text-white flex items-center
            ${meme.user_interaction ? (
        meme.user_interaction.interaction_type === 'like'
          ? 'text-green-400'
          : 'opacity-50'
      ) : 'hover:text-green-400'}`}
          onClick={(e) => handleLike(e, meme.id)}
          disabled={meme.user_interaction ? true : false}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs ml-1">{meme.thumbs_up || 0}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 bg-black/50 hover:bg-black/70 text-white flex items-center
            ${meme.user_interaction ? (
        meme.user_interaction.interaction_type === 'dislike'
          ? 'text-red-400'
          : 'opacity-50'
      ) : 'hover:text-red-400'}`}
          onClick={(e) => handleDislike(e, meme.id)}
          disabled={meme.user_interaction ? true : false}
        >
          <ThumbsDown className="h-4 w-4" />
          <span className="text-xs ml-1">{meme.thumbs_down || 0}</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto px-4">
      {/* Sort controls */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <Button
            variant={sort === 'newest' ? 'default' : 'outline'}
            onClick={() => handleSortChange('newest')}
            className="px-4"
          >
            <Clock className="mr-2 h-4 w-4" />
            Latest
          </Button>
          <Button
            variant={sort === 'popular' ? 'default' : 'outline'}
            onClick={() => handleSortChange('popular')}
            className="px-4"
          >
            <ThumbsUp className="mr-2 h-4 w-4" />
            Popular
          </Button>
          <Button
            variant={sort === 'trending' ? 'default' : 'outline'}
            onClick={() => handleSortChange('trending')}
            className="px-4"
          >
            🔥 Trending
          </Button>
        </div>
      </div>

      {/* Meme grid - Changed to 2 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
        {memes.map((meme, index) => (
          <motion.div
            key={meme.id}
            className="relative overflow-hidden rounded-lg shadow-lg group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(0.1 * (index % 4), 0.5) }}
          >
            {/* Changed the aspect ratio to have larger images */}
            <Link href={`/meme/${meme.id}`} className="aspect-[4/3] relative cursor-pointer block">
              <Image
                src={meme.meme_cdn_url || '/placeholder.svg'}
                alt={`Meme by ${meme.author.username}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 500px"
                className="object-contain transition-transform duration-300 group-hover:scale-95"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex justify-between items-center w-full mb-2">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
                        onClick={(e) => handleCopyLink(e, meme.meme_cdn_url)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      {/* New Zoom button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
                        onClick={(e) => handleZoom(e, meme)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-bold">
                        {meme.title || ''}
                      </span>
                    </div>
                    {renderVoteButtons(meme)}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-white text-xs md:text-sm"></p>
                    <p className="text-gray-400 text-xs md:text-sm">
                      {formatDistanceToNow(new Date(meme.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            {/* Added a visible info section below each image */}
            <div className="p-3 bg-gray-800">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1 cursor-not-allowed">
                  <ThumbsUp className="h-3 w-3 text-green-400" />
                  <span className="text-xs text-gray-200">{meme.thumbs_up || 0}</span>
                  <ThumbsDown className="h-3 w-3 text-red-400 ml-2" />
                  <span className="text-xs text-gray-200">{meme.thumbs_down || 0}</span>
                </div>
                <p className="text-gray-400 text-xs">
                  By {meme.author.username}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-center my-8 text-red-500">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => loadMemes(false)}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* End of feed message */}
      {!hasMore && memes.length > 0 && (
        <div className="text-center my-8 text-gray-400">
          <p>You&apos;ve reached the end of the feed</p>
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={ref} className="h-10 mt-4" />

      {/* Full-screen zoomed image modal */}
      {zoomedMeme && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomedMeme(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-10 w-10 bg-black/50 text-white hover:bg-black/70 z-10"
            onClick={() => setZoomedMeme(null)}
          >
            <X className="h-6 w-6" />
          </Button>

          <div className="relative w-full h-full max-w-6xl max-h-screen p-4 flex items-center justify-center">
            <Image
              src={zoomedMeme.meme_cdn_url || '/placeholder.svg'}
              alt={`Meme by ${zoomedMeme.author.username}`}
              fill
              className="object-contain"
              sizes="100vw"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
            <p className="mb-1">By {zoomedMeme.author.username}</p>
            <p className="text-gray-400 text-xs">
              {formatDistanceToNow(new Date(zoomedMeme.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
