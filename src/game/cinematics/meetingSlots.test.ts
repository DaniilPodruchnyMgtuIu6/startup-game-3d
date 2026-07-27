import { describe, it, expect, beforeEach, vi } from 'vitest'
import { KICKOFF_SLOTS, slotSeparationViolations, isParticipantReady, gatherParticipants, ARRIVAL_TOLERANCE_M } from './meetingSlots'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { ROOMS } from '../../scene/layout'

const SONYA = 'npc-female-pm'
const KIRILL = 'npc-kirill-morozov'
const ALINA = 'npc-alina-belova'
const ILYA = 'npc-ilya-vlasov'

beforeEach(() => {
  window.localStorage.clear()
  const store = useCharacterStore.getState()
  for (const id of Object.keys(store.characters)) if (id !== PLAYER_ID) store.removeCharacter(id)
  useCharacterStore.getState().setSceneOwned(new Set())
})

describe('kickoff meeting slots (18H §3/§22.1-3)', () => {
  it('slot ids and characters are unique', () => {
    expect(new Set(KICKOFF_SLOTS.map((s) => s.id)).size).toBe(KICKOFF_SLOTS.length)
    expect(new Set(KICKOFF_SLOTS.map((s) => s.characterId)).size).toBe(KICKOFF_SLOTS.length)
  })

  it('slots keep the minimum separation - nobody stands inside a colleague', () => {
    expect(slotSeparationViolations(KICKOFF_SLOTS)).toEqual([])
  })

  it('slots lie inside the open space, clear of the whiteboard wall', () => {
    const room = ROOMS.openSpace
    for (const slot of KICKOFF_SLOTS) {
      expect(slot.position[0], slot.id).toBeGreaterThan(room.minX + 0.4) // not inside the board wall
      expect(slot.position[0], slot.id).toBeLessThan(room.maxX)
      expect(slot.position[2], slot.id).toBeGreaterThan(room.minZ)
      expect(slot.position[2], slot.id).toBeLessThan(room.maxZ)
    }
  })

  it('Sonya/Kirill/Alina are required; the player and Ilya are optional', () => {
    const required = KICKOFF_SLOTS.filter((s) => s.required).map((s) => s.characterId).sort()
    expect(required).toEqual([ALINA, SONYA, KIRILL].sort())
    expect(KICKOFF_SLOTS.find((s) => s.characterId === ILYA)?.required).toBe(false)
  })
})

describe('readiness barrier (18H §4)', () => {
  it('a participant standing on the slot in a settled state is ready', () => {
    const slot = KICKOFF_SLOTS.find((s) => s.characterId === SONYA)!
    useCharacterStore.getState().spawnCharacter(SONYA, slot.position, 0)
    expect(isParticipantReady(SONYA, slot)).toBe(true)
  })

  it('a participant beyond the arrival tolerance is not ready', () => {
    const slot = KICKOFF_SLOTS.find((s) => s.characterId === SONYA)!
    useCharacterStore
      .getState()
      .spawnCharacter(SONYA, [slot.position[0] + ARRIVAL_TOLERANCE_M + 1, 0, slot.position[2]], 0)
    expect(isParticipantReady(SONYA, slot)).toBe(false)
  })

  it('a missing character is never ready and gather skips absent optionals (no Ilya without a hire)', async () => {
    const ilyaSlot = KICKOFF_SLOTS.find((s) => s.characterId === ILYA)!
    expect(isParticipantReady(ILYA, ilyaSlot)).toBe(false)
    // Only Sonya is spawned here (Ilya not hired) - gather over just her and
    // Ilya's slots resolves without him instead of waiting out the timeout.
    const sonyaSlot = KICKOFF_SLOTS.find((s) => s.characterId === SONYA)!
    useCharacterStore.getState().spawnCharacter(SONYA, sonyaSlot.position, 0)
    const { gathered, timedOut } = await gatherParticipants([sonyaSlot, ilyaSlot])
    expect(gathered).toEqual([SONYA])
    expect(timedOut).toEqual([])
  })

  it('gather aligns arrived participants to the slot facing', async () => {
    const slot = KICKOFF_SLOTS.find((s) => s.characterId === KIRILL)!
    useCharacterStore.getState().spawnCharacter(KIRILL, slot.position, 2.7)
    await gatherParticipants([slot])
    expect(useCharacterStore.getState().characters[KIRILL].rotationY).toBeCloseTo(slot.facingY)
  })

  it('a required participant spawning AFTER the gather starts is still gathered (day-1 reload)', async () => {
    // On a day-1 reload the kickoff effect runs before the NPC controllers
    // spawn the cast - the gather must keep waiting and pick the character up
    // on spawn, not resolve vacuously over an empty office.
    const slot = KICKOFF_SLOTS.find((s) => s.characterId === KIRILL)!
    let resolved = false
    const gather = gatherParticipants([slot]).then((result) => {
      resolved = true
      return result
    })
    await Promise.resolve()
    expect(resolved).toBe(false) // required + not spawned -> still waiting
    useCharacterStore.getState().spawnCharacter(KIRILL, slot.position, 0)
    const { gathered, timedOut } = await gather
    expect(gathered).toEqual([KIRILL])
    expect(timedOut).toEqual([])
  })

  it('a required participant that never spawns resolves via the timeout guard with a diagnostic', async () => {
    vi.useFakeTimers()
    try {
      const slot = KICKOFF_SLOTS.find((s) => s.characterId === ALINA)!
      let result: { gathered: string[]; timedOut: string[] } | null = null
      void gatherParticipants([slot]).then((r) => {
        result = r
      })
      await vi.advanceTimersByTimeAsync(8_999)
      expect(result).toBeNull()
      await vi.advanceTimersByTimeAsync(1)
      expect(result).toEqual({ gathered: [], timedOut: [ALINA] })
    } finally {
      vi.useRealTimers()
    }
  })
})
