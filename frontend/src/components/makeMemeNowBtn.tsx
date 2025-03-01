'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface CreateMemeFabProps {
  className?: string
}

export function CreateMemeFab({ className = '' }: CreateMemeFabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      className={`fixed bottom-6 right-6 z-50 ${className}`}
    >
      <Link href="/studio">
        <Button
          size="lg"
          className="rounded-full shadow-lg w-16 h-16 p-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white animate-pulse hover:animate-none"
          aria-label="Create a new meme"
        >
          <div className="flex flex-col items-center justify-center">
            <Plus className="h-10 w-10 mb-0.5" />
            {/* <span className="text-xs font-medium">Make Meme</span> */}
          </div>
        </Button>
      </Link>
    </motion.div>
  )
}
