'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Image, User } from 'lucide-react'
import { motion } from 'framer-motion'

const menuItems = [
  { icon: Users, label: 'Community', href: '/' },
  { icon: Image, label: 'Studio', href: '/studio' },
  { icon: User, label: 'Profile', href: '/profile' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-16 bg-gray-800 bg-opacity-30 backdrop-blur-lg flex flex-col items-center py-8 space-y-8"
    >
      {menuItems.map(({ icon: Icon, label, href }) => (
        <motion.div key={label} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Link href={href} passHref>
            <div
              className={`p-2 rounded-full bg-gray-700 bg-opacity-50 hover:bg-opacity-75 transition-all
                ${pathname === href ? 'animate-gradient-glow' : ''}
              `}
            >
              <Icon className={`w-6 h-6 ${pathname === href ? 'text-purple-400' : ''}`} />
              <span className="sr-only">{label}</span>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.aside>
  )
}
