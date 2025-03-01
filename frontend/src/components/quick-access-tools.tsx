'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'

interface ModelSettings {
  numberOfOutputs: 1 | 2 | 3 | 4;
}

interface QuickAccessToolsProps {
  onPromptSubmit: (prompt: string, modelSettings: ModelSettings) => void;
  isGenerating?: boolean;
}

export default function QuickAccessTools({
  onPromptSubmit,
  isGenerating = false,
}: QuickAccessToolsProps) {
  const [prompt, setPrompt] = useState('')
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    numberOfOutputs: 4,
  })

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
  }

  const handleNumberOfOutputsChange = (value: string) => {
    setModelSettings({
      ...modelSettings,
      numberOfOutputs: parseInt(value) as 1 | 2 | 3 | 4,
    })
  }

  const handleGenerate = () => {
    if (!prompt.trim()) return
    onPromptSubmit(prompt, modelSettings)
  }

  // Example prompts with short names and full content
  const promptExamples = [
    {
      shortName: 'Cyberpunk Dog',
      fullText: 'A dog riding a skateboard through a cyberpunk city',
    },
    {
      shortName: 'Crypto Warrior',
      fullText: 'An ancient meme coin warrior defending crypto castle',
    },
    {
      shortName: 'Moon Discovery',
      fullText: 'Astronaut discovering a meme coin on the moon',
    },
    {
      shortName: 'Wall St Panic',
      fullText: 'Wall Street banker panicking as meme coins take over',
    },
  ]

  const handlePromptExample = (example: string) => {
    setPrompt(example)
  }

  return (
    <Card className="border border-transparent animate-gradient-glow">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-2 flex justify-between">
              <span>Describe your meme idea</span>
              <span>{prompt.length}/10000 characters</span>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe the meme you want to create..."
                className="min-h-[80px] bg-gray-700/50 flex-grow"
                maxLength={10000}
                value={prompt}
                onChange={handlePromptChange}
              />
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 min-h-[100px]"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Generating...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Generate Meme (4-MSIM)</span>
                    <span className="sm:hidden">Generate (4 MSIM)</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-sm text-gray-400 mb-2">Number of outputs</div>
              <Select
                value={String(modelSettings.numberOfOutputs)}
                onValueChange={handleNumberOfOutputsChange}
                disabled={isGenerating}
              >
                <SelectTrigger className="bg-gray-700/50">
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div> */}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 p-4 pt-0">
        <div className="text-sm text-gray-400 mb-0">Try an example:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
          {promptExamples.map((example, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto py-2 px-3 text-xs text-left justify-start border-gray-700 hover:bg-gray-700/50 truncate"
              onClick={() => handlePromptExample(example.fullText)}
              disabled={isGenerating}
            >
              {example.shortName}
            </Button>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
