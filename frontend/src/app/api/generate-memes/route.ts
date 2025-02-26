import { NextResponse } from 'next/server'
import db from '@/db/client'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs' // Force Node.js runtime

interface GenerateMemeRequest {
  context: string;
  numberOfOutputs: number;
  templateId?: string; // Optional template ID if user selects a specific template
  userId?: string; // Optional user ID if user is authenticated
}

export async function POST(req: Request) {
  try {
    const body: GenerateMemeRequest = await req.json()
    const { context, numberOfOutputs, templateId, userId } = body

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

    // Get user ID if not provided
    const actualUserId = userId || await getDefaultUserId()

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
          actualUserId
        ]
      )

      memeIds.push(newMemeId)
    }

    // Call the external meme generation API
    const memeApiUrl = process.env.MEME_API_URL || 'localhost:8000'
    const protocol = memeApiUrl.startsWith('http') ? '' : 'http://'

    const apiResponse = await fetch(`${protocol}${memeApiUrl}/generate-meme-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: context,
        uuids: memeIds,
      }),
      // Increase timeout as meme generation may take time
      signal: AbortSignal.timeout(500000), // 60 second timeout
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('Meme generation API error:', errorText)

      // Since there's no status field in the new schema, we'll delete the failed records
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
    console.log('generationResult', generationResult)

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
        [result.cdn_url, memeId] // Also need to use cdn_url instead of url
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
  } catch (error) {
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

// Helper function to get a default user ID
async function getDefaultUserId(): Promise<string> {
  try {
    // Get the first user from the database
    const userResult = await db.query(
      'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
    )

    if (userResult.rows.length > 0) {
      return userResult.rows[0].id
    }

    // If no users exist, create a system user
    const systemUserId = uuidv4()
    await db.query(
      `INSERT INTO users (id, address, username, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [systemUserId, '0x0000000000000000000000000000000000000000', 'system']
    )

    return systemUserId
  } catch (error) {
    console.error('Error getting default user ID:', error)
    throw error
  }
}

// For debugging purposes - implement a status check endpoint
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ids = searchParams.get('ids')?.split(',')

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: 'No meme IDs provided' },
        { status: 400 }
      )
    }

    const result = await db.query(
      `SELECT id, meme_cdn_url, created_at
       FROM memes
       WHERE id = ANY($1)`,
      [ids]
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
