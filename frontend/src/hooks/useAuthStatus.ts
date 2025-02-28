'use client'

import { useState, useEffect } from 'react'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { useAccount } from 'wagmi'

export function useAuthStatus() {
  const [isLoading, setIsLoading] = useState(true)
  const [isClientMounted, setIsClientMounted] = useState(false)
  const { isAuthenticated, isAuthenticating, checkSession } = useWalletAuth()
  const { isConnected } = useAccount()

  // Make sure we're running on the client
  useEffect(() => {
    setIsClientMounted(true)
  }, [])

  // Check authentication status when mounted
  useEffect(() => {
    if (isClientMounted && !isAuthenticating) {
      const verifyAuth = async () => {
        try {
          await checkSession()
          setIsLoading(false)
        } catch (error) {
          console.error('Error checking auth status:', error)
          setIsLoading(false)
        }
      }

      verifyAuth()
    }
  }, [isClientMounted, isAuthenticating, checkSession])

  return {
    isAuthenticated,
    isAuthenticating,
    isWalletConnected: isConnected,
    isLoading: isLoading || isAuthenticating,
    isClientMounted
  }
}
