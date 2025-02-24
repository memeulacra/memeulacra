'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Maximize2, Minimize2 } from 'lucide-react'
import QuickAccessTools from '@/components/quick-access-tools'
import { Button } from '@/components/ui/button'
import { ImageModal } from '@/components/image-modal'

  interface ModelSettings {
    numberOfOutputs: 1 | 2 | 3 | 4
  }

export default function ImageStudio() {
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [isFullSize, setIsFullSize] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const handlePromptSubmit = (prompt: string, modelSettings: ModelSettings) => {
    console.log('Generating images with:', { prompt, modelSettings })

    // Generate mock image URLs based on the number of outputs
    const mockImageUrls = Array(modelSettings.numberOfOutputs)
      .fill(null)
      .map(() => `https://picsum.photos/800/600?random=${Date.now() + Math.random()}`)
    setGeneratedImages(mockImageUrls)
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
          {generatedImages.length > 0 ? (
            <div className={`grid ${getGridClass(generatedImages.length)} gap-4 p-4 h-full`}>
              {generatedImages.map((image, index) => (
                <div
                  key={index}
                  className={`relative ${generatedImages.length === 3 && index === 2 ? 'col-span-2' : ''}`}
                  onClick={() => setSelectedImage(image)}
                >
                  <Image
                    src={image || '/placeholder.svg'}
                    alt={`Generated Image ${index + 1}`}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-lg"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                No images generated yet
            </div>
          )}
          <Button variant="outline" size="icon" className="absolute top-2 right-2 z-10" onClick={toggleFullSize}>
            {isFullSize ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="p-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <QuickAccessTools onPromptSubmit={handlePromptSubmit} />
        </div>
      </div>

      {selectedImage && (
        <ImageModal
          src={selectedImage || '/placeholder.svg'}
          alt="Full-size generated image"
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  )
}
