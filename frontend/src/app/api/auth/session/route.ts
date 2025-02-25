import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

export async function GET() {
  try {
    const address = await verifySession()

    return NextResponse.json({
      authenticated: Boolean(address),
      address: address || null
    })
  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json({
      authenticated: false,
      address: null
    })
  }
}
