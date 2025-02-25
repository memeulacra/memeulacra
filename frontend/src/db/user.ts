import { cache } from 'react'
import prisma from './client'

/**
 * Finds a user by their Ethereum address or creates a new one if not found
 * This function is cached for the duration of a request
 */
export const findOrCreateUser = cache(async (address: string) => {
  return prisma.user.upsert({
    where: { address: address.toLowerCase() },
    create: {
      address: address.toLowerCase(),
      profile: {
        create: {
          nickname: `User_${address.substring(2, 8)}`,
          email: null,
          npub: null
        }
      }
    },
    update: {}, // No updates on existing user
    include: {
      profile: true
    }
  })
})

/**
 * Gets a user by their Ethereum address
 */
export async function getUserByAddress(address: string) {
  return prisma.user.findUnique({
    where: { address: address.toLowerCase() },
    include: {
      profile: true
    }
  })
}

/**
 * Updates a user's profile
 */
export async function updateUserProfile(address: string, profileData: {
  nickname?: string
  email?: string | null
  npub?: string | null
}) {
  return prisma.user.update({
    where: { address: address.toLowerCase() },
    data: {
      profile: {
        update: profileData
      }
    },
    include: {
      profile: true
    }
  })
}
