import { useState, useCallback, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

interface AuthState {
  isAuthenticated: boolean
  isAuthenticating: boolean
  error: Error | null
  authedWallet: string | null
}

export function useWalletAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    authedWallet: null,
    error: null,
  })
  const [nonce, setNonce] = useState<string | null>(null)
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  // Use a ref to track if login is in progress to prevent multiple simultaneous attempts
  const loginInProgress = useRef(false)

  // Generate nonce
  const generateNonce = useCallback(async () => {
    if (!address) return null

    try {
      console.log(`Requesting nonce for address: ${address}`)
      const response = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      })

      if (!response.ok) {
        throw new Error(`Failed to generate nonce: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`Received nonce: ${data.nonce.substring(0, 10)}...`)
      setNonce(data.nonce)
      return data.nonce
    } catch (error) {
      console.error('Error generating nonce:', error)
      setAuthState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Unknown error generating nonce'),
      }))
      return null
    }
  }, [address])

  // Check if user is already authenticated
  const checkSession = useCallback(async () => {
    try {
      console.log('Checking authentication session...')
      const response = await fetch('/api/auth/session')
      const data = await response.json()

      console.log('Session check result:', data)
      console.log('Previous authedWallet:', authState.authedWallet)
      console.log('New authedWallet from session:', data.address)
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: data.authenticated,
        isAuthenticating: false,
        error: null,
        authedWallet: data.address,
      }))

      return data.authenticated
    } catch (error) {
      console.error('Error checking session:', error)
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        isAuthenticating: false,
        authedWallet: null,
        error: error instanceof Error ? error : new Error('Unknown error checking session'),
      }))
      return false
    }
  }, [])

  // Login with wallet
  const login = useCallback(async () => {
    // Prevent multiple simultaneous login attempts
    if (loginInProgress.current) {
      console.log('Login already in progress, skipping')
      return false
    }

    if (!address || !isConnected) {
      console.log('Cannot login: wallet not connected', { address, isConnected })
      setAuthState(prev => ({
        ...prev,
        error: new Error('Wallet not connected'),
      }))
      return false
    }

    console.log('Starting login process for address:', address)
    setAuthState(prev => ({
      ...prev,
      isAuthenticating: true,
      error: null,
    }))

    loginInProgress.current = true

    try {
      // Generate nonce if we don't have one
      const currentNonce = nonce || await generateNonce()
      if (!currentNonce) {
        throw new Error('Failed to generate authentication nonce')
      }

      console.log('Preparing to sign message with nonce:', currentNonce.substring(0, 10) + '...')

      // Sign the message with the wallet
      const signatureMessage = `Sign this message to authenticate with Memeulacra.\n\nNonce: ${currentNonce}`
      console.log('Requesting signature for message:', signatureMessage)

      const signature = await signMessageAsync({ message: signatureMessage })
      console.log('Received signature:', signature.substring(0, 20) + '...')

      // Verify the signature with the backend
      console.log('Verifying signature with backend...')
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          signature,
          nonce: currentNonce,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Authentication failed:', errorText)
        throw new Error(`Authentication failed: ${errorText}`)
      }

      console.log('Authentication successful!')

      // Update auth state
      setAuthState({
        isAuthenticated: true,
        isAuthenticating: false,
        error: null,
        authedWallet: address,
      })

      // Clear the nonce after successful authentication
      setNonce(null)

      return true
    } catch (error) {
      console.error('Error during login:', error)
      setAuthState({
        isAuthenticated: false,
        isAuthenticating: false,
        error: error instanceof Error ? error : new Error('Unknown error during authentication'),
        authedWallet: null,
      })
      return false
    } finally {
      loginInProgress.current = false
    }
  }, [address, isConnected, nonce, generateNonce, signMessageAsync])

  // Logout
  const logout = useCallback(async () => {
    try {
      console.log('Logging out...')
      await fetch('/api/auth/logout', {
        method: 'POST',
      })

      console.log('Logout successful')
      // Clear all local storage
      localStorage.clear()

      // Clear all cookies
      document.cookie.split(';').forEach(cookie => {
        const trimmedCookie = cookie.trim()
        const cookieName = trimmedCookie.split('=')[0]
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })

      // Reload the page after logout
      setTimeout(() => {
        window.location.reload()
      }, 100)


      setAuthState({
        isAuthenticated: false,
        isAuthenticating: false,
        error: null,
        authedWallet: null,
      })

      return true
    } catch (error) {
      console.error('Error during logout:', error)
      return false
    }
  }, [])

  return {
    ...authState,
    login,
    logout,
    checkSession,
    generateNonce,
  }
}
