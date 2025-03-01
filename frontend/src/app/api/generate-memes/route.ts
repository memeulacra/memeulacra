import { NextResponse } from 'next/server'
import db from '@/db/client'
import { v4 as uuidv4 } from 'uuid'
import { verifySession } from '@/lib/session'
import { getUserByAddress } from '@/db/user'

export const runtime = 'nodejs' // Force Node.js runtime

interface GenerateMemeRequest {
  context: string;
  numberOfOutputs: number;
  templateId?: string; // Optional template ID if user selects a specific template
}

export async function POST(req: Request) {
  try {
    // Verify user authentication first
    const walletAddress = await verifySession()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to generate memes.' },
        { status: 401 }
      )
    }

    // Get user from database based on authenticated wallet address
    const user = await getUserByAddress(walletAddress)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please try logging in again.' },
        { status: 404 }
      )
    }

    // Extract request data
    const body: GenerateMemeRequest = await req.json()
    const { context, numberOfOutputs, templateId } = body

    if (!context || !numberOfOutputs || numberOfOutputs < 1 || numberOfOutputs > 4) {
      return NextResponse.json(
        { error: 'Invalid request. Context and numberOfOutputs (1-4) are required.' },
        { status: 400 }
      )
    }

    // Get default template if not specified
    let memeTemplateId = templateId
    if (!memeTemplateId) {
      const templateResult = await db.query(
        'SELECT id FROM meme_templates ORDER BY created_at DESC LIMIT 1'
      )

      if (templateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'No meme templates found in the database.' },
          { status: 500 }
        )
      }

      memeTemplateId = templateResult.rows[0].id
    }

    // Create placeholder meme records
    const memeIds = []

    // User ID comes from the authenticated user
    const userId = user.id

    // Create multiple meme records based on numberOfOutputs
    for (let i = 0; i < numberOfOutputs; i++) {
      const newMemeId = uuidv4()

      await db.query(
        `INSERT INTO memes (
          id, context, template_id, meme_cdn_url, user_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          newMemeId,
          context,
          memeTemplateId,
          '', // Empty URL initially
          userId
        ]
      )

      memeIds.push(newMemeId)
    }

    // Call the external meme generation API
    const memeApiUrl = process.env.MEME_API_URL || 'localhost:8000'
    const protocol = memeApiUrl.startsWith('http') ? '' : 'http://'

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 500000) // 60 second timeout

    try {
      const apiResponse = await fetch(`${protocol}${memeApiUrl}/generate-meme-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: context,
          uuids: memeIds,
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        console.error('Meme generation API error:', errorText)

        // Delete the failed records
        await db.query(
          `DELETE FROM memes
           WHERE id = ANY($1)`,
          [memeIds]
        )

        return NextResponse.json(
          { error: 'Failed to generate memes', details: errorText },
          { status: 500 }
        )
      }

      const generationResult = await apiResponse.json()

      // Update meme records with the generated URLs
      const updatedMemes = []

      for (let i = 0; i < generationResult.memes.length; i++) {
        const result = generationResult.memes[i]
        const memeId = memeIds[i]

        const updateResult = await db.query(
          `UPDATE memes
           SET meme_cdn_url = $1
           WHERE id = $2
           RETURNING id, meme_cdn_url`,
          [result.cdn_url, memeId]
        )

        if (updateResult.rows.length > 0) {
          updatedMemes.push({
            id: updateResult.rows[0].id,
            url: updateResult.rows[0].meme_cdn_url,
          })
        }
      }

      return NextResponse.json({
        success: true,
        memes: updatedMemes,
      })
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Delete the records if the request timed out
        await db.query(
          `DELETE FROM memes
           WHERE id = ANY($1)`,
          [memeIds]
        )

        return NextResponse.json(
          { error: 'Meme generation timed out. Please try again.' },
          { status: 504 }
        )
      }
      throw error // Re-throw for the outer catch block
    }
  } catch (error: any) {
    console.error('Error generating memes:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate memes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// For debugging purposes - implement a status check endpoint
export async function GET(req: Request) {
  try {
    // Verify user authentication first
    const walletAddress = await verifySession()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access meme status.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const ids = searchParams.get('ids')?.split(',')

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'No meme IDs provided' },
        { status: 400 }
      )
    }

    // Get user from database based on authenticated wallet address
    const user = await getUserByAddress(walletAddress)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please try logging in again.' },
        { status: 404 }
      )
    }

    // Only retrieve memes owned by the authenticated user
    const result = await db.query(
      `SELECT id, meme_cdn_url, created_at
       FROM memes
       WHERE id = ANY($1) AND user_id = $2`,
      [ids, user.id]
    )

    return NextResponse.json({ memes: result.rows })
  } catch (error) {
    console.error('Error checking meme status:', error)
    return NextResponse.json(
      { error: 'Failed to check meme status' },
      { status: 500 }
    )
  }
}
