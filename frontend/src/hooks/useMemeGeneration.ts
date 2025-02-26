'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/useToast'

interface MemeGenerationResult {
  id: string;
  url: string;
  status?: string;
}

interface MemeGenerationRequest {
  context: string;
  numberOfOutputs: number;
  templateId?: string;
  userId?: string;
}

export function useMemeGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedMemes, setGeneratedMemes] = useState<MemeGenerationResult[]>([])
  const { toast } = useToast()

  const generateMemes = async (request: MemeGenerationRequest) => {
    setIsGenerating(true)

    try {
      // First generate placeholder images to show while the real ones are being created
      const placeholders = Array(request.numberOfOutputs)
        .fill(null)
        .map(() => ({
          id: `placeholder-${Math.random()}`,
          url: '',
          status: 'pending'
        }))

      setGeneratedMemes(placeholders)

      // Call our API endpoint
      const response = await fetch('/api/generate-memes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to generate memes')
      }

      const data = await response.json()

      console.log('data', data)

      if (data.success && data.memes && Array.isArray(data.memes)) {
        // Set the completed memes directly - no need for polling as the API always returns finished memes
        setGeneratedMemes(data.memes.map((meme: MemeGenerationResult) => ({
          ...meme,
          status: 'completed'
        })))

        toast({
          title: 'Memes generated successfully!',
          description: `${data.memes.length} memes have been created.`,
        })
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      console.error('Error generating memes:', error)
      toast({
        title: 'Failed to generate memes',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })

      // Keep the placeholders but indicate they failed
      setGeneratedMemes(prev => prev.map(meme => ({
        ...meme,
        url: '/images/meme-generation-failed.svg', // Make sure this file exists
        status: 'failed'
      })))
    } finally {
      setIsGenerating(false)
    }
  }

  return {
    generateMemes,
    isGenerating,
    generatedMemes
  }
}
