import { describe, it, expect, beforeEach } from 'vitest'
import { useNpcConversationStore, trimNpcConversationHistory, normalizeNpcConversationState, type NpcConversationMessage } from './npcConversationStore'

const store = () => useNpcConversationStore.getState()
const msg = (i: number, role: 'user' | 'assistant' = 'user'): NpcConversationMessage => ({ id: `m${i}`, role, content: `text-${i}`, createdAt: i })

beforeEach(() => {
  window.localStorage.clear()
  store().resetNpcConversations()
})

describe('conversation store', () => {
  it('appends a message per NPC and keeps them separate', () => {
    store().appendMessage('kirill-morozov', msg(1))
    store().appendMessage('sonya-sokolova', msg(2))
    expect(store().conversations['kirill-morozov']).toHaveLength(1)
    expect(store().conversations['sonya-sokolova']?.[0].content).toBe('text-2')
  })
  it('caps at 12 messages, dropping the oldest', () => {
    for (let i = 0; i < 16; i++) store().appendMessage('kirill-morozov', msg(i))
    const conv = store().conversations['kirill-morozov']!
    expect(conv).toHaveLength(12)
    expect(conv[0].content).toBe('text-4')
  })
  it('clear removes only one NPC; reset removes all', () => {
    store().appendMessage('kirill-morozov', msg(1))
    store().appendMessage('sonya-sokolova', msg(2))
    store().clearConversation('kirill-morozov')
    expect(store().conversations['kirill-morozov']).toBeUndefined()
    expect(store().conversations['sonya-sokolova']).toHaveLength(1)
    store().resetNpcConversations()
    expect(store().conversations).toEqual({})
  })
  it('open/close tracks the active panel', () => {
    store().openChat('alina-belova')
    expect(store().activeNpcChat).toBe('alina-belova')
    store().closeChat()
    expect(store().activeNpcChat).toBeNull()
  })
})

describe('trimNpcConversationHistory', () => {
  it('keeps the newest 12', () => {
    const history = Array.from({ length: 15 }, (_, i) => msg(i))
    const trimmed = trimNpcConversationHistory(history)
    expect(trimmed).toHaveLength(12)
    expect(trimmed[0].content).toBe('text-3')
  })
})

describe('normalizeNpcConversationState', () => {
  it('non-object → empty', () => expect(normalizeNpcConversationState(null)).toEqual({ conversations: {} }))
  it('drops unknown NPCs, invalid roles, empty content; truncates and caps', () => {
    const n = normalizeNpcConversationState({
      conversations: {
        bob: [{ id: 'x', role: 'user', content: 'hi', createdAt: 1 }],
        'kirill-morozov': [
          { id: 'a', role: 'system', content: 'nope', createdAt: 1 },
          { id: 'b', role: 'user', content: '   ', createdAt: 2 },
          { id: 'c', role: 'user', content: 'valid', createdAt: 3 },
          { id: 'd', role: 'assistant', content: 'z'.repeat(5000), createdAt: 4 },
        ],
      },
    })
    expect(n.conversations['bob' as never]).toBeUndefined()
    const conv = n.conversations['kirill-morozov']!
    expect(conv.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(conv[1].content.length).toBe(1200)
  })
  it('drops a leading assistant message before the first user message', () => {
    const n = normalizeNpcConversationState({ conversations: { 'sonya-sokolova': [{ id: 'a', role: 'assistant', content: 'hi', createdAt: 1 }, { id: 'b', role: 'user', content: 'q', createdAt: 2 }] } })
    expect(n.conversations['sonya-sokolova']!.map((m) => m.role)).toEqual(['user'])
  })
})
