import { PrismaClient } from '@prisma/client'
import { stripColorEmojiMarks } from './emoji'

// Names (on habits, categories and users, the only models with one) come back without the marks
// that force color emoji (see ./emoji); the stored name keeps them. A query extension rather than
// a result one, since result extensions return proxies that can't be passed to Client Components.
function cleanNames(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(cleanNames)
  } else if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>
    for (const key in record) {
      if (key === 'name' && typeof record[key] === 'string') record[key] = stripColorEmojiMarks(record[key])
      else cleanNames(record[key])
    }
  }
}

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args)
          cleanNames(result)
          return result
        },
      },
    },
  })
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
