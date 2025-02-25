import { generateNonce } from '@/lib/auth/nonce'

export async function POST(req: Request) {
  try {
    const { address } = await req.json()

    if (!address) {
      return new Response('Address is required', { status: 400 })
    }

    const nonce = generateNonce(address)

    return Response.json({ nonce })
  } catch (error) {
    console.error('Error generating nonce:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
