import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long'
)

// Create a new session for a user
export async function createSession(address: string) {
  try {
    // Calculate expiration date (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Make API request to create session in database
    // We don't pass sessionId here - it will be generated on the server
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        expiresAt: expiresAt.toISOString()
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create session in database: ${error}`)
    }

    // Get the session ID generated on the server
    const data = await response.json()
    const sessionId = data.sessionId

    // Create a JWT token with the session ID
    const token = await new SignJWT({ sessionId, address })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(JWT_SECRET)

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

    return { sessionId, token }
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

// Verify a session and return the wallet address
export async function verifySession() {
  try {
    // Get the session token from the cookie
    const cookie = await cookies()
    const token = cookie.get('auth_session')?.value

    if (!token) {
      return null
    }

    // Verify the JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const { sessionId, address } = payload as { sessionId: string; address: string }

    // Check if the session exists and is valid by making an API request
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/session/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        address
      }),
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    return result.valid ? address : null
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

        // Make an API request to delete the session from the database
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/session/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        })
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
