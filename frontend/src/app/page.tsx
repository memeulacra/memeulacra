'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreateMemeFab } from '@/components/makeMemeNowBtn'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Rocket, Sparkles, ChevronUp, ChevronDown } from 'lucide-react'
import MemeFeed from '@/components/meme-feed'

export default function Home() {
  const [showHero, setShowHero] = useState(true)

  return (
    <div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowHero(!showHero)}
        className="fixed top-4 right-4 z-50 bg-gray-800/50 border border-transparent animate-gradient-glow"
      >
        {showHero ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </Button>

      <CreateMemeFab />

      <AnimatePresence>
        {showHero && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '80vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 to-black/80" />
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
            </div>
            <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-6"
              >
                <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-sm font-medium mb-4">
                  🚀 The Future of Memes, Now.
                </span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-retro-green"
              >
                Create Your Next
                <br />
                Viral Meme Sensation
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-xl md:text-2xl mb-8 text-gray-300"
              >
                Transform your ideas into viral-worthy memes. Generate unique, viral-ready meme coin art with our
                AI-powered studio. Running on the Base Sepolia testnet.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link href="/studio">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                  >
                    <Rocket className="mr-2 h-5 w-5" />
                    Launch Meme Generator
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-purple-500 text-purple-400 hover:bg-purple-950/50"
                  onClick={() => {
                    document.getElementById('community')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Explore Community Memes
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="mt-12 text-sm text-gray-400"
              >
                <p>Already BUIDLing the memes of tomorrow - join the web3 revolution!</p>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section id="community" className={`px-4 py-12 bg-black/50 ${!showHero ? 'pt-20' : ''}`}>
        <div className="p-8 mx-auto">
          <h2 className="text-3xl font-bold mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
            Community Creations
          </h2>
          <p className="text-gray-400 mb-8 text-center">Check out the latest meme coin art from our community</p>

          {/* Replace the old image grid with our new MemeFeed component */}
          <MemeFeed initialSort="newest" />
        </div>
      </section>
    </div>
  )
}
