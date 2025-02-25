import { PrismaClient } from '@prisma/client'

// Declare the global namespace with the prisma property
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Use existing prisma client if it exists in global scope (for hot reloading in dev)
// or create a new one
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Assign to global object in non-production environments to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export default prisma