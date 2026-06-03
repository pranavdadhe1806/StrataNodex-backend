import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '../config/prisma'
import { env } from '../config/env'
import { AppError } from '../utils/AppError'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiOperation {
  op: string
  [key: string]: unknown
}

export interface AiResponse {
  operations: AiOperation[]
  confirmation: string | null
  followUpQuestion: string | null
  clarificationNeeded: string | null
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const DAILY_LIMIT = 20

function getTodayDateString(): string {
  // Use IST (UTC+5:30) for date boundaries
  const now = new Date()
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  return ist.toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function checkAndIncrementUsage(userId: string): Promise<{ used: number; limit: number }> {
  const date = getTodayDateString()

  const usage = await prisma.aiUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  })

  if (usage.count > DAILY_LIMIT) {
    throw new AppError(429, `Daily AI limit reached (${DAILY_LIMIT} requests). Resets at midnight IST.`)
  }

  return { used: usage.count, limit: DAILY_LIMIT }
}

// ─── Flat Summary Builder ─────────────────────────────────────────────────────

export async function buildFlatSummary(userId: string): Promise<string> {
  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: {
          nodes: {
            orderBy: { position: 'asc' },
            select: { id: true, title: true, parentId: true, status: true, priority: true },
          },
        },
      },
    },
  })

  const lines: string[] = []

  for (const folder of folders) {
    lines.push(`Folder: ${folder.name} (id: ${folder.id})`)
    for (const list of folder.lists) {
      lines.push(`  List: ${list.name} (id: ${list.id})`)

      // Build tree from flat nodes
      const nodeMap = new Map<string | null, typeof list.nodes>()
      for (const node of list.nodes) {
        const key = node.parentId ?? '__root__'
        if (!nodeMap.has(key)) nodeMap.set(key, [])
        nodeMap.get(key)!.push(node)
      }

      function renderNodes(parentId: string | null, indent: number) {
        const children = nodeMap.get(parentId ?? '__root__') || []
        for (const child of children) {
          const prefix = '  '.repeat(indent + 2)
          const label = indent === 0 ? 'Node' : 'SubNode'
          lines.push(`${prefix}${label}: ${child.title} (id: ${child.id}, status: ${child.status}, priority: ${child.priority})`)
          renderNodes(child.id, indent + 1)
        }
      }

      renderNodes(null, 0)
    }
  }

  return lines.join('\n')
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(flatSummary: string): string {
  // Current IST date/time
  const now = new Date()
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = days[ist.getUTCDay()]
  const dateStr = ist.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
  const timeStr = ist.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  })

  return `You are the StrataNodex AI assistant. You help users manage their tasks, folders, lists, and nodes through natural language instructions. You are precise, efficient, and never create things the user didn't ask for.

## DATA STRUCTURE

User → Folders → Lists → Nodes

- A **Folder** groups related lists (e.g. "GATE", "College").
- A **List** lives inside a folder (e.g. "Maths", "Discrete Mathematics").
- A **Node** is the core task/item unit. Nodes live inside lists.
- Nodes can nest infinitely via \`parentId\`. A child node (subnode) is just a Node with \`parentId\` set to another Node's ID.
- There is NO separate SubNode model — it's all the same Node model.

## VALID ENUM VALUES

- **status**: \`TODO\` | \`IN_PROGRESS\` | \`DONE\`
- **priority**: \`LOW\` | \`MEDIUM\` | \`HIGH\`

## NODE PROPERTIES

| Property   | Type              | Notes                                    |
|------------|-------------------|------------------------------------------|
| title      | string            | required                                 |
| status     | enum              | TODO, IN_PROGRESS, DONE                  |
| priority   | enum              | LOW, MEDIUM, HIGH                        |
| startAt    | ISO datetime      | nullable                                 |
| endAt      | ISO datetime      | nullable                                 |
| notes      | string            | nullable                                 |
| parentId   | node ID or null   | null = top-level node in the list        |
| listId     | list ID           | required                                 |
| position   | integer           | order among siblings (0-indexed)         |

## OPERATIONS YOU CAN EMIT

Each operation is a JSON object with an \`op\` field. Emit them in the \`operations\` array.

| op            | Required params                                    | Optional params                               |
|---------------|---------------------------------------------------|-----------------------------------------------|
| createFolder  | title                                             |                                               |
| createList    | title, folderId                                   |                                               |
| createNode    | title, listId                                     | parentId, status, priority, startAt, endAt, notes, position |
| updateNode    | nodeId                                            | title, status, priority, startAt, endAt, notes |
| deleteNode    | nodeId                                            |                                               |
| moveNode      | nodeId, newListId OR newParentId                  |                                               |
| createTag     | name                                              | listId (null = global)                        |
| assignTag     | nodeId, tagName                                   |                                               |

### PLACEHOLDER IDs

When creating multiple items in one response where a later operation depends on an earlier one (e.g. create a folder, then a list inside it), use placeholder IDs:

- Format: \`{{id_of_EXACT_TITLE}}\`
- Example: create folder "GATE" then list "Maths" inside it:
  \`\`\`json
  { "op": "createFolder", "title": "GATE" }
  { "op": "createList", "title": "Maths", "folderId": "{{id_of_GATE}}" }
  \`\`\`
- The title in the placeholder MUST exactly match the title used in the earlier create operation (case-sensitive).

## AMBIGUITY RULES

1. If a list name exists in multiple folders → STOP. Set \`clarificationNeeded\` asking which folder. Do NOT guess.
2. If a node title is ambiguous (exists in multiple lists or multiple times) → STOP. Ask for clarification.
3. If position is not specified → add at the end. Do NOT ask about position.
4. If a date is relative ("tomorrow", "next week", "end of next week", "EOD") → resolve it silently using today's date. Do NOT ask.
5. If the user says "EOD" → set time to 23:59:00 IST of today.
6. "End of next week" → next Sunday 23:59:00 IST.
7. Ask ONE clarifying question at a time, never multiple.

## BEHAVIOUR RULES

1. When the instruction is clear and unambiguous → execute immediately. Do NOT ask unnecessary questions.
2. After executing → provide a one-line confirmation of what was done.
3. After executing → set \`followUpQuestion\` ONLY if genuinely useful (e.g. "Want to add a start date too?"). Otherwise set it to null.
4. Never assume a node/list/folder exists — ALWAYS verify against the workspace summary below. If it doesn't exist, say so.
5. Never create nodes, lists, or folders the user didn't ask for.
6. When user says "mark as done" or "complete" → set status to DONE.
7. When user says "start" or "in progress" → set status to IN_PROGRESS.
8. When user says "high priority" or "urgent" → set priority to HIGH.

## OUTPUT FORMAT

You MUST always respond with this exact JSON structure. No markdown, no code fences, no explanation outside the JSON:

{
  "operations": [],
  "confirmation": "string or null",
  "followUpQuestion": "string or null",
  "clarificationNeeded": "string or null"
}

- \`operations\`: Array of operation objects. Empty if clarification is needed.
- \`confirmation\`: One-line summary of what was done (or will be done). null only if clarification is needed.
- \`followUpQuestion\`: Optional helpful follow-up. null if not needed.
- \`clarificationNeeded\`: If ambiguous, the question to ask. null otherwise. When set, operations MUST be empty.

## CURRENT CONTEXT

Today: ${dayName}, ${dateStr}
Current time: ${timeStr} IST

## USER'S WORKSPACE

${flatSummary || '(empty workspace — no folders, lists, or nodes yet)'}
`
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────

