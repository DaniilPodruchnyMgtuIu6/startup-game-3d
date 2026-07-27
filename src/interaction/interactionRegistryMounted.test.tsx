import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { SceneLights } from '../scene/lighting/Lighting'
import { Office } from '../scene/Office'
import { getInteractions, type InteractionKind } from './interactionRegistry'

// 18H §11/§22.14: every interactive furniture kind must register its anchors
// when the REAL office mounts - a seat without a registered target is
// invisible to both the player click and the NPC planner, and a target with
// non-finite coordinates poisons pathfinding. Counts are minimums so adding
// furniture never breaks this; ping-pong is exactly two (one per side, the
// matchmaker's atomic-pair contract).
const EXPECTED_MINIMUMS: Array<[InteractionKind, number]> = [
  ['workstation', 4],
  ['coffee', 1],
  ['seat', 1],
  ['sofa', 1],
  ['exec-seat', 1],
  ['pull-up-bar', 1],
  // 'server' is deliberately absent: a rack registers its repair trigger only
  // while BROKEN (ServerRack.tsx) - at-rest registration would be a defect.
]

describe('interaction anchors register on the real office mount (18H §11/§22.14)', () => {
  it('every kind registers, with finite anchor coordinates', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Office
        MaterialsProvider={StubMaterialsProvider}
        LightingComponent={SceneLights}
        CharacterComponent={() => null}
        NpcsComponent={() => null}
        StoryComponent={() => null}
      />,
    )
    await renderer.advanceFrames(2, 16)
    try {
      for (const [kind, minimum] of EXPECTED_MINIMUMS) {
        const entries = getInteractions(kind)
        expect(entries.length, `${kind} registered`).toBeGreaterThanOrEqual(minimum)
        for (const { target } of entries) {
          expect(Number.isFinite(target.facing), `${kind} facing`).toBe(true)
          for (const v of target.point) expect(Number.isFinite(v), `${kind} point`).toBe(true)
        }
      }
      expect(getInteractions('ping-pong').length, 'ping-pong sides').toBe(2)
    } finally {
      await renderer.unmount()
    }
  })
})
