import type { NpcChatErrorCode, NpcChatRequest } from '../src/game/npcChatTypes'
import type { DeepSeekConfig, DeepSeekConfigResult } from './npcChatConfig'
import { deepSeekHealth } from './npcChatConfig'
import { buildNpcChatMessages } from './npcChatMessages'
import { validateNpcChatRequest } from './npcChatValidation'
import { ProviderError, type NpcChatProvider } from './npcChatProvider'
import type { ConcurrencyGuard, RateLimiter } from './npcChatRateLimiter'

// Orchestrates a validated NPC chat into SSE token/done/error events, and adapts
// it to a Node request/response. Never leaks the key, raw provider body, headers,
// reasoning content or stack traces to the client (Feature 14 §6/§22/§24).

export type SseEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: { usage?: unknown } }
  | { event: 'error'; data: { code: NpcChatErrorCode } }

function mapProviderError(err: unknown): NpcChatErrorCode {
  if (err instanceof ProviderError) {
    if (err.kind === 'timeout') return 'provider_timeout'
    if (err.kind === 'http' && err.status === 429) return 'rate_limited'
    return 'provider_unavailable'
  }
  if ((err as { name?: string })?.name === 'AbortError') return 'provider_timeout'
  return 'provider_unavailable'
}

// The testable core: yields SSE-ready events for a validated request. A provider
// error becomes a single safe `error` event with a code — never a raw body.
export async function* streamNpcChatEvents(
  request: NpcChatRequest,
  deps: { provider: NpcChatProvider; config: DeepSeekConfig; signal?: AbortSignal },
): AsyncGenerator<SseEvent> {
  const messages = buildNpcChatMessages(request)
  try {
    for await (const ev of deps.provider({ config: deps.config, messages, signal: deps.signal })) {
      if (ev.type === 'token') yield { event: 'token', data: { text: ev.text } }
      else yield { event: 'done', data: { usage: ev.usage } }
    }
  } catch (err) {
    yield { event: 'error', data: { code: mapProviderError(err) } }
  }
}

// --- Node HTTP adapter -------------------------------------------------------

interface NodeReq {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
  on(event: string, cb: (chunk?: unknown) => void): void
}
interface NodeRes {
  statusCode: number
  setHeader(name: string, value: string): void
  write(chunk: string): void
  end(chunk?: string): void
}

export interface NpcChatHttpDeps {
  configResult: DeepSeekConfigResult
  provider: NpcChatProvider
  rateLimiter: RateLimiter
  concurrency: ConcurrencyGuard
  now: () => number
  requestTimeoutMs?: number
  log?: (entry: Record<string, unknown>) => void
}

const BODY_MAX_BYTES = 16 * 1024

function sessionKey(req: NodeReq): string {
  const header = req.headers['x-npc-session']
  if (typeof header === 'string' && header) return header.slice(0, 100)
  return req.socket?.remoteAddress || 'local'
}

function sendJson(res: NodeRes, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req: NodeReq): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk) => {
      const buf = chunk as Buffer
      size += buf.length
      if (size > BODY_MAX_BYTES) {
        resolve(null)
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

export function handleHealth(res: NodeRes, configResult: DeepSeekConfigResult): void {
  sendJson(res, 200, deepSeekHealth(configResult))
}

export async function handleNpcChat(req: NodeReq, res: NodeRes, deps: NpcChatHttpDeps): Promise<void> {
  const key = sessionKey(req)

  const bodyText = await readBody(req)
  if (bodyText === null) return sendJson(res, 413, { code: 'invalid_request' })
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    return sendJson(res, 400, { code: 'invalid_request' })
  }

  const validation = validateNpcChatRequest(parsed)
  if (!validation.ok) return sendJson(res, validation.code === 'npc_unavailable' ? 403 : 400, { code: validation.code })

  if (!deps.configResult.ok) return sendJson(res, 503, { code: 'not_configured' })
  if (!deps.rateLimiter.check(key, deps.now())) return sendJson(res, 429, { code: 'rate_limited' })
  if (!deps.concurrency.tryAcquire(key)) return sendJson(res, 429, { code: 'rate_limited' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), deps.requestTimeoutMs ?? 45_000)
  req.on('close', () => controller.abort())

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  const started = deps.now()
  let usageSeen: unknown
  try {
    for await (const ev of streamNpcChatEvents(validation.request, { provider: deps.provider, config: deps.configResult.config, signal: controller.signal })) {
      if (ev.event === 'done') usageSeen = ev.data.usage
      res.write(`event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`)
    }
  } finally {
    clearTimeout(timeout)
    deps.concurrency.release(key)
    res.end()
    deps.log?.({ npcId: validation.request.npcId, model: deps.configResult.config.model, latencyMs: deps.now() - started, usage: usageSeen ? true : false })
  }
}
