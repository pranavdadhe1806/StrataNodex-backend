import cron from 'node-cron'
import prisma from '../config/prisma'
import bot from '../services/telegramBot'
import { sendDailyReminderEmail } from '../services/mailer'
import { formatDailyMessage } from '../services/notificationFormatter'

// Track which users already got a reminder this minute to avoid duplicates
const sentThisMinute = new Set<string>()
let lastMinuteKey = ''

cron.schedule('* * * * *', async () => {
  const now = new Date()
  const currentMinuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`

  // Clear set when minute changes
  if (currentMinuteKey !== lastMinuteKey) {
    sentThisMinute.clear()
    lastMinuteKey = currentMinuteKey
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { telegramEnabled: true, telegramChatId: { not: null } },
          { emailNotifEnabled: true },
        ],
      },
    })

    for (const user of users) {
      if (sentThisMinute.has(user.id)) continue

      try {
        // Convert current UTC time to user's timezone
        const userTime = new Intl.DateTimeFormat('en-GB', {
          timeZone: user.reminderTimezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now)

        if (userTime !== user.reminderTime) continue

        // Fetch folder > list > node tree for this user
        const folders = await prisma.folder.findMany({
          where: { userId: user.id },
          include: {
            lists: {
              include: {
                nodes: {
                  where: {
                    parentId: null,
                    status: { not: 'DONE' },
                  },
                  include: {
                    children: {
                      where: { status: { not: 'DONE' } },
                      include: {
                        children: {
                          where: { status: { not: 'DONE' } },
                          include: { children: { where: { status: { not: 'DONE' } } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        // Filter out folders/lists with no pending tasks
        const nonEmptyFolders = folders
          .map((f) => ({
            folderName: f.name,
            lists: f.lists
              .filter((l) => l.nodes.length > 0)
              .map((l) => ({
                listName: l.name,
                tasks: l.nodes,
              })),
          }))
          .filter((f) => f.lists.length > 0)

        const displayName = user.name || user.email.split('@')[0]!

        // Send Telegram
        if (user.telegramEnabled && user.telegramChatId && bot) {
          const telegramMsg = formatDailyMessage(displayName, nonEmptyFolders, 'telegram')
          await bot.sendMessage(user.telegramChatId, telegramMsg, { parse_mode: 'Markdown' })
        }

        // Send Email
        if (user.emailNotifEnabled) {
          const emailAddress = user.emailNotifAddress || user.email
          const emailMsg = formatDailyMessage(displayName, nonEmptyFolders, 'email')
          await sendDailyReminderEmail(emailAddress, displayName, emailMsg)
        }

        sentThisMinute.add(user.id)
        console.log(`[DailyNotification] Sent reminder for user ${user.id}`)
      } catch (err) {
        console.error(`[DailyNotification] Failed for user ${user.id}:`, err)
      }
    }
  } catch (err) {
    console.error('[DailyNotification] Cron error:', err)
  }
})

console.log('[DailyNotification] Cron job started (runs every minute)')
