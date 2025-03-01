import client from './client'
/**
 * Gets user proportions for a specific meme and retrieves their addresses
 *
 * @param memeId - The UUID of the target meme
 * @returns Array of objects containing user_id, proportion, and address
 */
export async function getUserProportionsWithAddresses(memeId: string): Promise<{ user_id: string, proportion: bigint, address: `0x${string}` }[]> {
  // Step 1: Get user_id and proportion data from the complex query
  console.log(`[getUserProportionsWithAddresses] Starting query for memeId: ${memeId}`)
  console.time('sql-proportions-query')
  const proportionsResult = await client.query(`
    WITH
    -- 1. Get the target meme and validate it exists
    target_meme AS (
        SELECT
            id,
            COALESCE(pos_contributing_meme_ids, ARRAY[]::UUID[]) AS pos_ids,
            COALESCE(neg_contributing_meme_ids, ARRAY[]::UUID[]) AS neg_ids,
            created_at
        FROM memes
        WHERE id = $1
    ),

    -- 2. Combine all contributing meme IDs and calculate total
    contributing_memes AS (
        SELECT
            id,
            ARRAY_CAT(pos_ids, neg_ids) AS all_contributing_ids,
            ARRAY_LENGTH(ARRAY_CAT(pos_ids, neg_ids), 1) AS total_count,
            created_at
        FROM target_meme
        WHERE id IS NOT NULL  -- Ensures meme exists
    ),

    -- 3. Primary calculation: User interactions count before target meme creation
    primary_user_interactions AS (
        SELECT
            ui.user_id,
            COUNT(DISTINCT ui.meme_id) AS interaction_count,
            cm.total_count,
            ROUND((COUNT(DISTINCT ui.meme_id)::float / cm.total_count::float)::numeric, 10) AS proportion
        FROM user_interactions ui
        JOIN contributing_memes cm ON ui.meme_id = ANY(cm.all_contributing_ids)
        WHERE ui.created_at < cm.created_at AND cm.total_count > 0
        GROUP BY ui.user_id, cm.total_count
    ),

    -- 4. Fallback calculation: Count all interactions regardless of timing
    fallback_user_interactions AS (
        SELECT
            ui.user_id,
            u.username,
            COUNT(DISTINCT ui.meme_id) AS interaction_count,
            cm.total_count,
            ROUND((COUNT(DISTINCT ui.meme_id)::float / cm.total_count::float)::numeric, 10) AS proportion
        FROM user_interactions ui
        JOIN users u ON ui.user_id = u.id
        CROSS JOIN contributing_memes cm
        WHERE ui.meme_id = ANY(cm.all_contributing_ids) AND cm.total_count > 0
        GROUP BY ui.user_id, u.username, cm.total_count
    ),

    -- 5. Determine if we need to use primary or fallback results
    results_check AS (
        SELECT EXISTS (SELECT 1 FROM primary_user_interactions) AS has_primary_results,
               EXISTS (SELECT 1 FROM contributing_memes WHERE total_count > 0) AS has_contributing_memes
    ),

    -- 6. Final results selection with fallback logic
    final_results AS (
        SELECT
            CASE
                WHEN rc.has_primary_results THEN pui.user_id::text
                ELSE fui.user_id::text
            END AS user_id,
            CASE
                WHEN rc.has_primary_results THEN pui.proportion
                ELSE fui.proportion
            END AS proportion
        FROM results_check rc
        LEFT JOIN primary_user_interactions pui ON rc.has_primary_results
        LEFT JOIN fallback_user_interactions fui ON NOT rc.has_primary_results AND rc.has_contributing_memes
        WHERE (rc.has_primary_results AND pui.user_id IS NOT NULL) OR
              (NOT rc.has_primary_results AND rc.has_contributing_memes AND fui.user_id IS NOT NULL)
    )

    -- Return the final results
    SELECT user_id, proportion
    FROM final_results
    ORDER BY proportion DESC
    LIMIT 100
  `, [memeId])
  console.timeEnd('sql-proportions-query')
  console.log(`[getUserProportionsWithAddresses] Found ${proportionsResult.rows.length} user proportions`, JSON.stringify(proportionsResult))

  // If no results, return empty array
  if (proportionsResult.rows.length === 0) {
    console.log('[getUserProportionsWithAddresses] No results found, returning empty array')
    return []
  }

  // Step 2: Get the addresses for these users
  // Extract user IDs
  const userIds = proportionsResult.rows.map(row => row.user_id)
  console.log(`[getUserProportionsWithAddresses] Extracting addresses for ${userIds.length} users`)

  // Get the addresses
  console.time('sql-addresses-query')
  const addressesResult = await client.query(
    'SELECT id, address FROM users WHERE id = ANY($1)',
    [userIds]
  )
  console.timeEnd('sql-addresses-query')
  console.log(`[getUserProportionsWithAddresses] Found ${addressesResult.rows.length} user addresses`)

  // Create a lookup map for fast address retrieval
  const addressMap = new Map()
  addressesResult.rows.forEach(user => {
    addressMap.set(user.id, user.address)
  })
  console.log(`[getUserProportionsWithAddresses] Created address lookup map with ${addressMap.size} entries`)

  // Combine the data
  console.time('combine-results')
  let contributors = proportionsResult.rows.map(row => {
    const address = addressMap.get(row.user_id) || null
    if (!address) {
      console.warn(`[getUserProportionsWithAddresses] No address found for user ${row.user_id}`)
    }
    return {
      user_id: row.user_id,
      proportion: parseFloat(row.proportion),
      address: address
    }
  })
  console.timeEnd('combine-results')
  console.log(`[getUserProportionsWithAddresses] Combined data for ${contributors.length} contributors`)

  // Normalization step
  if (contributors.length > 0) {
    // Calculate the sum of all proportions
    const totalProportion = contributors.reduce((sum, contributor) => sum + contributor.proportion, 0)

    // Target sum is 95% (0.95)
    const targetSum = 0.95

    // Normalize each proportion to the target sum
    contributors = contributors.map(contributor => ({
      ...contributor,
      original_proportion: contributor.proportion,
      proportion: Math.min(10, (contributor.proportion / totalProportion) * targetSum * 100)
    }))

    // Log before normalization
    console.log('Before normalization:')
    console.log(`Total proportion: ${totalProportion.toFixed(10)}`)
    console.log('Individual proportions:')
    contributors.forEach(contributor => {
      //@ts-expect-error some debug code
      console.log(`  User ${contributor.user_id}: ${contributor.original_proportion.toFixed(10)}`)
    })

    console.log('\nAfter normalization:')

    contributors.forEach(contributor => {
      //@ts-expect-error some debug code
      console.log(`  User ${contributor.user_id}: ${contributor.original_proportion.toFixed(10)} → ${contributor.proportion.toFixed(10)}`)
    })

    // Calculate the actual final sum to check for floating-point discrepancies
    const finalSum = contributors.reduce((sum, contributor) => sum + contributor.proportion, 0)
    console.log(`Final sum after normalization: ${finalSum.toFixed(10)} (target was ${targetSum.toFixed(10)}, difference: ${(finalSum - targetSum).toFixed(10)})`)
  }

  // Convert proportions to bigint before returning
  // We'll multiply by 10^18 to preserve precision when converting from float to bigint
  return contributors.map(contributor => ({
    user_id: contributor.user_id,
    proportion: BigInt(Math.round(contributor.proportion)) as bigint,
    address: contributor.address as `0x${string}`
  }))
}
