import { NextResponse } from 'next/server'
import { generateNonce } from '@/lib/auth/nonce'

export const runtime = 'nodejs' // Force Node.js runtime

export async function POST(req: Request) {
  try {
    const { address } = await req.json()

    if (!address) {
      return new Response('Address is required', { status: 400 })
    }

    console.log(`Generating nonce for address: ${address}`)
    const nonce = generateNonce(address)
    console.log(`Generated nonce: ${nonce.substring(0, 10)}...`)

    return NextResponse.json({ nonce })
  } catch (error) {
    console.error('Error generating nonce:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
