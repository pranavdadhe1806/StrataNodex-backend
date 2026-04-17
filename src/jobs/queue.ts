import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../config/env'

// Shared connection for Queue instances (non-blocking — safe to share)
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

connection.on('connect', () => console.log('[Redis] Queue connection established'))
connection.on('error', (err) => console.error('[Redis] Queue connection error:', err.message))

export const reminderQueue = new Queue('reminders', { connection })
export const rolloverQueue = new Queue('rollover', { connection })
