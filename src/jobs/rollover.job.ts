import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../config/env'
import { computeAndStoreDailyScore } from '../services/score.service'

interface RolloverJobData {
  userId: string
  date: string
  listId?: string
}

// Workers MUST use their own connection — never share with Queue (blocking vs non-blocking)
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const rolloverWorker = new Worker<RolloverJobData>(
  'rollover',
  async (job) => {
    const { userId, date, listId } = job.data

    console.log(
      `[ROLLOVER] Computing score for user ${userId} on ${date}${listId ? ` (list: ${listId})` : ''}`,
    )

    try {
      const score = await computeAndStoreDailyScore(userId, date, listId)
      console.log(`[ROLLOVER] Stored — ${score.points} pts (${score.doneTasks}/${score.totalTasks} done) for user ${userId} on ${date}`)
    } catch (err: unknown) {
      // 409 = score already exists (immutable rule) — not a real failure, skip gracefully
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 409) {
        console.log(`[ROLLOVER] Score already exists for user ${userId} on ${date} — skipping`)
        return
      }
      throw err
    }
  },
  { connection },
)

rolloverWorker.on('completed', (job) => {
  console.log(`[ROLLOVER] Job ${job.id} completed`)
})

rolloverWorker.on('failed', (job, err) => {
  console.error(`[ROLLOVER] Job ${job?.id} failed:`, err.message)
})
