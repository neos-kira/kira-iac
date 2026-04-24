import { BASE_URL, buildAuthHeaders } from '../progressApi'

export type ChatLogMessage = {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  contextPage?: string
}

/** AI会話ログを1件保存（失敗しても UI はブロックしない） */
export async function postChatLog(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  contextPage?: string,
  isCorrect?: boolean | null
): Promise<void> {
  if (!userId || !content) return
  try {
    await fetch(`${BASE_URL}/ai/chat-log`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ userId, role, content, contextPage, isCorrect }),
    })
  } catch (err) {
    console.error('[aiChatApi] postChatLog failed:', err)
  }
}

/** 会話履歴を取得（新しい順で返る → 呼び出し側で reverse して使う） */
export async function getChatLog(userId: string, limit = 50): Promise<ChatLogMessage[]> {
  if (!userId) return []
  try {
    const res = await fetch(
      `${BASE_URL}/ai/chat-log?userId=${encodeURIComponent(userId)}&limit=${limit}`,
      { headers: buildAuthHeaders(), credentials: 'omit' }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { messages?: ChatLogMessage[] }
    return data.messages ?? []
  } catch (err) {
    console.error('[aiChatApi] getChatLog failed:', err)
    return []
  }
}
