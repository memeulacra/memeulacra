import { verifySignature } from '@/lib/auth/signature'
import { validateNonce } from '@/lib/auth/nonce'
import { findOrCreateUser } from '@/db/user'
import { createSession } from '@/lib/session'

export async function POST(req: Request) {
  try {
    const { address, signature, nonce } = await req.json()

    // Validate required fields
    if (!address || !signature || !nonce) {
      return new Response('Missing required fields', { status: 400 })
    }

    // Validate the nonce first (this also prevents replay attacks)
    if (!validateNonce(address, nonce)) {
      return new Response('Invalid or expired nonce', { status: 401 })
    }

    // Verify the signature
    const valid = await verifySignature(address, signature, nonce)
    if (!valid) {
      return new Response('Invalid signature', { status: 401 })
    }

    // Find or create user in the database
    const user = await findOrCreateUser(address)

    // Create a session
    await createSession(address)

    // Return the user data
    return Response.json(user)
  } catch (error) {
    console.error('Auth verification error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
