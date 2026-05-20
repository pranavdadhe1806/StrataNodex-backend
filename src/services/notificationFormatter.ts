interface TaskNode {
  title: string
  status: string
  children?: TaskNode[]
}

interface ListGroup {
  listName: string
  tasks: TaskNode[]
}

interface FolderGroup {
  folderName: string
  lists: ListGroup[]
}

export function formatDailyMessage(
  username: string,
  folders: FolderGroup[],
  platform: 'telegram' | 'email'
): string {
  const greetings = [
    `Good morning, ${username}! ☀️ Here's what's on your plate today.`,
    `Rise and shine, ${username}! 🌅 Your tasks are ready.`,
    `Hey ${username}! 🚀 Let's make today count.`,
    `Morning, ${username}! 🔥 You've got this.`,
  ]
  const greeting = greetings[Math.floor(Math.random() * greetings.length)]

  if (folders.length === 0) {
    return `${greeting}\n\nNo tasks due today. Enjoy your day! 🎉`
  }

  let message = `${greeting}\n\n`

  for (const folder of folders) {
    if (platform === 'telegram') {
      message += `📁 *${folder.folderName}*\n`
    } else {
      message += `📁 ${folder.folderName}\n`
    }

    for (const list of folder.lists) {
      message += `  📋 ${list.listName}:\n`
      message += formatNodes(list.tasks, 2)
    }
    message += '\n'
  }

  return message.trim()
}

function formatNodes(nodes: TaskNode[], depth: number): string {
  let result = ''
  const indent = ' '.repeat(depth * 2)
  const bullet = depth === 2 ? '•' : '◦'

  for (const node of nodes) {
    if (node.status === 'DONE') continue
    result += `${indent}${bullet} ${node.title}\n`
    if (node.children && node.children.length > 0) {
      result += formatNodes(node.children, depth + 1)
    }
  }
  return result
}
