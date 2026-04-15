// Phase 2 — Daily Rollover Job
// TODO: Implement a scheduled job (e.g. via cron + BullMQ) that at end of each user's
// configured day-end time triggers score computation for all active users.
//
// import { Worker } from 'bullmq'
// import { env } from '../config/env'
// import { computeAndStoreDailyScore } from '../services/daily.service'
//
// const connection = { url: env.REDIS_URL }
//
// export const rolloverWorker = new Worker('rollover', async (job) => {
//   const { userId, date } = job.data
//   await computeAndStoreDailyScore(userId, date)
// }, { connection })

export {}
