import TelegramBot from 'node-telegram-bot-api'
import prisma from '../config/prisma'

// Only initialize if token is available (avoids crash in dev without token)
const token = process.env.TELEGRAM_BOT_TOKEN
const bot = token ? new TelegramBot(token, { polling: true }) : null

if (bot) {
  // Handle /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      `Welcome to StrataNodex Bot! 🚀\n\nTo link your account:\n1. Go to StrataNodex Settings → Notifications\n2. Enable Telegram and click "Generate Code"\n3. Send the code here as: /link YOUR_CODE`
    )
  })

  // Handle /link CODE command
  bot.onText(/\/link (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const code = match![1]!.trim().toUpperCase()

    try {
      const user = await prisma.user.findFirst({
        where: {
          telegramLinkCode: code,
          telegramChatId: null,
          telegramLinkExpiry: { gt: new Date() },
        },
      })

      if (!user) {
        bot.sendMessage(chatId, '❌ Invalid or expired code. Go back to Settings and generate a new one.')
        return
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: chatId.toString(),
          telegramLinkCode: null,
          telegramLinkExpiry: null,
          telegramEnabled: true,
        },
      })

      bot.sendMessage(chatId, '✅ Telegram linked successfully! You will receive daily task reminders at your configured time.')
    } catch (err) {
      console.error('[TelegramBot] Error linking account:', err)
      bot.sendMessage(chatId, '❌ Something went wrong. Please try again.')
    }
  })

  console.log('[TelegramBot] Bot started with polling')
}

export default bot
