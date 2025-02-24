'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface VersionHistoryProps {
  onClose: () => void
  history: string[]
}

export default function VersionHistory({ onClose, history }: VersionHistoryProps) {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Version History</h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </motion.button>
      </div>
      <div className="space-y-4">
        {history.map((action, index) => (
          <motion.div
            key={index}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300">#{history.length - index}</span>
              <span className="text-xs text-gray-400">Just now</span>
            </div>
            <p className="text-sm">{action}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

