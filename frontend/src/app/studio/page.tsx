'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Maximize2, Minimize2, Loader } from 'lucide-react'
import QuickAccessTools from '@/components/quick-access-tools'
import { Button } from '@/components/ui/button'
import { ImageModal } from '@/components/image-modal'
import { useMemeGeneration } from '@/hooks/useMemeGeneration'

interface ModelSettings {
  numberOfOutputs: 1 | 2 | 3 | 4
}

export default function ImageStudio() {
  const [isFullSize, setIsFullSize] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const { generateMemes, isGenerating, generatedMemes } = useMemeGeneration()

  const handlePromptSubmit = async (prompt: string, modelSettings: ModelSettings) => {
    console.log('Generating images with:', { prompt, modelSettings })

    // Call our API through the hook
    await generateMemes({
      context: prompt,
      numberOfOutputs: modelSettings.numberOfOutputs,
    })
  }

  const toggleFullSize = () => {
    setIsFullSize(!isFullSize)
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

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 min-h-0 p-4 overflow-hidden">
        <div className="relative h-full bg-gray-800 rounded-lg overflow-hidden">
          {generatedMemes.length > 0 ? (
            <div className={`grid ${getGridClass(generatedMemes.length)} gap-4 p-4 h-full`}>
              {generatedMemes.map((meme, index) => (
                <div
                  key={meme.id}
                  className={`relative ${generatedMemes.length === 3 && index === 2 ? 'col-span-2' : ''}`}
                  onClick={() => setSelectedImage(meme.url)}
                >
                  <div className="relative w-full h-full">
                    {meme.url && (<Image
                      src={meme.url}
                      alt={`Generated Image ${index + 1}`}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-lg"
                    />)}
                    {isGenerating && (
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
              {isGenerating ? (
                <div className="flex flex-col items-center">
                  <Loader className="h-8 w-8 animate-spin mb-4" />
                  <p>Generating your memes...</p>
                </div>
              ) : (
                'No images generated yet'
              )}
            </div>
          )}
          <Button variant="outline" size="icon" className="absolute top-2 right-2 z-10" onClick={toggleFullSize}>
            {isFullSize ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
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
    </div>
  )
}
