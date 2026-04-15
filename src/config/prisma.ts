import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 uses a driver adapter instead of reading DATABASE_URL automatically.
// We create a pg connection pool and pass it as the adapter.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

export default prisma

