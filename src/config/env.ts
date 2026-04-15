import dotenv from 'dotenv'
dotenv.config()

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
}

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required')
