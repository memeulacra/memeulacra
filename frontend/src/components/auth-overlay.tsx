'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { LockIcon } from 'lucide-react'

interface AuthOverlayProps {
  returnUrl?: string
  message?: string
}

export default function AuthOverlay({
  returnUrl,
  message = 'Please connect your wallet to access this feature'
}: AuthOverlayProps) {
  const router = useRouter()

  const handleLoginClick = () => {
    const url = returnUrl
      ? `/profile?returnUrl=${encodeURIComponent(returnUrl)}`
      : '/profile'
    router.push(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-900 border border-purple-800/50 rounded-lg p-8 max-w-md w-full shadow-xl animate-gradient-glow"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mb-6">
            <LockIcon className="w-8 h-8 text-purple-400" />
          </div>

          <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Authentication Required
          </h2>

          <p className="text-gray-400 mb-6">
            {message}
          </p>

          <Button
            onClick={handleLoginClick}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-2"
            size="lg"
          >
            Connect Wallet
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
