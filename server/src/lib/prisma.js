import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.ts'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL must be set before starting the server')
}

const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter })