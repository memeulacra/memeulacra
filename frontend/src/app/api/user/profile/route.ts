import { NextResponse } from 'next/server'
import db from '@/db/client'
import { verifySession } from '@/lib/session'

export const runtime = 'nodejs' // Force Node.js runtime

export async function GET(req: Request) {
  try {
    // Get the address from query params
    const url = new URL(req.url)
    const requestedAddress = url.searchParams.get('address')

    // Log the request for debugging
    console.log('Profile request for address:', requestedAddress)

    // Verify authentication
    const authenticatedAddress = await verifySession()
    console.log('Authenticated address:', authenticatedAddress)

    // If not authenticated or addresses don't match (case-insensitive comparison)
    if (!authenticatedAddress ||
        (requestedAddress && authenticatedAddress.toLowerCase() !== requestedAddress.toLowerCase())) {
      console.log('Authentication failed or addresses do not match')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use authenticated address if query param not provided
    const userAddress = requestedAddress || authenticatedAddress

    // Always use lowercase for database queries
    const normalizedAddress = userAddress.toLowerCase()
    console.log('Querying for normalized address:', normalizedAddress)

    // Get user data from database
    const result = await db.query(
      'SELECT id, username, npub, address, created_at, updated_at FROM users WHERE LOWER(address) = LOWER($1)',
      [normalizedAddress]
    )

    console.log('Query result rows:', result.rows.length)

    if (result.rows.length === 0) {
      console.log('No user found with address:', normalizedAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const user = result.rows[0]
    console.log('Found user:', user.id, user.username)

    // Hide sensitive data
    const safeUser = {
      id: user.id,
      username: user.username,
      npub: user.npub,
      address: user.address,
      created_at: user.created_at,
      updated_at: user.updated_at
    }

    return NextResponse.json(safeUser)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      {
        error: `Error fetching user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
