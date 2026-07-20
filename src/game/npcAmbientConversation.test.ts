import { describe, it, expect } from 'vitest'
import { pickNpcAmbientConversation, visibleLineFor, isOnceConversation, type NpcAmbientContext } from './npcAmbientConversation'

const base: NpcAmbientContext = {
  ilyaHired: false,
  overloadedDev: false,
  detectedHighRisk: false,
  serverRecoveryActive: false,
  readiness: 50,
  day: 3,
  sprintNumber: 2,
  playedIds: [],
}

describe('pickNpcAmbientConversation', () => {
  it('always returns a generic banter on an ordinary day (devs present)', () => {
    const c = pickNpcAmbientConversation(base)
    expect(c).not.toBeNull()
    expect([c!.mover, c!.host].sort()).not.toContain('ilya-vlasov') // Ilya not hired → never selected
  })

  it('is deterministic and rotates by day', () => {
    const a1 = pickNpcAmbientConversation({ ...base, day: 3 })
    const a2 = pickNpcAmbientConversation({ ...base, day: 3 })
    expect(a1!.id).toBe(a2!.id) // same inputs → same conversation
    const days = [2, 3, 4, 6, 7, 8].map((day) => pickNpcAmbientConversation({ ...base, day })!.id)
    expect(new Set(days).size).toBeGreaterThan(1) // different days can differ
  })

  it('fires the overload story beat when a dev is overloaded, above generic banter', () => {
    const c = pickNpcAmbientConversation({ ...base, overloadedDev: true })!
    expect(c.id).toBe('sonya-kirill-overload')
  })

  it('never involves Ilya until he is hired', () => {
    // high risk would trigger the Sonya↔Ilya beat, but only once Ilya exists
    expect(pickNpcAmbientConversation({ ...base, detectedHighRisk: true })!.id).not.toBe('sonya-ilya-risk')
    expect(pickNpcAmbientConversation({ ...base, detectedHighRisk: true, ilyaHired: true })!.id).toBe('sonya-ilya-risk')
  })

  it('prioritises server recovery over a detected risk when both are true', () => {
    const c = pickNpcAmbientConversation({ ...base, ilyaHired: true, detectedHighRisk: true, serverRecoveryActive: true })!
    expect(c.id).toBe('kirill-ilya-recovery')
  })

  it('does not repeat a story beat once it has fired (playedIds)', () => {
    const c = pickNpcAmbientConversation({ ...base, overloadedDev: true, playedIds: ['sonya-kirill-overload'] })!
    expect(c.id).not.toBe('sonya-kirill-overload') // falls back to generic banter
    expect(isOnceConversation('sonya-kirill-overload')).toBe(true)
    expect(isOnceConversation('kirill-alina-contract')).toBe(false)
  })

  it('picks readiness-appropriate banter', () => {
    // early readiness makes the "early screens" banter eligible; late makes the wrap-up one
    const early = [2, 3, 4, 6, 7, 8].map((day) => pickNpcAmbientConversation({ ...base, readiness: 20, day })!.id)
    expect(early).toContain('kirill-alina-early')
    const late = [2, 3, 4, 6, 7, 8].map((day) => pickNpcAmbientConversation({ ...base, readiness: 85, day })!.id)
    expect(late).toContain('kirill-alina-late')
  })
})

describe('visibleLineFor', () => {
  const conv = pickNpcAmbientConversation({ ...base, overloadedDev: true })! // sonya→kirill, 2 lines
  it('reveals each colleague’s latest line as the exchange advances', () => {
    expect(visibleLineFor(conv, -1, 'sonya-sokolova')).toBeNull() // nothing spoken yet
    expect(visibleLineFor(conv, 0, 'sonya-sokolova')).toBe(conv.lines[0].text)
    expect(visibleLineFor(conv, 0, 'kirill-morozov')).toBeNull() // Kirill hasn't spoken at index 0
    expect(visibleLineFor(conv, 1, 'kirill-morozov')).toBe(conv.lines[1].text)
  })
})
