import { describe, it, expect } from 'vitest'
import {
  registerInteraction,
  getInteractions,
  claimTarget,
  releaseClaims,
  isTargetFree,
} from './interactionRegistry'
import type { TriggerTarget } from './triggerPayload'

const deskA: TriggerTarget = { point: [1, 0, 1], facing: 0 }
const deskB: TriggerTarget = { point: [2, 0, 1], facing: 0 }

describe('interactionRegistry', () => {
  it('registers interactions by kind and removes them on unregister', () => {
    const before = getInteractions('workstation').length
    const unregister = registerInteraction('workstation', deskA)
    expect(getInteractions('workstation').length).toBe(before + 1)
    expect(getInteractions('sofa').length).toBe(0)
    unregister()
    expect(getInteractions('workstation').length).toBe(before)
  })

  it('claiming blocks other characters but not the owner', () => {
    claimTarget('npc-1', deskA)
    expect(isTargetFree(deskA, 'npc-2')).toBe(false)
    expect(isTargetFree(deskA, 'npc-1')).toBe(true)
    releaseClaims('npc-1')
    expect(isTargetFree(deskA, 'npc-2')).toBe(true)
  })

  it('a new claim releases the owners previous spot', () => {
    claimTarget('npc-1', deskA)
    claimTarget('npc-1', deskB)
    expect(isTargetFree(deskA, 'npc-2')).toBe(true)
    expect(isTargetFree(deskB, 'npc-2')).toBe(false)
    releaseClaims('npc-1')
  })

  // Feature 16 §7: the manager's chair registers as 'exec-seat', so it is NOT in
  // the 'seat' pool NPC brains sample (Npcs.tsx samples seat/workstation/coffee/
  // sofa). The player still targets it directly via the trigger's onTrigger.
  it('an exec-seat is excluded from the NPC seat pool', () => {
    const seatBefore = getInteractions('seat').length
    const unregExec = registerInteraction('exec-seat', deskA)
    const unregSeat = registerInteraction('seat', deskB)
    expect(getInteractions('seat').length).toBe(seatBefore + 1) // only the normal seat
    expect(getInteractions('seat').some((e) => e.target.point[0] === deskA.point[0])).toBe(false)
    expect(getInteractions('exec-seat').length).toBe(1)
    unregExec()
    unregSeat()
  })
})
