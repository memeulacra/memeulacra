import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// In a real app, this would be an environment variable
const SECRET_KEY = process.env.SESSION_SECRET || 'your-secret-key-minimum-32-characters-long'
const encodedKey = new TextEncoder().encode(SECRET_KEY)

/**
 * Creates a new session for the user
 * 
 * @param address The Ethereum address of the authenticated user
 */
export async function createSession(address: string) {
  const expires = new Date(Date.now() + 7 * 86400 * 1000) // 7 days
  
  const session = await new SignJWT({ address })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
  const cook = await cookies()
  cook.set('session', session, {
    httpOnly: true,
    expires,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

/**
 * Verifies the current session
 * 
 * @returns The Ethereum address if session is valid, null otherwise
 */
export async function verifySession() {
  const cook = await cookies()
  const session = cook.get('session')?.value
  
  if (!session) return null
  
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    
    return payload.address as string
  } catch (error) {
    console.error('Invalid session:', error)
    return null
  }
}

/**
 * Destroys the current session
 */
export async function destroySession() {
  const cook = await cookies()
  cook.delete('session')
}