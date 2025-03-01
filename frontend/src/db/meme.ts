// File path: /db/meme.ts
import db from './client'

/**
 * Gets a meme by its ID with author information
 */
export async function getMemeById(id: string) {
  const result = await db.query(
    `SELECT
      m.*,
      u.username as author_username,
      u.address as author_address
    FROM
      memes m
    LEFT JOIN
      users u ON m.user_id = u.id
    WHERE
      m.id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return null
  }

  const meme = result.rows[0]

  // Format the result to match the expected Meme interface
  return {
    id: meme.id,
    context: meme.context,
    meme_cdn_url: meme.meme_cdn_url,
    created_at: meme.created_at,
    thumbs_up: parseInt(meme.thumbs_up || '0'),
    thumbs_down: parseInt(meme.thumbs_down || '0'),
    template_id: meme.template_id,
    title: meme.title || '',
    author: {
      id: meme.user_id,
      username: meme.author_username,
      address: meme.author_address
    }
  }
}

/**
 * Gets meme interactions for a specific user
 */
export async function getUserMemeInteraction(memeId: string, userId: string) {
  const result = await db.query(
    `SELECT
      interaction_type
    FROM
      meme_interactions
    WHERE
      meme_id = $1 AND user_id = $2`,
    [memeId, userId]
  )

  return result.rows[0] || null
}

/**
 * Add or update a meme interaction (like/dislike)
 */
export async function addMemeInteraction(memeId: string, userId: string, interactionType: 'like' | 'dislike') {
  // First check if the user has already interacted with this meme
  const existingInteraction = await getUserMemeInteraction(memeId, userId)

  if (existingInteraction) {
    // If the interaction type is the same, return early
    if (existingInteraction.interaction_type === interactionType) {
      return {
        alreadyVoted: true,
        interactionType,
        ...(await updateMemeInteractionCounts(memeId))
      }
    }

    // Otherwise, update the existing interaction
    await db.query(
      `UPDATE meme_interactions
       SET interaction_type = $3, updated_at = NOW()
       WHERE meme_id = $1 AND user_id = $2`,
      [memeId, userId, interactionType]
    )
  } else {
    // Insert a new interaction
    await db.query(
      `INSERT INTO meme_interactions (meme_id, user_id, interaction_type)
       VALUES ($1, $2, $3)`,
      [memeId, userId, interactionType]
    )
  }

  // Update the count in the memes table and return the new counts
  return {
    alreadyVoted: false,
    interactionType,
    ...(await updateMemeInteractionCounts(memeId))
  }
}

/**
 * Helper function to update the thumbs_up and thumbs_down counts in the memes table
 */
async function updateMemeInteractionCounts(memeId: string) {
  // Count likes and dislikes
  const likesResult = await db.query(
    `SELECT COUNT(*) as count FROM meme_interactions
     WHERE meme_id = $1 AND interaction_type = 'like'`,
    [memeId]
  )

  const dislikesResult = await db.query(
    `SELECT COUNT(*) as count FROM meme_interactions
     WHERE meme_id = $1 AND interaction_type = 'dislike'`,
    [memeId]
  )

  const thumbs_up = parseInt(likesResult.rows[0].count)
  const thumbs_down = parseInt(dislikesResult.rows[0].count)

  // Update the meme with the new counts
  await db.query(
    `UPDATE memes
     SET thumbs_up = $2, thumbs_down = $3, updated_at = NOW()
     WHERE id = $1`,
    [memeId, thumbs_up, thumbs_down]
  )

  return { thumbs_up, thumbs_down }
}

// get m