import { randomBytes } from 'crypto'

// In-memory store for nonces with expiration
// In production, you might want to use Redis or another distributed cache
const nonceStore = new Map<string, { value: string, expires: number }>()

// Cleanup expired nonces periodically
setInterval(() => {
  const now = Date.now()
  for (const [address, data] of nonceStore.entries()) {
    if (data.expires < now) {
      nonceStore.delete(address)
    }
  }
}, 60000) // Clean up every minute

/**
 * Generates a new nonce for an address
 * 
 * @param address Ethereum address to generate nonce for
 * @returns The generated nonce
 */
export function generateNonce(address: string): string {
  // Generate a random nonce
  const nonce = randomBytes(32).toString('hex')
  
  // Store the nonce with 5-minute expiration
  nonceStore.set(address.toLowerCase(), {
    value: nonce,
    expires: Date.now() + 5 * 60 * 1000 // 5 minutes
  })
  
  return nonce
}

/**
 * Validates a nonce for an address and removes it if valid
 * 
 * @param address Ethereum address to validate nonce for
 * @param nonce Nonce to validate
 * @returns boolean indicating if the nonce is valid
 */
export function validateNonce(address: string, nonce: string): boolean {
  const key = address.toLowerCase()
  const storedData = nonceStore.get(key)
  
  // Check if we have a nonce for this address
  if (!storedData) return false
  
  // Check if the nonce has expired
  if (storedData.expires < Date.now()) {
    nonceStore.delete(key)
    return false
  }
  
  // Check if the nonce matches
  const isValid = storedData.value === nonce
  
  // Remove the nonce to prevent replay attacks
  if (isValid) {
    nonceStore.delete(key)
  }
  
  return isValid
}
