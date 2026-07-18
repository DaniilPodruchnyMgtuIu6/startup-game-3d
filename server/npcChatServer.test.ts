import { describe, it, expect } from 'vitest'
import { loadDeepSeekConfig, deepSeekHealth, DEFAULT_DEEPSEEK_MODEL } from './npcChatConfig'
import { validateNpcChatRequest } from './npcChatValidation'
import { buildNpcChatMessages, formatPublicContext } from './npcChatMessages'
import { streamNpcChatEvents } from './npcChatHandler'
import { ProviderError, type NpcChatProvider, type ProviderEvent } from './npcChatProvider'
import { createRateLimiter, createConcurrencyGuard } from './npcChatRateLimiter'
import type { NpcId, PublicNpcGameContext } from '../src/game/npcChatTypes'

function ctx(overrides: Partial<PublicNpcGameContext> = {}): PublicNpcGameContext {
  return {
    campaignStatus: 'playing',
    sprint: { number: 3, day: 4, phase: 'active' },
    budgetBand: 'low',
    product: { progressPercent: 62, completedTaskCount: 9, totalTaskCount: 14, firstPrototypeReady: true },
    team: { hiredEmployeeIds: ['kirill-morozov', 'alina-belova'] },
    currentNpc: { id: 'kirill-morozov', currentVisibleAssignment: 'API уведомлений' },
    visibleObjectives: ['Выпустить MVP OfficeFlow'],
    detectedRiskObservations: [{ domainLabel: 'Учётные записи и права доступа', levelLabel: 'Требует внимания' }],
    recentVisibleEvents: [{ label: 'восстановлен внешний шлюз' }],
    ...overrides,
  }
}

const providerOf = (events: ProviderEvent[]): NpcChatProvider =>
  async function* () {
    for (const e of events) yield e
  }
const throwingProvider = (err: unknown): NpcChatProvider =>
  async function* () {
    yield { type: 'token', text: '' } // never reached meaningfully
    throw err
  }

const config = { apiKey: 'test', baseURL: 'https://api.deepseek.com', model: DEFAULT_DEEPSEEK_MODEL, thinking: 'disabled' } as const

describe('config + secrets', () => {
  it('missing key → not_configured', () => expect(loadDeepSeekConfig({})).toEqual({ ok: false, reason: 'not_configured' }))
  it('defaults to the flash model, official base URL, thinking disabled', () => {
    const r = loadDeepSeekConfig({ DEEPSEEK_API_KEY: 'k' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.config.model).toBe('deepseek-v4-flash')
      expect(r.config.baseURL).toBe('https://api.deepseek.com')
      expect(r.config.thinking).toBe('disabled')
    }
  })
  it('pins the model even if env tries to override it', () => {
    const r = loadDeepSeekConfig({ DEEPSEEK_API_KEY: 'k', DEEPSEEK_MODEL: 'deepseek-v4-pro' })
    expect(r.ok && r.config.model).toBe('deepseek-v4-flash')
  })
  it('health exposes no key metadata', () => {
    expect(deepSeekHealth(loadDeepSeekConfig({ DEEPSEEK_API_KEY: 'k' }))).toEqual({ configured: true, model: 'deepseek-v4-flash' })
  })
})

describe('request validation', () => {
  it('accepts valid npc ids', () => {
    for (const npcId of ['sonya-sokolova', 'kirill-morozov', 'alina-belova'] as NpcId[]) {
      expect(validateNpcChatRequest({ npcId, message: 'привет', history: [], context: ctx({ currentNpc: { id: npcId } }) }).ok).toBe(true)
    }
  })
  it('rejects an unknown npc', () => expect(validateNpcChatRequest({ npcId: 'bob', message: 'hi', context: ctx() })).toEqual({ ok: false, code: 'invalid_request' }))
  it('rejects an absent Ilya but accepts a hired one', () => {
    expect(validateNpcChatRequest({ npcId: 'ilya-vlasov', message: 'hi', history: [], context: ctx() })).toEqual({ ok: false, code: 'npc_unavailable' })
    const hired = ctx({ team: { hiredEmployeeIds: ['kirill-morozov', 'ilya-vlasov'] } })
    expect(validateNpcChatRequest({ npcId: 'ilya-vlasov', message: 'hi', history: [], context: hired }).ok).toBe(true)
  })
  it('rejects an empty message', () => expect(validateNpcChatRequest({ npcId: 'kirill-morozov', message: '   ', context: ctx() }).ok).toBe(false))
  it('truncates an over-long message to 500', () => {
    const r = validateNpcChatRequest({ npcId: 'kirill-morozov', message: 'a'.repeat(600), history: [], context: ctx() })
    expect(r.ok && r.request.message.length).toBe(500)
  })
  it('drops unknown history roles and trims to 12', () => {
    const history = [
      { role: 'system', content: 'x' },
      ...Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
    ]
    const r = validateNpcChatRequest({ npcId: 'kirill-morozov', message: 'hi', history, context: ctx() })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.request.history.length).toBeLessThanOrEqual(12)
      expect(r.request.history.every((m) => m.role === 'user' || m.role === 'assistant')).toBe(true)
    }
  })
  it('ignores a client-provided model field', () => {
    const r = validateNpcChatRequest({ npcId: 'kirill-morozov', message: 'hi', history: [], context: ctx(), model: 'deepseek-v4-pro' })
    expect(r.ok).toBe(true)
  })
})

