import { describe, it, expect, beforeEach } from 'vitest'
import { useTeamStore, loadTeam, saveTeam } from './teamStore'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

const KEY = 'startup-office-team'
const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const ctx = { sprintNumber: 1, day: 1 }

describe('loadTeam (migration & persistence)', () => {
  it('an old Feature-02 save without team state starts empty', () => {
    expect(loadTeam(fakeStorage(), '')).toEqual([])
  })

  it('restores saved hires', () => {
    const saved = { hires: [{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 2 }] }
    expect(loadTeam(fakeStorage({ [KEY]: JSON.stringify(saved) }), '')).toEqual(saved.hires)
  })

  it('corrupt JSON, non-array, or invalid entries fall back safely', () => {
    expect(loadTeam(fakeStorage({ [KEY]: '{oops' }), '')).toEqual([])
    expect(loadTeam(fakeStorage({ [KEY]: JSON.stringify({ hires: 'nope' }) }), '')).toEqual([])
    // drops the PM recorded as hireable + unknown ids
    const dirty = { hires: [{ employeeId: 'sonya-sokolova', hiredAtSprint: 1, hiredAtDay: 1 }] }
    expect(loadTeam(fakeStorage({ [KEY]: JSON.stringify(dirty) }), '')).toEqual([])
  })

  it('?intro wipes hires', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ hires: [{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 }] }) })
    expect(loadTeam(storage, '?intro')).toEqual([])
    expect(storage.dump()).toEqual({})
  })

  it('works without storage', () => {
    expect(loadTeam(null, '')).toEqual([])
    expect(() => saveTeam(null, [])).not.toThrow()
  })
})

describe('teamStore.hireEmployee', () => {
  beforeEach(() => {
    useTeamStore.setState({ hires: [], panelOpen: false })
    window.localStorage.clear()
  })

  it('hires both developers independently, recording sprint/day', () => {
    expect(useTeamStore.getState().hireEmployee(KIRILL, { sprintNumber: 1, day: 3 })).toEqual({ hired: true, employeeId: KIRILL })
    expect(useTeamStore.getState().hireEmployee(ALINA, { sprintNumber: 1, day: 5 })).toEqual({ hired: true, employeeId: ALINA })
    expect(useTeamStore.getState().hires).toEqual([
      { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 3 },
      { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 5 },
    ])
  })

  it('rejects a repeated hire and an unknown employee', () => {
    useTeamStore.getState().hireEmployee(KIRILL, ctx)
    expect(useTeamStore.getState().hireEmployee(KIRILL, ctx)).toEqual({ hired: false, reason: 'already-hired' })
    expect(useTeamStore.getState().hireEmployee('ghost', ctx)).toEqual({ hired: false, reason: 'unknown-employee' })
  })

  it('rejects an invalid game context', () => {
    expect(useTeamStore.getState().hireEmployee(KIRILL, { sprintNumber: 0, day: 1 })).toEqual({
      hired: false,
      reason: 'invalid-game-state',
    })
  })

  it('persists hires and resetTeam clears them', () => {
    useTeamStore.getState().hireEmployee(KIRILL, ctx)
    expect(loadTeam(window.localStorage, '')).toEqual([{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 }])
    useTeamStore.getState().resetTeam()
    expect(useTeamStore.getState().hires).toEqual([])
    expect(loadTeam(window.localStorage, '')).toEqual([])
  })
})
