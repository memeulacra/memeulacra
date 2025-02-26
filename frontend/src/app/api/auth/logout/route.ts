// File path: /app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

// This function can run in Edge runtime
export const runtime = 'edge'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long'
)

export async function POST() {
  try {
    // Get the cookie
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('auth_session')?.value

    if (sessionToken) {
      try {
        // Decode the JWT to get the session ID
        const { payload } = await jwtVerify(sessionToken, JWT_SECRET)
        const { sessionId } = payload as { sessionId: string }

        // Call the separate API route that runs in Node.js to delete the session
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/session/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        })
      } catch (error) {
        console.error('Error decoding token:', error)
      }
    }

    // Clear the cookie
    cookieStore.delete('auth_session')

    console.log('User logged out successfully')

    // Return a success response
    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)

    // Return an error response
    return NextResponse.json(
      {
        success: false,
        message: `Error during logout: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
