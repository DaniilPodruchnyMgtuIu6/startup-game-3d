import type { DeepSeekConfig } from './npcChatConfig'
import type { ChatMessage } from './npcChatMessages'

// The server → DeepSeek streaming call (Feature 14 §4). OpenAI-compatible
// chat/completions with stream:true, the flash model, thinking disabled, no
// tools / JSON mode / reasoning. Uses native fetch (no SDK dependency). The
// handler injects a provider, so tests use a mock and never make a paid call.

export type ProviderEvent = { type: 'token'; text: string } | { type: 'done'; usage?: unknown }

export interface ProviderStreamParams {
  config: DeepSeekConfig
  messages: ChatMessage[]
  signal?: AbortSignal
}

export type NpcChatProvider = (params: ProviderStreamParams) => AsyncIterable<ProviderEvent>

export class ProviderError extends Error {
  status?: number
  kind: 'timeout' | 'http' | 'network'
  constructor(kind: 'timeout' | 'http' | 'network', status?: number) {
    super(`provider ${kind}${status ? ' ' + status : ''}`)
    this.kind = kind
    this.status = status
  }
}

export const OUTPUT_MAX_TOKENS = 220

// Real DeepSeek provider using fetch + SSE parsing.
export function createDeepSeekProvider(): NpcChatProvider {
  return async function* deepSeek({ config, messages, signal }: ProviderStreamParams): AsyncIterable<ProviderEvent> {
    let response: Response
    try {
      response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          max_tokens: OUTPUT_MAX_TOKENS,
          temperature: 0.75,
          thinking: { type: 'disabled' },
        }),
        signal,
      })
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') throw new ProviderError('timeout')
      throw new ProviderError('network')
    }

    if (!response.ok || !response.body) {
      throw new ProviderError('http', response.status)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    // response.body is a web ReadableStream (async-iterable in Node 18+).
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        for (const line of rawEvent.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') {
            yield { type: 'done' }
            return
          }
          try {
            const parsed = JSON.parse(data)
            const text: string | undefined = parsed?.choices?.[0]?.delta?.content
            if (typeof text === 'string' && text.length > 0) yield { type: 'token', text }
          } catch {
            // ignore keep-alive / non-JSON lines
          }
        }
      }
    }
    yield { type: 'done' }
  }
}