export async function callGemini(
  userId: string,
  userMessage: string,
  conversationHistory: AiMessage[],
): Promise<AiResponse & { usage: { used: number; limit: number } }> {

  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, 'AI assistant is not configured. Please set GEMINI_API_KEY.')
  }

  // 1. Check + increment rate limit
  const usage = await checkAndIncrementUsage(userId)

  // 2. Build context
  const flatSummary = await buildFlatSummary(userId)
  const systemPrompt = buildSystemPrompt(flatSummary)

  // 3. Build Gemini conversation
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
    systemInstruction: systemPrompt,
  })

  // Convert conversation history to Gemini format
  const geminiHistory = conversationHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: msg.content }],
  }))

  const chat = model.startChat({ history: geminiHistory })

  // 4. Send user message
  const result = await chat.sendMessage(userMessage)
  const responseText = result.response.text()

  // 5. Parse JSON response
  let parsed: AiResponse
  try {
    parsed = JSON.parse(responseText) as AiResponse
  } catch {
    throw new AppError(502, 'AI returned an invalid response. Please try again.')
  }

  // Validate structure
  if (!Array.isArray(parsed.operations)) {
    parsed.operations = []
  }
  if (typeof parsed.confirmation !== 'string' && parsed.confirmation !== null) {
    parsed.confirmation = null
  }
  if (typeof parsed.followUpQuestion !== 'string' && parsed.followUpQuestion !== null) {
    parsed.followUpQuestion = null
  }
  if (typeof parsed.clarificationNeeded !== 'string' && parsed.clarificationNeeded !== null) {
    parsed.clarificationNeeded = null
  }

  return { ...parsed, usage }
}
