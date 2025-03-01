import db from './client'

/**
 * Finds a user by their Ethereum address or creates a new one if not found
 */
export async function findOrCreateUser(address: string) {
  // First, check if user exists
  const existingUser = await getUserByAddress(address)

  if (existingUser) {
    return existingUser
  }

  // If user doesn't exist, create a new one
  const username = `User_${address.slice(-8)}`
  const result = await db.query(
    `INSERT INTO users (username, address)
     VALUES ($1, $2)
     RETURNING *`,
    [username, address]
  )

  return result.rows[0]
}

/**
 * Gets a user by their Ethereum address
 */
export async function getUserByAddress(address: string) {
  const result = await db.query(
    'SELECT * FROM users WHERE address = $1',
    [address]
  )

  return result.rows[0] || null
}

/**
 * Updates a user's profile
 */
export async function updateUserProfile(address: string, userData: {
  username?: string
  npub?: string | null
  nsec?: string | null
}) {
  // Build the SET clause dynamically based on provided data
  const updates = []
  const values = [address]
  let paramIndex = 2

  if (userData.username !== undefined) {
    updates.push(`username = $${paramIndex}`)
    values.push(userData.username)
    paramIndex++
  }

  if (userData.npub !== undefined) {
    updates.push(`npub = $${paramIndex}`)
    values.push(userData.npub || '')
    paramIndex++
  }

  if (userData.nsec !== undefined) {
    updates.push(`nsec = $${paramIndex}`)
    values.push(userData.nsec || '')
    paramIndex++
  }

  // Always update the updated_at timestamp
  updates.push('updated_at = NOW()')

  if (updates.length === 1) {
    // If only the updated_at field is being updated, just return the current user
    return getUserByAddress(address)
  }

  const query = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE address = $1
    RETURNING *
  `

  const result = await db.query(query, values)
  return result.rows[0]
}

/**
 * Gets a user by their ID
 */
export async function getUserById(userId: string) {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  )

  return result.rows[0] || null
}
