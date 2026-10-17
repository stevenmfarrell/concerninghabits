import { Prisma, PrismaClient } from '@prisma/client'
import { stripColorEmojiMarks } from './emoji'

// Names come back without the marks that force color emoji (see ./emoji); the stored name keeps
// them. A query extension rather than a result one, since result extensions return proxies that
// can't be passed to Client Components.
const NAMED_MODELS = new Set(['User', 'Habit', 'Category', 'ApiKey'])

// Each model's relation fields, with the model each leads to, from Prisma's own description of the
// schema, so a result is followed only into related records (e.g. a membership's habit) and never
// into an entry's values or any other plain field that happens to hold a `name`
const RELATIONS = new Map(Prisma.dmmf.datamodel.models.map(model => [
  model.name,
  model.fields.filter(field => field.kind === 'object').map(field => [field.name, field.type] as const),
]))

// Cleans the names in a result of `model`: a record, a list of them, or anything else (a count),
// which is left alone
export function cleanNames(model: string, value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(item => cleanNames(model, item))
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (NAMED_MODELS.has(model) && typeof record.name === 'string') record.name = stripColorEmojiMarks(record.name)
    for (const [field, related] of RELATIONS.get(model) ?? []) {
      if (record[field] != null) cleanNames(related, record[field])
    }
  }
}

function createPrismaClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const result = await query(args)
          cleanNames(model, result)
          return result
        },
      },
    },
  })
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
