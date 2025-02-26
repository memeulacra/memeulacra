import { NextResponse } from 'next/server'
import db from '@/db/client'

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    const { sessionId, address } = await req.json()

    if (!sessionId || !address) {
      return NextResponse.json(
        { success: false, valid: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if the session exists and is valid in the database
    const result = await db.query(
      'SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()',
      [sessionId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: true, valid: false, message: 'Session not found or expired' },
        { status: 200 }
      )
    }

    // Verify the user exists
    const userResult = await db.query(
      'SELECT * FROM users WHERE address = $1',
      [address]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: true, valid: false, message: 'User not found' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, valid: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error verifying session:', error)
    return NextResponse.json(
      {
        success: false,
        valid: false,
        message: `Error verifying session: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
