import { NextResponse } from 'next/server'
import { verifySignature } from '@/lib/auth/signature'
import { validateNonce } from '@/lib/auth/nonce'
import { findOrCreateUser } from '@/db/user'
import { createSession } from '@/lib/session'

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    const { address, signature, nonce } = await req.json()

    console.log('Verifying authentication for:', {
      address,
      nonce,
      signatureLength: signature?.length
    })

    // Validate required fields
    if (!address || !signature || !nonce) {
      console.error('Missing required fields:', {
        address: !!address,
        signature: !!signature,
        nonce: !!nonce
      })
      return new Response('Missing required fields', { status: 400 })
    }

    // Validate the nonce first (this also prevents replay attacks)
    console.log(`Validating nonce: ${nonce.substring(0, 10)}...`)
    if (!validateNonce(address, nonce)) {
      console.error('Invalid or expired nonce')
      return new Response('Invalid or expired nonce', { status: 401 })
    }

    // Verify the signature
    console.log('Verifying signature...')
    const valid = await verifySignature(address, signature, nonce)
    if (!valid) {
      console.error('Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    console.log('Signature verified successfully')

    // Find or create user in the database
    const user = await findOrCreateUser(address)
    console.log('User record:', user)

    // Create a session
    const session = await createSession(address)
    console.log('Session created:', session.sessionId)

    // Return the user data
    return NextResponse.json(user)
  } catch (error) {
    console.error('Auth verification error:', error)
    return new Response(`Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      status: 500
    })
  }
}
