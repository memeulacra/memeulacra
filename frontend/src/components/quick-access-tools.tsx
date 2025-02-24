'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

interface QuickAccessToolsProps {
  onPromptSubmit: (prompt: string, modelSettings: ModelSettings) => void
}

interface ModelSettings {
  numberOfOutputs: 1 | 2 | 3 | 4
}

export default function QuickAccessTools({ onPromptSubmit }: QuickAccessToolsProps) {
  const [prompt, setPrompt] = useState('')
  const [numberOfOutputs, setNumberOfOutputs] = useState<number>(1)

  const handlePromptSubmit = () => {
    onPromptSubmit(prompt, { numberOfOutputs: numberOfOutputs as 1 | 2 | 3 | 4 })
  }

  const handleNumberOfOutputsChange = (value: number[]) => {
    setNumberOfOutputs(value[0])
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
      className="w-full"
    >
      <div className="bg-gray-800 backdrop-blur-lg rounded-lg p-4 shadow-lg border border-transparent animate-gradient-glow">
        <div className="space-y-4">
          <Textarea
            placeholder="Describe your meme coin art idea..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full !bg-gray-700 !bg-opacity-50 text-white placeholder-gray-400 border-gray-600"
            rows={4}
          />
          <div className="flex items-center gap-8">
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="number-of-outputs" className="text-sm text-gray-300">
                  Number of Outputs
                </Label>
                <span className="text-sm text-gray-400">{numberOfOutputs}</span>
              </div>
              <Slider
                id="number-of-outputs"
                min={1}
                max={4}
                step={1}
                value={[numberOfOutputs]}
                onValueChange={handleNumberOfOutputsChange}
                className="w-full [&_[role=slider]]:bg-purple-600 [&_.relative]:bg-gradient-to-r [&_.relative]:from-purple-600/25 [&_.relative]:to-pink-600/25"
              />
            </div>
            <Button
              onClick={handlePromptSubmit}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              Generate
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
