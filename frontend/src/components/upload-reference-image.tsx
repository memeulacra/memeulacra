'use client'

import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface UploadReferenceImageProps {
  onImageUpload: (file: File | null) => void
}

export function UploadReferenceImage({ onImageUpload }: UploadReferenceImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
      onImageUpload(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleClear = () => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onImageUpload(null)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors duration-200"
          onClick={handleClick}
        >
          {previewUrl ? (
            <div className="relative w-full h-full">
              <Image src={previewUrl || '/placeholder.svg'} alt="Reference image" layout="fill" objectFit="cover" />
            </div>
          ) : (
            <Upload className="w-8 h-8 text-gray-400" />
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </div>
        {previewUrl && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <span className="text-xs text-gray-400 mt-1 text-center w-full">Reference image</span>
    </div>
  )
}

