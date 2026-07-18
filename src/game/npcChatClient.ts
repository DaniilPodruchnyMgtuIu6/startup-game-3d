import type { NpcChatErrorCode, NpcChatRequest } from './npcChatTypes'

// Client → own /api/npc-chat proxy (never DeepSeek directly). Streams SSE token
// events into onToken; supports AbortController for Stop/Close. Returns a status
// so the panel can save the final reply, drop an aborted partial, or fall back.

export type SendNpcChatResult = { status: 'ok' } | { status: 'error'; code: NpcChatErrorCode } | { status: 'aborted' }

function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === 'AbortError'
}

export async function sendNpcChat(
  request: NpcChatRequest,
  opts: { onToken: (text: string) => void; signal: AbortSignal },
): Promise<SendNpcChatResult> {
  let response: Response
  try {
    response = await fetch('/api/npc-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: opts.signal,
    })
  } catch (err) {
    return isAbort(err) ? { status: 'aborted' } : { status: 'error', code: 'provider_unavailable' }
  }

  if (!response.ok || !response.body) {
    let code: NpcChatErrorCode = 'provider_unavailable'
    try {
      const j = (await response.json()) as { code?: NpcChatErrorCode }
      if (j?.code) code = j.code
    } catch {
      /* ignore */
    }
    return { status: 'error', code }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let errorCode: NpcChatErrorCode | null = null
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        let eventName = 'message'
        let dataStr = ''
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
        }
        if (!dataStr) continue
        let data: { text?: string; code?: NpcChatErrorCode }
        try {
          data = JSON.parse(dataStr)
        } catch {
          continue
        }
        if (eventName === 'token' && typeof data.text === 'string') opts.onToken(data.text)
        else if (eventName === 'error' && data.code) errorCode = data.code
      }
    }
  } catch (err) {
    return isAbort(err) ? { status: 'aborted' } : { status: 'error', code: 'provider_unavailable' }
  }

  return errorCode ? { status: 'error', code: errorCode } : { status: 'ok' }
}
