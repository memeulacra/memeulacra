'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

export function WalletAuth() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if we already have a session
    checkSession()

    // When wallet is connected, initiate authentication if not already authenticated
    if (isConnected && address && !isAuthenticating && !isAuthenticated) {
      authenticateWithWallet(address)
    }
  }, [isConnected, address])

  async function checkSession() {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setIsAuthenticated(data.authenticated)
      }
    } catch (error) {
      console.error('Failed to check session:', error)
    }
  }

  async function authenticateWithWallet(walletAddress: string) {
    try {
      setIsAuthenticating(true)

      // Step 1: Request a nonce from the server
      const nonceResponse = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress })
      })

      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce')
      }

      const { nonce } = await nonceResponse.json()

      // Step 2: Ask user to sign the message with the nonce
      const message = `Sign this message to authenticate with our application.\n\nNonce: ${nonce}`
      const signature = await signMessageAsync({ message })

      // Step 3: Verify the signature with the server
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          signature,
          nonce
        })
      })

      if (!verifyResponse.ok) {
        throw new Error('Signature verification failed')
      }

      // Authentication successful!
      const user = await verifyResponse.json()
      console.log('Authenticated as:', user)
      setIsAuthenticated(true)

      // No need to reload the page - we'll just set state
    } catch (error) {
      console.error('Authentication error:', error)
    } finally {
      setIsAuthenticating(false)
    }
  }

  // This component doesn't render anything visible
  return null
}
