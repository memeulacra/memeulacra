'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Loader } from 'lucide-react'
import QuickAccessTools from '@/components/quick-access-tools'
import { ImageModal } from '@/components/image-modal'
import { useMemeGeneration } from '@/hooks/useMemeGeneration'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import AuthOverlay from '@/components/auth-overlay'
import { AnimatePresence } from 'framer-motion'
import { usePayment } from '@/hooks/usePayment'

interface ModelSettings {
  numberOfOutputs: 1 | 2 | 3 | 4
}

export default function ImageStudio() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const { generateMemes, isGenerating, generatedMemes } = useMemeGeneration()
  const { isAuthenticated, isLoading, isClientMounted } = useAuthStatus()
  const pathname = usePathname()
  const { makePayment, isLoading: paying } = usePayment()

  const handlePromptSubmit = async (prompt: string, modelSettings: ModelSettings) => {
    console.log('Generating images with:', { prompt, modelSettings })
    // Call our API through the hook
    try {    
      await makePayment()
      await generateMemes({
        context: prompt,
        numberOfOutputs: modelSettings.numberOfOutputs,
      })
    } catch (error) {
      console.error('Error generating memes did you pay?')
    }
  }

  const getGridClass = (imageCount: number) => {
    switch (imageCount) {
        case 1:
          return 'grid-cols-1'
        case 2:
          return 'grid-cols-2'
        case 3:
          return 'grid-cols-2 grid-rows-2'
        case 4:
          return 'grid-cols-2 grid-rows-2'
        default:
          return 'grid-cols-2 grid-rows-2'
    }
  }

  // Only render the actual content if we've checked auth status
  if (!isClientMounted) {
    return null // Prevent flash of content before client-side code runs
  }

  return (
    <>
      <div className="flex flex-col h-screen">
        <div className="flex-1 min-h-0 p-4 overflow-hidden">
          <div className="relative h-full bg-gray-800 rounded-lg overflow-hidden">
            {generatedMemes.length > 0 ? (
              <div className={`grid ${getGridClass(generatedMemes.length)} gap-4 p-4 h-full`}>
                {generatedMemes.map((meme, index) => (
                  <div
                    key={meme.id}
                    className={`relative cursor-pointer overflow-hidden ${generatedMemes.length === 3 && index === 2 ? 'col-span-2' : ''}`}
                    onClick={() => setSelectedImage(meme.url)}
                  >
                    <div className="relative w-full h-full aspect-square">
                      {meme.url && (
                        <Image
                          src={meme.url}
                          alt={`Generated Image ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          style={{ objectFit: 'contain' }}
                          className="rounded-lg"
                        />
                      )}
                      {(isGenerating || paying) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                          <Loader className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                {(paying || isGenerating) ? (
                  <div className="flex flex-col items-center">
                    <Loader className="h-8 w-8 animate-spin mb-4" />
                    <p>Generating your memes...</p>
                  </div>
                ) : (
                  'No images generated yet'
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="max-w-2xl mx-auto">
            <QuickAccessTools
              onPromptSubmit={handlePromptSubmit}
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Selected meme modal */}
        {selectedImage && (
          <ImageModal
            src={selectedImage}
            alt="Full-size generated meme"
            onClose={() => setSelectedImage(null)}
          />
        )}
      </div>

      {/* Auth overlay - shows when not authenticated and not loading */}
      <AnimatePresence>
        {isClientMounted && !isLoading && !isAuthenticated && (
          <AuthOverlay
            returnUrl={pathname}
            message="Connect your wallet to create viral meme coin art with our AI-powered studio"
          />
        )}
      </AnimatePresence>
    </>
  )
}
