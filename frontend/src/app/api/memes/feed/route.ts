import { NextResponse } from 'next/server'
import db from '@/db/client'
import { verifySession } from '@/lib/session'
import logger from '@/logger'

export const runtime = 'nodejs' // Force Node.js runtime

interface MemeWithAuthor {
  id: string;
  context: string;
  meme_cdn_url: string;
  created_at: string;
  thumbs_up: number;
  thumbs_down: number;
  template_id: string;
  author: {
    id: string;
    username: string;
    address: string;
  };
  user_interaction?: {
    interaction_type: string;
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const sort = searchParams.get('sort') || 'newest' // 'newest', 'popular', 'trending'
    const cursor = searchParams.get('cursor') || null // For cursor-based pagination

    // Check if user is authenticated (optional)
    const authenticatedAddress = await verifySession().catch(() => null)
    let authenticatedUserId = null

    if (authenticatedAddress) {
      // Get user ID from address
      const userResult = await db.query(
        'SELECT id FROM users WHERE address = $1',
        [authenticatedAddress]
      )

      if (userResult.rows.length > 0) {
        authenticatedUserId = userResult.rows[0].id
      }
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Build the query based on sort parameter
    let query = `
      SELECT
        m.id,
        m.context,
        m.meme_cdn_url,
        m.created_at,
        m.thumbs_up,
        m.thumbs_down,
        m.template_id,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'address', u.address
        ) as author
    `

    // Add user's interaction with meme if authenticated
    if (authenticatedUserId) {
      query += `,
        (
          SELECT json_build_object(
            'interaction_type', ui.interaction_type
          )
          FROM user_interactions ui
          WHERE ui.meme_id = m.id AND ui.user_id = $3
          LIMIT 1
        ) as user_interaction
      `
    }

    query += `
      FROM memes m
      JOIN users u ON m.user_id = u.id
    `

    // Build parameter array based on authentication status
    const params: (number | string)[] = [limit, offset]
    if (authenticatedUserId) {
      params.push(authenticatedUserId)
    }

    // Determine the next parameter index
    const paramIndex = params.length + 1

    // Where clause for cursor-based pagination
    if (cursor) {
      if (sort === 'newest') {
        query += `
          WHERE m.created_at < (SELECT created_at FROM memes WHERE id = $${paramIndex})
        `
        params.push(cursor)
      } else if (sort === 'popular') {
        query += `
          WHERE (
            (m.thumbs_up, m.id) < (
              SELECT thumbs_up, id FROM memes WHERE id = $${paramIndex}
            )
          )
        `
        params.push(cursor)
      } else if (sort === 'trending') {
        query += `
          WHERE (
            ((m.thumbs_up - m.thumbs_down) / EXTRACT(EPOCH FROM (NOW() - m.created_at)), m.id) < (
              SELECT (thumbs_up - thumbs_down) / EXTRACT(EPOCH FROM (NOW() - created_at)), id
              FROM memes
              WHERE id = $${paramIndex}
            )
          )
        `
        params.push(cursor)
      }
    }

    // Order by clause based on sort parameter
    if (sort === 'newest') {
      query += `
        ORDER BY m.created_at DESC
      `
    } else if (sort === 'popular') {
      query += `
        ORDER BY (m.thumbs_up) DESC, m.created_at DESC
      `
    } else if (sort === 'trending') {
      // A simple trending algorithm based on recent engagement
      query += `
        ORDER BY
          (m.thumbs_up - m.thumbs_down) / (EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400) DESC,
          m.created_at DESC
      `
    }

    // Limit and offset for pagination
    query += `
      LIMIT $1 OFFSET $2
    `
    logger.debug('Executing db query')
    // Execute the query
    const result = await db.query(query, params)

    // Get the next cursor
    let nextCursor = null
    if (result.rows.length === limit) {
      nextCursor = result.rows[result.rows.length - 1].id
    }

    // Return the memes with pagination info
    return NextResponse.json({
      memes: result.rows,
      pagination: {
        page,
        limit,
        total: result.rows.length,
        nextCursor,
        hasMore: result.rows.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching memes feed:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch memes feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
