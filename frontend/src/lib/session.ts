'use server'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import db from '@/db/client'
import { v4 as uuidv4 } from 'uuid'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long'
)

// Create a new session for a user
export async function createSession(address: string) {
  try {
    console.log('Creating session for address:', address)

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    console.log('Session expiration date set to:', expiresAt)

    const newSession = await _createSession({
      address,
      expiresAt: expiresAt.toISOString()
    })
    const sessionId = newSession.sessionId

    console.log('Session created in database with sessionId:', sessionId)

    // Create a JWT token with the session ID
    const token = await new SignJWT({ sessionId, address })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(JWT_SECRET)
    console.log('JWT token created:', token)

    // Set the cookie with the JWT token
    const cookie = await cookies()
    cookie.set({
      name: 'auth_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'strict'
    })
    console.log('Cookie set with JWT token')

    return { sessionId, token }
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

// Verify a session and return the wallet address
export async function verifySession() {
  try {
    console.log('Starting session verification process')

    // Get the session token from the cookie
    const cookie = await cookies()
    const token = cookie.get('auth_session')?.value
    console.log('Retrieved token from cookie:', token)

    if (!token) {
      console.log('No token found in cookie')
      return null
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const { sessionId, address } = payload as { sessionId: string; address: string }
    console.log('JWT token verified. Payload:', payload)

    // Check if the session exists and is valid by making an API request
    const sessionCheck = await _verifySession({ sessionId, address })
    console.log('Session verification result:', sessionCheck)
    return sessionCheck.valid ? address : null
  } catch (error) {
    console.error('Error verifying session:', error)
    return null
  }
}

// Delete a session
export async function deleteSession() {
  try {
    // Get the session ID from the cookie
    const cookie = await cookies()
    const token = cookie.get('auth_session')?.value

    if (token) {
      try {
        // Decode the JWT to get the session ID
        const { payload } = await jwtVerify(token, JWT_SECRET)
        const { sessionId } = payload as { sessionId: string }
        await _deleteSession({ sessionId })
      } catch (error) {
        console.error('Error decoding token or deleting session:', error)
      }
    }

    // Clear the cookie regardless of whether we found a session
    cookie.delete('auth_session')

    return true
  } catch (error) {
    console.error('Error deleting session:', error)
    throw error
  }
}

async function _createSession({ address, expiresAt }: { address: string, expiresAt: string }) {
  try {
    if (!address || !expiresAt) {
      throw new Error('Missing required fields')
    }

    // Generate a proper UUID for PostgreSQL
    const uuid = uuidv4()

    console.log(`Creating session with UUID: ${uuid} for address: ${address}`)

    // Store session in database
    await db.query(
      `INSERT INTO sessions (id, wallet_address, expires_at)
       VALUES ($1, $2, $3)`,
      [uuid, address, new Date(expiresAt)]
    )

    return { success: true, sessionId: uuid }
  } catch (error) {
    console.error('Error creating session:', error)
    throw new Error(`Error creating session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function _verifySession({ sessionId, address }: { sessionId: string, address: string }) {
  try {
    console.log('Parsed verify request body:', { sessionId, address })

    if (!sessionId || !address) {
      console.warn('Missing required fields:', { sessionId, address })
      throw new Error('Missing required fields')
    }

    // Check if the session exists and is valid in the database
    console.log('Checking session validity for sessionId:', sessionId)
    const result = await db.query(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    )
    console.log('Session query result:', result.rows)

    if (result.rows.length === 0) {
      console.warn('Session not found or expired for sessionId:', sessionId)
      throw new Error('Session not found or expired')
    }

    // Verify the user exists
    console.log('Verifying user existence for address:', address)
    const userResult = await db.query(
      'SELECT * FROM users WHERE address = $1',
      [address]
    )
    console.log('User query result:', userResult.rows)

    if (userResult.rows.length === 0) {
      console.warn('User not found for address:', address)
      throw new Error('User not found')
    }

    console.log('Session and user verification successful')
    return { success: true, valid: true }
  } catch (error) {
    console.error('Error verifying session:', error)
    throw new Error(`Error verifying session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function _deleteSession({ sessionId }: { sessionId: string }) {
  try {
    if (!sessionId) {
      throw new Error('Missing session ID')
    }

    // Delete the session from the database
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId])

    return { success: true, message: 'Session deleted successfully' }
  } catch (error) {
    console.error('Error deleting session:', error)
    throw new Error(`Error deleting session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
