'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, Minimize2 } from 'lucide-react'

export default function Canvas() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <motion.div
      layout
      className={`relative bg-gray-800 rounded-lg overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50' : 'm-4 aspect-video'
      }`}
    >
      <img src="/placeholder.svg" alt="Generated Image" className="w-full h-full object-contain" />
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute bottom-4 right-4 p-2 bg-gray-900 bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors duration-200"
      >
        {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
      </motion.button>
    </motion.div>
  )
}
