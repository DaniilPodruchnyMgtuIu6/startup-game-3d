import { describe, it, expect, beforeEach } from 'vitest'
import { useNpcAmbientStore, loadAmbient } from './npcAmbientStore'
import type { NpcAmbientConversation } from './npcAmbientConversation'

const storyConv: NpcAmbientConversation = {
  id: 'sonya-kirill-overload', // a once-per-campaign story beat
  mover: 'sonya-sokolova',
  host: 'kirill-morozov',
  hudSummary: 'x',
  lines: [{ speaker: 'sonya-sokolova', text: 'a' }],
}
const genericConv: NpcAmbientConversation = {
  id: 'kirill-alina-contract', // repeatable banter
  mover: 'alina-belova',
  host: 'kirill-morozov',
  hudSummary: 'x',
  lines: [{ speaker: 'alina-belova', text: 'a' }],
}

describe('npcAmbientStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useNpcAmbientStore.getState().reset()
  })

  it('begin marks the day and (for a story beat) remembers it, persisted for reload', () => {
    useNpcAmbientStore.getState().begin(storyConv, '2:3')
    expect(useNpcAmbientStore.getState().active?.conversation.id).toBe('sonya-kirill-overload')
    expect(useNpcAmbientStore.getState().playedDayKey).toBe('2:3')
    expect(useNpcAmbientStore.getState().playedIds).toContain('sonya-kirill-overload')
    // a reload reads the same memory back — the story beat will not replay
    const reloaded = loadAmbient(window.localStorage, '')
    expect(reloaded.playedDayKey).toBe('2:3')
    expect(reloaded.playedIds).toContain('sonya-kirill-overload')
  })

  it('generic banter is not remembered as a once-only beat (it may repeat)', () => {
    useNpcAmbientStore.getState().begin(genericConv, '2:4')
    expect(useNpcAmbientStore.getState().playedIds).not.toContain('kirill-alina-contract')
    expect(useNpcAmbientStore.getState().playedDayKey).toBe('2:4')
  })

  it('end clears the active conversation but keeps the played memory', () => {
    useNpcAmbientStore.getState().begin(storyConv, '2:3')
    useNpcAmbientStore.getState().end()
    expect(useNpcAmbientStore.getState().active).toBeNull()
    expect(useNpcAmbientStore.getState().playedDayKey).toBe('2:3')
    expect(useNpcAmbientStore.getState().playedIds).toContain('sonya-kirill-overload')
  })

  it('setLineIndex advances the visible line while a conversation is active', () => {
    useNpcAmbientStore.getState().begin(storyConv, '2:3')
    expect(useNpcAmbientStore.getState().active?.lineIndex).toBe(-1)
    useNpcAmbientStore.getState().setLineIndex(0)
    expect(useNpcAmbientStore.getState().active?.lineIndex).toBe(0)
  })

  it('?intro wipes the persisted memory', () => {
    useNpcAmbientStore.getState().begin(storyConv, '2:3')
    expect(loadAmbient(window.localStorage, '?intro')).toEqual({ playedIds: [], playedDayKey: null })
    expect(window.localStorage.getItem('startup-office-ambient')).toBeNull()
  })

  it('reset clears state and storage', () => {
    useNpcAmbientStore.getState().begin(storyConv, '2:3')
    useNpcAmbientStore.getState().reset()
    expect(useNpcAmbientStore.getState().active).toBeNull()
    expect(useNpcAmbientStore.getState().playedIds).toEqual([])
    expect(useNpcAmbientStore.getState().playedDayKey).toBeNull()
    expect(loadAmbient(window.localStorage, '')).toEqual({ playedIds: [], playedDayKey: null })
  })
})
