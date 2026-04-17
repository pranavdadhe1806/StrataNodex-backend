import { Worker } from 'bullmq'
import Redis from 'ioredis'
import prisma from '../config/prisma'
import { env } from '../config/env'

interface ReminderJobData {
  nodeId: string
  userId: string
}

// Workers MUST use their own connection — never share with Queue (blocking vs non-blocking)
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const reminderWorker = new Worker<ReminderJobData>(
  'reminders',
  async (job) => {
    const { nodeId, userId } = job.data

    const node = await prisma.node.findFirst({
      where: { id: nodeId, list: { folder: { userId } } },
    })

    // Node was deleted or completed before reminder fired — skip silently
    if (!node || node.status === 'DONE') {
      console.log(
        `[REMINDER] Skipping job ${job.id} — node ${nodeId} is ${!node ? 'deleted' : 'already done'}`,
      )
      return
    }

    // Phase 5+: replace with real push notification / email / SMS
    console.log(`[REMINDER] Node "${node.title}" is due for user ${userId}`)
  },
  { connection },
)

reminderWorker.on('completed', (job) => {
  console.log(`[REMINDER] Job ${job.id} completed`)
})

reminderWorker.on('failed', (job, err) => {
  console.error(`[REMINDER] Job ${job?.id} failed:`, err.message)
})
