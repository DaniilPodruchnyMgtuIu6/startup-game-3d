import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../../materials/StubMaterialsProvider'
import { SceneLights } from '../../scene/lighting/Lighting'
import { Office } from '../../scene/Office'
import { KICKOFF_SLOTS } from './meetingSlots'
import { isBlockedAt, nearestWalkable } from '../../character/grid'

// 18H §3 "slots не находятся внутри мебели": the room-bounds check in
// meetingSlots.test.ts cannot see furniture - obstacles register at component
// mount (useObstacle reads the RENDERED meshes' world bounds), so a pure unit
// test always sees an empty grid and would pass with a slot inside a desk.
// Mounting the real office (stub materials, no characters) populates the nav
// grid with exactly what the game renders; each slot must then be genuinely
// walkable, or gather would silently divert its participant to
// nearestWalkable() - possibly beyond the 0.55m readiness tolerance, turning
// every kickoff into a 9s timeout + snap.
describe('kickoff slots vs the real furnished office (18H §3)', () => {
  it('every slot lands on open walkable floor - not inside furniture or wall clearance', async () => {
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
      for (const slot of KICKOFF_SLOTS) {
        expect(isBlockedAt(slot.position[0], slot.position[2]), `${slot.id} sits on a blocked cell`).toBe(false)
        // nearestWalkable returns the point itself when already walkable -
        // any deviation means gather would not deliver the character to the
        // authored mark
        expect(nearestWalkable(slot.position), `${slot.id} diverted`).toEqual(slot.position)
      }
    } finally {
      await renderer.unmount()
    }
  })
})
