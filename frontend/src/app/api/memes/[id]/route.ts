'use server'
import { NextResponse } from 'next/server'
import db from '@/db/client'
import { verifySession } from '@/lib/session'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const memeId = params.id

    if (!memeId) {
      return NextResponse.json(
        { error: 'Meme ID is required' },
        { status: 400 }
      )
    }

    // Get the authenticated user if available
    const authenticatedAddress = await verifySession()
    let userId = null

    if (authenticatedAddress) {
      const userResult = await db.query(
        'SELECT id FROM users WHERE address = $1',
        [authenticatedAddress]
      )

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id
      }
    }

    // Get the meme details with author information
    const memeQuery = `
      SELECT
        m.*,
        u.username as author_username,
        u.address as author_address,
        u.id as author_id
      FROM
        memes m
      LEFT JOIN
        users u ON m.user_id = u.id
      WHERE
        m.id = $1
    `

    const memeResult = await db.query(memeQuery, [memeId])

    if (memeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Meme not found' },
        { status: 404 }
      )
    }

    const meme = memeResult.rows[0]

    // Get user interaction if authenticated
    let userInteraction = null
    if (userId) {
      const interactionResult = await db.query(
        'SELECT interaction_type FROM user_interactions WHERE user_id = $1 AND meme_id = $2',
        [userId, memeId]
      )

      if (interactionResult.rows.length > 0) {
        userInteraction = {
          interaction_type: interactionResult.rows[0].interaction_type
        }
      }
    }

    // Format the response
    const formattedMeme = {
      id: meme.id,
      meme_cdn_url: meme.meme_cdn_url,
      created_at: meme.created_at,
      thumbs_up: parseInt(meme.thumbs_up || '0'),
      thumbs_down: parseInt(meme.thumbs_down || '0'),
      template_id: meme.template_id,
      title: meme.title || '',
      author: {
        id: meme.author_id,
        username: meme.author_username,
        address: meme.author_address
      },
      user_interaction: userInteraction
    }

    return NextResponse.json({
      meme: formattedMeme,
      _meta: {
        isAuthenticated: !!authenticatedAddress
      }
    })
  } catch (error) {
    console.error('Error retrieving meme:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve meme',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
