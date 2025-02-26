import { NextResponse } from 'next/server'
import db from '@/db/client'

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Missing session ID' },
        { status: 400 }
      )
    }

    // Delete the session from the database
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId])

    return NextResponse.json(
      { success: true, message: 'Session deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      {
        success: false,
        message: `Error deleting session: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
