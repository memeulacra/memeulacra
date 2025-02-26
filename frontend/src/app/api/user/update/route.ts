import { NextResponse } from 'next/server'
import db from '@/db/client'
import { verifySession } from '@/lib/session'

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    // Verify the user is authenticated
    const authenticatedAddress = await verifySession()

    if (!authenticatedAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get update data from request body
    const { username } = await req.json()

    // Build the update query dynamically
    const updates = []
    const values = [authenticatedAddress.toLowerCase()]
    let paramIndex = 2

    if (username !== undefined) {
      // Validate username
      if (username && (username.length < 3 || username.length > 50)) {
        return NextResponse.json(
          { error: 'Username must be between 3 and 50 characters' },
          { status: 400 }
        )
      }

      updates.push(`username = $${paramIndex}`)
      values.push(username)
      paramIndex++
    }

    // If nothing to update
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Always update updated_at timestamp
    updates.push('updated_at = NOW()')

    // Build and execute the query
    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE address = $1
      RETURNING id, username, npub, address, created_at, updated_at
    `

    const result = await db.query(query, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      {
        error: `Error updating user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
