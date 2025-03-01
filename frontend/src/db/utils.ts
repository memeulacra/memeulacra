// File path: /db/utils.ts
import db from './client'

/**
 * Build a parameterized query for dynamic updates
 * @param table The table to update
 * @param whereField The field to use in the WHERE clause
 * @param whereValue The value to match in the WHERE clause
 * @param updates Object containing field:value pairs to update
 * @returns Object with query string and values array
 */
export function buildUpdateQuery(
  table: string,
  whereField: string,
  whereValue: string | number,
  updates: Record<string, any>
) {
  const setClauses = []
  const values = [whereValue]
  let paramIndex = 2

  // Build the SET clause dynamically
  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${field} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }

  // If there's nothing to update, return null
  if (setClauses.length === 0) {
    return null
  }

  // Always update the updated_at timestamp if the column exists
  setClauses.push('updated_at = NOW()')

  const query = `
    UPDATE ${table}
    SET ${setClauses.join(', ')}
    WHERE ${whereField} = $1
    RETURNING *
  `

  return { query, values }
}

/**
 * Run a transaction with multiple queries
 * @param callback Function that receives a client and runs queries
 * @returns Result of the transaction
 */
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await db.pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Sanitize input to prevent SQL injection
 * @param input The input string to sanitize
 * @returns Sanitized string
 */
export function sanitize(input: string): string {
  return input.replace(/[^\w\s.-]/gi, '')
}
