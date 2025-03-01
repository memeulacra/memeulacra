import { NextResponse } from 'next/server'
import db from '@/db/client'
import { verifySession } from '@/lib/session'
import { transaction } from '@/db/utils'

export const runtime = 'nodejs' // Force Node.js runtime

interface InteractionRequest {
  memeId: string;
  interactionType: 'like' | 'dislike';
}

export async function POST(req: Request) {
  try {
    // Verify authentication
    const authenticatedAddress = await verifySession()

    if (!authenticatedAddress) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const { memeId, interactionType }: InteractionRequest = await req.json()

    if (!memeId || !['like', 'dislike'].includes(interactionType)) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      )
    }

    // Get user ID from address
    const userResult = await db.query(
      'SELECT id FROM users WHERE address = $1',
      [authenticatedAddress]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userId = userResult.rows[0].id

    // Use transaction to ensure data consistency
    const result = await transaction(async (client) => {
      // Check if user has already interacted with this meme
      const existingInteraction = await client.query(
        'SELECT id, interaction_type FROM user_interactions WHERE user_id = $1 AND meme_id = $2',
        [userId, memeId]
      )

      // If user has already interacted, don't allow them to change their vote
      if (existingInteraction.rows.length > 0) {
        return {
          memeId,
          alreadyVoted: true,
          interactionType: existingInteraction.rows[0].interaction_type,
          message: 'You have already voted on this meme'
        }
      }

      // Insert the new interaction
      await client.query(
        'INSERT INTO user_interactions (user_id, meme_id, interaction_type) VALUES ($1, $2, $3)',
        [userId, memeId, interactionType]
      )

      // Update the meme counters based on the interaction type
      let updateQuery
      if (interactionType === 'like') {
        updateQuery = `
          UPDATE memes
          SET thumbs_up = thumbs_up + 1
          WHERE id = $1
          RETURNING id, thumbs_up, thumbs_down
        `
      } else {
        updateQuery = `
          UPDATE memes
          SET thumbs_down = thumbs_down + 1
          WHERE id = $1
          RETURNING id, thumbs_up, thumbs_down
        `
      }

      const updateResult = await client.query(updateQuery, [memeId])

      if (updateResult.rows.length === 0) {
        throw new Error('Meme not found')
      }

      return {
        memeId,
        thumbs_up: updateResult.rows[0].thumbs_up,
        thumbs_down: updateResult.rows[0].thumbs_down,
        interactionType,
        successful: true
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing meme interaction:', error)
    return NextResponse.json(
      {
        error: 'Failed to process interaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
