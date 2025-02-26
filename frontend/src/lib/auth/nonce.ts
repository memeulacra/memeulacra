import crypto from 'crypto'

// In-memory store for nonces (replace with Redis or another cache in production)
const nonceStore: Record<string, { nonce: string; expires: number }> = {}

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Nonce expiration time (5 minutes)
const NONCE_EXPIRATION = 5 * 60 * 1000

/**
 * Generate a secure nonce for wallet authentication
 * @param address The wallet address to generate a nonce for
 * @returns The generated nonce
 */
export function generateNonce(address: string): string {
  // Clean up the address to ensure consistent format
  const normalizedAddress = address.toLowerCase()

  // Generate a secure random nonce
  const nonce = crypto.randomBytes(32).toString('hex')

  // Store the nonce with expiration
  nonceStore[normalizedAddress] = {
    nonce,
    expires: Date.now() + NONCE_EXPIRATION
  }

  // Set up cleanup if not already done
  setupCleanup()

  return nonce
}

/**
 * Validate a nonce for a given address
 * @param address The wallet address
 * @param nonce The nonce to validate
 * @returns Whether the nonce is valid
 */
export function validateNonce(address: string, nonce: string): boolean {
  const normalizedAddress = address.toLowerCase()

  // Get the stored nonce data
  const nonceData = nonceStore[normalizedAddress]

  // If no nonce exists or it has expired, return false
  if (!nonceData || nonceData.expires < Date.now()) {
    return false
  }

  // Check if the nonce matches
  const valid = nonceData.nonce === nonce

  // If valid, invalidate the nonce to prevent replay attacks
  if (valid) {
    delete nonceStore[normalizedAddress]
  }

  return valid
}

// Set up cleanup of expired nonces
let cleanupInterval: NodeJS.Timeout | null = null

function setupCleanup() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const now = Date.now()

    // Clean up expired nonces
    for (const address in nonceStore) {
      if (nonceStore[address].expires < now) {
        delete nonceStore[address]
      }
    }
  }, CLEANUP_INTERVAL)

  // Ensure the interval is cleared when the server shuts down
  if (typeof process !== 'undefined') {
    process.on('exit', () => {
      if (cleanupInterval) clearInterval(cleanupInterval)
    })
  }
}