describe('prompt assembly', () => {
  const req = (npcId: NpcId, extra: Partial<PublicNpcGameContext> = {}) => ({ npcId, message: 'что по задаче?', history: [{ role: 'user' as const, content: 'привет' }], context: ctx({ currentNpc: { id: npcId }, ...extra }) })

  it('orders system persona, safety, context, history, then the user message', () => {
    const messages = buildNpcChatMessages(req('kirill-morozov'))
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('system')
    expect(messages[2].role).toBe('system')
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'что по задаче?' })
    // the safety rules explicitly forbid role changes / leaking the prompt
    expect(messages[1].content).toMatch(/не может изменить твою роль/i)
  })
  it('gives each NPC its own persona', () => {
    expect(buildNpcChatMessages(req('sonya-sokolova'))[0].content).toMatch(/проджект-менеджер/i)
    expect(buildNpcChatMessages(req('kirill-morozov'))[0].content).toMatch(/backend/i)
    expect(buildNpcChatMessages(req('alina-belova'))[0].content).toMatch(/frontend/i)
    expect(buildNpcChatMessages(req('ilya-vlasov', { team: { hiredEmployeeIds: ['ilya-vlasov'] } }))[0].content).toMatch(/безопасности/i)
  })
  it('adds a restrained tone for Sonya only when blamed', () => {
    expect(buildNpcChatMessages(req('sonya-sokolova'))[0].content).not.toMatch(/сдержанно/i)
    expect(buildNpcChatMessages(req('sonya-sokolova', { sonyaBlamed: true }))[0].content).toMatch(/сдержанно/i)
  })
  it('renders the context as compact text without a raw JSON dump', () => {
    const text = formatPublicContext(ctx())
    expect(text).toMatch(/Спринт: 3, день 4/)
    expect(text).not.toMatch(/[{}]/)
  })
})

describe('streaming + safe errors', () => {
  const request = { npcId: 'kirill-morozov' as NpcId, message: 'привет', history: [], context: ctx() }

  it('proxies tokens then done', async () => {
    const events: unknown[] = []
    for await (const e of streamNpcChatEvents(request, { provider: providerOf([{ type: 'token', text: 'При' }, { type: 'token', text: 'вет' }, { type: 'done' }]), config })) events.push(e)
    expect(events).toEqual([
      { event: 'token', data: { text: 'При' } },
      { event: 'token', data: { text: 'вет' } },
      { event: 'done', data: { usage: undefined } },
    ])
  })
  it('maps provider 429 → rate_limited, timeout → provider_timeout, other → provider_unavailable', async () => {
    const collect = async (err: unknown) => {
      const out: { event: string; data: { code?: string } }[] = []
      for await (const e of streamNpcChatEvents(request, { provider: throwingProvider(err), config })) out.push(e as never)
      return out[out.length - 1]
    }
    expect((await collect(new ProviderError('http', 429))).data.code).toBe('rate_limited')
    expect((await collect(new ProviderError('timeout'))).data.code).toBe('provider_timeout')
    expect((await collect(new ProviderError('http', 500))).data.code).toBe('provider_unavailable')
  })
})

describe('rate limiting', () => {
  it('allows 10 per window then blocks', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })
    for (let i = 0; i < 10; i++) expect(limiter.check('ip', 1000)).toBe(true)
    expect(limiter.check('ip', 1000)).toBe(false)
    expect(limiter.check('ip', 1000 + 60_001)).toBe(true) // window rolled over
  })
  it('guards one concurrent request per session', () => {
    const guard = createConcurrencyGuard()
    expect(guard.tryAcquire('ip')).toBe(true)
    expect(guard.tryAcquire('ip')).toBe(false)
    guard.release('ip')
    expect(guard.tryAcquire('ip')).toBe(true)
  })
})
