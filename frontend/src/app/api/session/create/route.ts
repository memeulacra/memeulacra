import { NextResponse } from 'next/server'
import db from '@/db/client'
import { v4 as uuidv4 } from 'uuid' // Use UUID instead of nanoid

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    const { sessionId, address, expiresAt } = await req.json()

    if (!address || !expiresAt) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
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

    return NextResponse.json(
      { success: true, sessionId: uuid },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      {
        success: false,
        message: `Error creating session: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}
