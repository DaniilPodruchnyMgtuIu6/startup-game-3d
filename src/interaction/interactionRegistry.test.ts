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
})
