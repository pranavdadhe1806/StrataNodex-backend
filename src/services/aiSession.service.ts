import prisma from '../config/prisma'

const MAX_SESSIONS = 20
const SLIDING_WINDOW = 20 // messages sent to Gemini

// ─── Create a new session ────────────────────────────────────────────────────

export async function createSession(userId: string, firstMessage: string) {
  const title = firstMessage.slice(0, 60)

  // Enforce max sessions — delete oldest if limit is hit
  const sessions = await prisma.aiSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (sessions.length >= MAX_SESSIONS) {
    await prisma.aiSession.delete({ where: { id: sessions[0].id } })
  }

  return prisma.aiSession.create({
    data: { userId, title },
  })
}

// ─── List sessions for a user ────────────────────────────────────────────────

export async function getUserSessions(userId: string) {
  return prisma.aiSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  })
}

// ─── Get one session with all messages ──────────────────────────────────────

export async function getSession(userId: string, sessionId: string) {
  return prisma.aiSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

// ─── Add a message to a session ─────────────────────────────────────────────

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
) {
  return prisma.aiChatMessage.create({
    data: { sessionId, role, content },
  })
}

// ─── Get sliding window of last N messages (for Gemini context) ─────────────

export async function getSlicedHistory(sessionId: string, limit = SLIDING_WINDOW) {
  const messages = await prisma.aiChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { role: true, content: true },
  })
  // Reverse to chronological order
  return messages.reverse() as { role: 'user' | 'assistant'; content: string }[]
}

// ─── Delete a session ────────────────────────────────────────────────────────

export async function deleteSession(userId: string, sessionId: string) {
  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId },
  })
  if (!session) return null
  return prisma.aiSession.delete({ where: { id: sessionId } })
}
