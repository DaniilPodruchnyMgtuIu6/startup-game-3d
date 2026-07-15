import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, loadProgress, saveProgress, type DialogueLine } from './gameStore'
import { BOARD_TASKS } from './tasks'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

const LINES: DialogueLine[] = [
  { speaker: 'Соня Соколова', speakerRole: 'Product Manager', text: 'Первая' },
  { speaker: 'Соня Соколова', speakerRole: 'Product Manager', text: 'Вторая' },
]

const FRESH = { playerName: '', phase: 'intro' as const, tasks: BOARD_TASKS, reprimands: 0 }

describe('loadProgress', () => {
  it('starts fresh when nothing is saved', () => {
    expect(loadProgress(fakeStorage(), '')).toEqual(FRESH)
  })

  it('restores a saved phase and name', () => {
    const storage = fakeStorage({
      'startup-office-progress': JSON.stringify({ playerName: 'Иван', phase: 'free' }),
    })
    expect(loadProgress(storage, '')).toEqual({ ...FRESH, playerName: 'Иван', phase: 'free' })
  })

  it('?intro wipes saved progress', () => {
    const storage = fakeStorage({
      'startup-office-progress': JSON.stringify({ playerName: 'Иван', phase: 'free' }),
    })
    expect(loadProgress(storage, '?intro')).toEqual(FRESH)
    expect(storage.dump()).toEqual({})
  })

  it('ignores corrupted or invalid saved data', () => {
    expect(loadProgress(fakeStorage({ 'startup-office-progress': '{oops' }), '')).toEqual(FRESH)
    expect(
      loadProgress(fakeStorage({ 'startup-office-progress': JSON.stringify({ phase: 'intro' }) }), ''),
    ).toEqual(FRESH)
  })

  it('works without storage (private mode)', () => {
    expect(loadProgress(null, '')).toEqual(FRESH)
    expect(() => saveProgress(null, { playerName: 'x', phase: 'free', tasks: [], reprimands: 0 })).not.toThrow()
  })
})

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({ phase: 'intro', playerName: '', activeDialogue: null })
    window.localStorage.clear()
  })

  it('completeIntro stores the trimmed name and moves to meetPm', () => {
    useGameStore.getState().completeIntro('  Иван  ')
    expect(useGameStore.getState().playerName).toBe('Иван')
    expect(useGameStore.getState().phase).toBe('meetPm')
  })

  it('completeIntro rejects an empty name', () => {
    useGameStore.getState().completeIntro('   ')
    expect(useGameStore.getState().phase).toBe('intro')
  })

  it('advanceDialogue steps through the lines and closes at the end', () => {
    useGameStore.setState({ phase: 'meetPm' })
    useGameStore.getState().startDialogue(LINES)
    expect(useGameStore.getState().activeDialogue?.index).toBe(0)
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().activeDialogue?.index).toBe(1)
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().activeDialogue).toBeNull()
  })

  it('refusing the job fires the player; restart returns to a clean intro', () => {
    useGameStore.getState().refuseJob()
    expect(useGameStore.getState().phase).toBe('fired')
    useGameStore.getState().restartGame()
    expect(useGameStore.getState().phase).toBe('intro')
    expect(useGameStore.getState().playerName).toBe('')
  })

  it('finishing the meetPm dialogue unlocks free play', () => {
    useGameStore.setState({ phase: 'meetPm', playerName: 'Иван' })
    useGameStore.getState().startDialogue([LINES[0]])
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().phase).toBe('free')
  })
})
