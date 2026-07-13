# Controllable Office Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one clickable, animated Mixamo character to the office scene — click empty floor to walk there, click any workstation to walk over/sit/type, click the coffee machine to walk over/brew/drink — with door-aware navigation and clean, layered (navigation / state machine / rendering) code.

**Architecture:** A pure-function navigation module builds waypoint paths through the office's star-topology doorways; a pure discriminated-union reducer owns the character's discrete state (`idle | walking | sittingDown | working | brewingCoffee | drinkingCoffee`); a small zustand store wraps the reducer with live position/rotation and is the single point both clickable furniture and the render component talk to; `Character.tsx` is a thin GLTF-loading + `AnimationMixer` + per-frame movement component that is the only piece not unit-tested (real assets, same class of problem as `OfficeMaterialsProvider`).

**Tech Stack:** Adds to the existing project: `zustand` (state), `fbx2gltf` + `@gltf-transform/core` + `@gltf-transform/extensions` + `@gltf-transform/functions` (dev-only, asset conversion pipeline).

## Global Constraints

- Character source: Mixamo character + 5 animation clips already downloaded to `character-source/*.fbx` by the user (idle, walk, sit, type, drink), each exported "With Skin." `character-source/` is gitignored (regenerable), converted output in `public/character/*.glb` is committed (same treatment as the office's textures/HDRI).
- The full asset conversion pipeline below (FBX→GLB via `fbx2gltf`, root-motion stripping and mesh/material/texture pruning via `@gltf-transform/*`) was executed for real against the user's actual downloaded files during planning and verified correct: units already in meters (no scale correction needed), all 5 files share identical bone names (`mixamorig7:*` prefix — retargeting works), the `walk` clip had baked-in forward root motion on the Hips bone despite Mixamo's "In Place" export option (stripped programmatically, not relied on from the UI), and stripping mesh/material/texture data from every non-base clip shrank total output from ~225MB to ~44.8MB. Task 1 re-runs this exact, already-proven script for real in the project.
- No state-machine or pathfinding library, no physics engine — a plain TypeScript discriminated union + a handful of pure functions, per the user's explicit request for clean, uncomplicated code.
- `@react-three/test-renderer` cannot render `Character.tsx` (real GLTF loads) — its position/rotation math is factored into a plain, fully-tested pure function (`stepTowards`); the component itself is verified only via `tsc`/`vite build`/manual `npm run dev`, following the same split already established for `OfficeMaterialsProvider`/`Lighting` in the base office plan.
- `Office.tsx` gains a third injectable prop, `CharacterComponent` (alongside the existing `MaterialsProvider`/`LightingComponent`), defaulting to the real `Character`; `Office.test.tsx` substitutes a no-op stub for it, same pattern as the other two.
- Adding an `InteractionTrigger` mesh to `Workstation`/`CoffeeMachine` adds one mesh to each — their existing exact-mesh-count tests (26 and 5) need updating to 27 and 6 as part of this plan, not a regression.
- Verification the implementer CAN run: `npx tsc --noEmit`, `npx vite build`, `npx vitest run`. The Mixamo model's default forward-facing axis was not verified against a live render (would require the full pipeline built first) — `movement.ts` isolates this into one constant (`MODEL_FORWARD_OFFSET`) to flip if the character turns out to walk backward; check this via a real screenshot (see the base office plan's screenshot workflow) once Task 9 is wired in, before calling the feature done.

---

### Task 1: Asset conversion pipeline

**Files:**
- Create: `scripts/convert-character.mjs`
- Modify: `package.json` (add devDependencies + `convert-character` script)

**Interfaces:**
- Produces: `public/character/idle.glb` (full skinned character + `idle` clip), `public/character/{walk,sit,type,drink}.glb` (skeleton + one renamed clip each, no mesh/material/texture — animation-only). Consumed by `Character.tsx` (Task 9).

- [ ] **Step 1: Add dependencies**

```bash
npm install --save-dev fbx2gltf@0.9.7-p1 @gltf-transform/core@4.4.1 @gltf-transform/extensions@4.4.1 @gltf-transform/functions@4.4.1
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
"convert-character": "node scripts/convert-character.mjs"
```

- [ ] **Step 3: Create `scripts/convert-character.mjs`**

This is the exact script already verified end-to-end against the user's real downloaded files during planning (FBX→GLB conversion, Hips-translation root-motion stripping, clip renaming, and mesh/material/texture pruning on every clip except the base).

```js
import convert from 'fbx2gltf'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import path from 'node:path'
import fs from 'node:fs/promises'

const BASE_CLIP = 'idle'
const CLIPS = ['idle', 'walk', 'sit', 'type', 'drink']
const SRC_DIR = path.resolve('character-source')
const OUT_DIR = path.resolve('public/character')
const TMP_DIR = path.resolve('.character-tmp')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

await fs.mkdir(OUT_DIR, { recursive: true })
await fs.mkdir(TMP_DIR, { recursive: true })

for (const clip of CLIPS) {
  const srcFbx = path.join(SRC_DIR, `${clip}.fbx`)
  const tmpGlb = path.join(TMP_DIR, `${clip}.raw.glb`)
  const outGlb = path.join(OUT_DIR, `${clip}.glb`)

  console.log(`[${clip}] converting FBX -> GLB...`)
  await convert(srcFbx, tmpGlb, [])

  const document = await io.read(tmpGlb)
  const root = document.getRoot()

  const hipsNode = root.listNodes().find((n) => n.getName().endsWith(':Hips'))
  if (!hipsNode) throw new Error(`[${clip}] Hips node not found`)

  console.log(`[${clip}] stripping root motion, renaming clip...`)
  for (const anim of root.listAnimations()) {
    anim.setName(clip)
    for (const channel of anim.listChannels()) {
      if (channel.getTargetNode() === hipsNode && channel.getTargetPath() === 'translation') {
        const sampler = channel.getSampler()
        const output = sampler.getOutput()
        const array = output.getArray().slice()
        const x0 = array[0]
        const z0 = array[2]
        for (let i = 0; i < array.length; i += 3) {
          array[i] = x0
          array[i + 2] = z0
        }
        output.setArray(array)
      }
    }
  }

  if (clip !== BASE_CLIP) {
    console.log(`[${clip}] stripping mesh/material/texture data (animation-only file)...`)
    for (const mesh of root.listMeshes()) mesh.dispose()
    await document.transform(prune())
  }

  await io.write(outGlb, document)
  const stat = await fs.stat(outGlb)
  console.log(`[${clip}] wrote ${outGlb} (${(stat.size / 1024).toFixed(0)} KB)`)
}

await fs.rm(TMP_DIR, { recursive: true, force: true })
console.log('done')
```

- [ ] **Step 4: Run the conversion**

Run: `npm run convert-character`
Expected: 5 lines of `[clip] wrote public/character/<clip>.glb (N KB)`, then `done`. Based on the already-verified run: `idle.glb` ≈ 43000 KB, `walk.glb`/`sit.glb`/`type.glb`/`drink.glb` each under 400 KB.

- [ ] **Step 5: Verify output**

```bash
ls -la public/character/
```

Expected: exactly `idle.glb`, `walk.glb`, `sit.glb`, `type.glb`, `drink.glb`, total size roughly 40–50 MB (dominated by `idle.glb`'s embedded textures).

- [ ] **Step 6: Commit**

```bash
git add scripts/convert-character.mjs package.json package-lock.json public/character
git commit -m "chore: add character FBX->GLB conversion pipeline and converted assets"
```

---

### Task 2: Navigation

**Files:**
- Create: `src/character/navigation.ts`
- Test: `src/character/navigation.test.ts`

**Interfaces:**
- Produces: `Point` type (`[number, number, number]`), `DOORWAYS` (per-side-room door world position), `roomAt(point): RoomName`, `buildPath(from, to): Point[]`. Consumed by `characterMachine.ts` (Task 4).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { roomAt, buildPath, DOORWAYS } from './navigation'
import { ROOMS } from '../scene/layout'

describe('navigation', () => {
  it('identifies which room a point falls in', () => {
    expect(roomAt([0, 0, 0])).toBe('openSpace')
    expect(roomAt([-9, 0, -5.333])).toBe('meetingRoom')
    expect(roomAt([9, 0, 5.333])).toBe('gameRoom')
  })

  it('every side room has a doorway on its shared boundary with open space', () => {
    expect(DOORWAYS.meetingRoom).toEqual([ROOMS.meetingRoom.maxX, 0, (ROOMS.meetingRoom.minZ + ROOMS.meetingRoom.maxZ) / 2])
    expect(DOORWAYS.kitchen).toEqual([ROOMS.kitchen.minX, 0, (ROOMS.kitchen.minZ + ROOMS.kitchen.maxZ) / 2])
  })

  it('paths within the same room are a direct line', () => {
    const path = buildPath([-9, 0, -6], [-9, 0, -4])
    expect(path).toEqual([[-9, 0, -4]])
  })

  it('paths from open space to a side room go via that room doorway', () => {
    const target: [number, number, number] = [-9, 0, -5.333]
    const path = buildPath([0, 0, 0], target)
    expect(path).toEqual([DOORWAYS.meetingRoom, target])
  })

  it('paths between two side rooms go via both doorways', () => {
    const target: [number, number, number] = [9, 0, 5.333]
    const path = buildPath([-9, 0, -5.333], target)
    expect(path).toEqual([DOORWAYS.meetingRoom, DOORWAYS.gameRoom, target])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/character/navigation.test.ts`
Expected: FAIL — `Cannot find module './navigation'`.

- [ ] **Step 3: Implement `src/character/navigation.ts`**

```ts
import { ROOMS, type RoomName } from '../scene/layout'

export type Point = [number, number, number]

type SideRoomName = Exclude<RoomName, 'openSpace'>

const SIDE_ROOMS: SideRoomName[] = ['meetingRoom', 'focusRoom', 'serverRoom', 'ceoOffice', 'kitchen', 'gameRoom']

function doorwayFor(room: SideRoomName): Point {
  const bounds = ROOMS[room]
  const isWestColumn = bounds.maxX <= 0
  const doorX = isWestColumn ? bounds.maxX : bounds.minX
  const doorZ = (bounds.minZ + bounds.maxZ) / 2
  return [doorX, 0, doorZ]
}

export const DOORWAYS: Record<SideRoomName, Point> = Object.fromEntries(
  SIDE_ROOMS.map((room) => [room, doorwayFor(room)]),
) as Record<SideRoomName, Point>

export function roomAt(point: Point): RoomName {
  const [x, , z] = point
  for (const name of SIDE_ROOMS) {
    const b = ROOMS[name]
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name
  }
  return 'openSpace'
}

export function buildPath(from: Point, to: Point): Point[] {
  const roomFrom = roomAt(from)
  const roomTo = roomAt(to)

  if (roomFrom === roomTo) return [to]

  const waypoints: Point[] = []
  if (roomFrom !== 'openSpace') waypoints.push(DOORWAYS[roomFrom as SideRoomName])
  if (roomTo !== 'openSpace') waypoints.push(DOORWAYS[roomTo as SideRoomName])
  waypoints.push(to)
  return waypoints
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/character/navigation.test.ts`
Expected: `Tests  5 passed (5)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/character/navigation.ts src/character/navigation.test.ts
git commit -m "feat: add door-aware navigation path building"
```

---

### Task 3: Movement math

**Files:**
- Create: `src/character/movement.ts`
- Test: `src/character/movement.test.ts`

**Interfaces:**
- Produces: `stepTowards(current, target, speed, deltaSeconds, currentRotationY): { position, rotationY, reachedTarget }`. Consumed by `Character.tsx` (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { stepTowards } from './movement'

describe('stepTowards', () => {
  it('moves partway toward the target at the given speed', () => {
    const result = stepTowards([0, 0, 0], [0, 0, 10], 2, 1, 0)
    expect(result.position[0]).toBeCloseTo(0)
    expect(result.position[2]).toBeCloseTo(2)
    expect(result.reachedTarget).toBe(false)
  })

  it('snaps to the target and reports arrival once within the epsilon', () => {
    const result = stepTowards([0, 0, 9.98], [0, 0, 10], 2, 1, 0)
    expect(result.position).toEqual([0, 0, 10])
    expect(result.reachedTarget).toBe(true)
  })

  it('never overshoots even with a large delta', () => {
    const result = stepTowards([0, 0, 0], [0, 0, 1], 100, 1, 0)
    expect(result.position).toEqual([0, 0, 1])
    expect(result.reachedTarget).toBe(true)
  })

  it('faces the direction of travel', () => {
    const result = stepTowards([0, 0, 0], [10, 0, 0], 2, 1, 0)
    expect(result.rotationY).toBeCloseTo(Math.PI / 2, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/character/movement.test.ts`
Expected: FAIL — `Cannot find module './movement'`.

- [ ] **Step 3: Implement `src/character/movement.ts`**

```ts
import type { Point } from './navigation'

export interface MoveResult {
  position: Point
  rotationY: number
  reachedTarget: boolean
}

const ARRIVE_EPSILON = 0.05
const TURN_RATE = 10

export function stepTowards(
  current: Point,
  target: Point,
  speed: number,
  deltaSeconds: number,
  currentRotationY: number,
): MoveResult {
  const dx = target[0] - current[0]
  const dz = target[2] - current[2]
  const distance = Math.sqrt(dx * dx + dz * dz)

  if (distance <= ARRIVE_EPSILON) {
    return { position: target, rotationY: currentRotationY, reachedTarget: true }
  }

  const travel = Math.min(distance, speed * deltaSeconds)
  const t = travel / distance
  const position: Point = [current[0] + dx * t, target[1], current[2] + dz * t]

  const reachedTarget = travel >= distance
  const targetRotationY = Math.atan2(dx, dz)
  const rotationY = reachedTarget ? targetRotationY : turnToward(currentRotationY, targetRotationY, Math.min(1, deltaSeconds * TURN_RATE))

  return { position: reachedTarget ? target : position, rotationY, reachedTarget }
}

function turnToward(from: number, to: number, t: number): number {
  let diff = to - from
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/character/movement.test.ts`
Expected: `Tests  4 passed (4)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/character/movement.ts src/character/movement.test.ts
git commit -m "feat: add character movement/turning math"
```

---

### Task 4: Character state machine

**Files:**
- Create: `src/character/characterMachine.ts`
- Test: `src/character/characterMachine.test.ts`

**Interfaces:**
- Produces: `Target` (`{ point: Point; facing: number }`), `CharacterState` (discriminated union: `idle | walking | sittingDown | working | brewingCoffee | drinkingCoffee`), `CharacterEvent`, `nextState(current, event, position): CharacterState`. Consumed by `characterStore.ts` (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { nextState, type CharacterState } from './characterMachine'
import { DOORWAYS } from './navigation'

const IDLE: CharacterState = { kind: 'idle' }

describe('characterMachine', () => {
  it('CLICK_FLOOR starts walking with a path to the point', () => {
    const state = nextState(IDLE, { type: 'CLICK_FLOOR', point: [1, 0, 1] }, [0, 0, 0])
    expect(state).toEqual({ kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'idle' } })
  })

  it('CLICK_WORKSTATION starts walking with a sit arrival goal', () => {
    const target = { point: [1, 0, 1] as const, facing: 0 }
    const state = nextState(IDLE, { type: 'CLICK_WORKSTATION', target }, [0, 0, 0])
    expect(state.kind).toBe('walking')
    if (state.kind === 'walking') expect(state.onArrive).toEqual({ kind: 'sit', target })
  })

  it('WAYPOINT_REACHED advances to the next waypoint', () => {
    const walking: CharacterState = {
      kind: 'walking',
      path: [DOORWAYS.meetingRoom, [1, 0, 1]],
      nextIndex: 0,
      onArrive: { kind: 'idle' },
    }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, DOORWAYS.meetingRoom)
    expect(state).toEqual({ ...walking, nextIndex: 1 })
  })

  it('WAYPOINT_REACHED on the final waypoint resolves the arrival goal (idle)', () => {
    const walking: CharacterState = { kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'idle' } }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'idle' })
  })

  it('WAYPOINT_REACHED on the final waypoint resolves a sit arrival goal', () => {
    const target = { point: [1, 0, 1] as const, facing: Math.PI }
    const walking: CharacterState = { kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'sit', target } }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'sittingDown', target })
  })

  it('SETTLE_ELAPSED moves sittingDown to working', () => {
    const target = { point: [1, 0, 1] as const, facing: 0 }
    const state = nextState({ kind: 'sittingDown', target }, { type: 'SETTLE_ELAPSED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'working', target })
  })

  it('BREW_ELAPSED moves brewingCoffee to drinkingCoffee', () => {
    const target = { point: [1, 0, 1] as const, facing: 0 }
    const state = nextState({ kind: 'brewingCoffee', target }, { type: 'BREW_ELAPSED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'drinkingCoffee', target })
  })

  it('a new click while working interrupts and starts walking to the new target', () => {
    const oldTarget = { point: [1, 0, 1] as const, facing: 0 }
    const working: CharacterState = { kind: 'working', target: oldTarget }
    const state = nextState(working, { type: 'CLICK_FLOOR', point: [5, 0, 5] }, [1, 0, 1])
    expect(state.kind).toBe('walking')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/character/characterMachine.test.ts`
Expected: FAIL — `Cannot find module './characterMachine'`.

- [ ] **Step 3: Implement `src/character/characterMachine.ts`**

```ts
import { buildPath, type Point } from './navigation'

export interface Target {
  point: Point
  facing: number
}

type ArrivalGoal = { kind: 'idle' } | { kind: 'sit'; target: Target } | { kind: 'brew'; target: Target }

export type CharacterState =
  | { kind: 'idle' }
  | { kind: 'walking'; path: Point[]; nextIndex: number; onArrive: ArrivalGoal }
  | { kind: 'sittingDown'; target: Target }
  | { kind: 'working'; target: Target }
  | { kind: 'brewingCoffee'; target: Target }
  | { kind: 'drinkingCoffee'; target: Target }

export type CharacterEvent =
  | { type: 'CLICK_FLOOR'; point: Point }
  | { type: 'CLICK_WORKSTATION'; target: Target }
  | { type: 'CLICK_COFFEE_MACHINE'; target: Target }
  | { type: 'WAYPOINT_REACHED' }
  | { type: 'SETTLE_ELAPSED' }
  | { type: 'BREW_ELAPSED' }

export function nextState(current: CharacterState, event: CharacterEvent, position: Point): CharacterState {
  switch (event.type) {
    case 'CLICK_FLOOR':
      return startWalking(position, event.point, { kind: 'idle' })
    case 'CLICK_WORKSTATION':
      return startWalking(position, event.target.point, { kind: 'sit', target: event.target })
    case 'CLICK_COFFEE_MACHINE':
      return startWalking(position, event.target.point, { kind: 'brew', target: event.target })
    case 'WAYPOINT_REACHED':
      return advanceWaypoint(current)
    case 'SETTLE_ELAPSED':
      return current.kind === 'sittingDown' ? { kind: 'working', target: current.target } : current
    case 'BREW_ELAPSED':
      return current.kind === 'brewingCoffee' ? { kind: 'drinkingCoffee', target: current.target } : current
  }
}

function startWalking(from: Point, to: Point, onArrive: ArrivalGoal): CharacterState {
  return { kind: 'walking', path: buildPath(from, to), nextIndex: 0, onArrive }
}

function advanceWaypoint(current: CharacterState): CharacterState {
  if (current.kind !== 'walking') return current
  const nextIndex = current.nextIndex + 1
  if (nextIndex >= current.path.length) return arrive(current.onArrive)
  return { ...current, nextIndex }
}

function arrive(goal: ArrivalGoal): CharacterState {
  switch (goal.kind) {
    case 'idle':
      return { kind: 'idle' }
    case 'sit':
      return { kind: 'sittingDown', target: goal.target }
    case 'brew':
      return { kind: 'brewingCoffee', target: goal.target }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/character/characterMachine.test.ts`
Expected: `Tests  8 passed (8)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/character/characterMachine.ts src/character/characterMachine.test.ts
git commit -m "feat: add character state machine reducer"
```

---

### Task 5: Character store

**Files:**
- Create: `src/character/characterStore.ts`
- Test: `src/character/characterStore.test.ts`

**Interfaces:**
- Consumes: `nextState`, `CharacterState`, `CharacterEvent`, `Target` (Task 4).
- Produces: `useCharacterStore` (zustand store: `state`, `position`, `rotationY`, `dispatch`, `setTransform`, `clickFloor`, `clickWorkstation`, `clickCoffeeMachine`). Consumed by `Character.tsx` (Task 9), `InteractionTrigger`-wired furniture (Task 7), `FloorClickCatcher` (Task 8).

- [ ] **Step 1: Add zustand**

```bash
npm install zustand@5.0.14
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore } from './characterStore'

describe('characterStore', () => {
  beforeEach(() => {
    useCharacterStore.setState({ state: { kind: 'idle' }, position: [0, 0, 0], rotationY: 0 })
  })

  it('starts idle at the spawn transform', () => {
    const s = useCharacterStore.getState()
    expect(s.state).toEqual({ kind: 'idle' })
  })

  it('clickFloor dispatches a walking state built from the current position', () => {
    useCharacterStore.getState().clickFloor([3, 0, 4])
    expect(useCharacterStore.getState().state.kind).toBe('walking')
  })

  it('clickWorkstation snaps rotationY to the target facing once seated', () => {
    const target = { point: [3, 0, 4] as const, facing: Math.PI / 2 }
    useCharacterStore.getState().clickWorkstation(target)
    useCharacterStore.setState({ position: [3, 0, 4] })
    useCharacterStore.getState().dispatch({ type: 'WAYPOINT_REACHED' })
    expect(useCharacterStore.getState().state).toEqual({ kind: 'sittingDown', target })
    expect(useCharacterStore.getState().rotationY).toBeCloseTo(Math.PI / 2)
  })

  it('setTransform updates position and rotation directly', () => {
    useCharacterStore.getState().setTransform([1, 0, 1], 1.5)
    expect(useCharacterStore.getState().position).toEqual([1, 0, 1])
    expect(useCharacterStore.getState().rotationY).toBe(1.5)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/character/characterStore.test.ts`
Expected: FAIL — `Cannot find module './characterStore'`.

- [ ] **Step 4: Implement `src/character/characterStore.ts`**

```ts
import { create } from 'zustand'
import { nextState, type CharacterState, type CharacterEvent, type Target } from './characterMachine'
import type { Point } from './navigation'

const SPAWN_POSITION: Point = [2, 0, 6]
const SPAWN_ROTATION_Y = Math.PI

interface CharacterStore {
  state: CharacterState
  position: Point
  rotationY: number
  dispatch: (event: CharacterEvent) => void
  setTransform: (position: Point, rotationY: number) => void
  clickFloor: (point: Point) => void
  clickWorkstation: (target: Target) => void
  clickCoffeeMachine: (target: Target) => void
}

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  state: { kind: 'idle' },
  position: SPAWN_POSITION,
  rotationY: SPAWN_ROTATION_Y,
  dispatch: (event) =>
    set((s) => {
      const state = nextState(s.state, event, s.position)
      const rotationY = 'target' in state ? state.target.facing : s.rotationY
      return { state, rotationY }
    }),
  setTransform: (position, rotationY) => set({ position, rotationY }),
  clickFloor: (point) => get().dispatch({ type: 'CLICK_FLOOR', point }),
  clickWorkstation: (target) => get().dispatch({ type: 'CLICK_WORKSTATION', target }),
  clickCoffeeMachine: (target) => get().dispatch({ type: 'CLICK_COFFEE_MACHINE', target }),
}))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/character/characterStore.test.ts`
Expected: `Tests  4 passed (4)`.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/character/characterStore.ts src/character/characterStore.test.ts package.json package-lock.json
git commit -m "feat: add character zustand store"
```

---

### Task 6: Interaction trigger primitive

**Files:**
- Create: `src/interaction/triggerPayload.ts`
- Create: `src/interaction/InteractionTrigger.tsx`
- Test: `src/interaction/triggerPayload.test.ts`
- Test: `src/interaction/InteractionTrigger.test.tsx`

**Interfaces:**
- Produces: `TriggerTarget` (`{ point: [number,number,number]; facing: number }` — same field names as `characterMachine.ts`'s `Target` from Task 4, so a `TriggerTarget` is directly usable anywhere a `Target` is expected without either module importing the other), `computeTriggerPayload(object: THREE.Object3D): TriggerTarget`, `InteractionTrigger({ position?, size?, onTrigger? })`. Consumed by `Workstation`/`CoffeeMachine` (Task 7).

- [ ] **Step 1: Write the failing test for `computeTriggerPayload`**

```ts
import { describe, it, expect } from 'vitest'
import { Object3D, Group } from 'three'
import { computeTriggerPayload } from './triggerPayload'

describe('computeTriggerPayload', () => {
  it('resolves world position and facing through a parent transform', () => {
    const parent = new Group()
    parent.position.set(2, 0, 3)
    parent.rotation.y = Math.PI / 2
    const child = new Object3D()
    child.position.set(1, 0, 0)
    parent.add(child)
    parent.updateMatrixWorld(true)

    const payload = computeTriggerPayload(child)
    expect(payload.point[0]).toBeCloseTo(2)
    expect(payload.point[1]).toBeCloseTo(0)
    expect(payload.point[2]).toBeCloseTo(2)
    expect(payload.facing).toBeCloseTo(Math.PI / 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interaction/triggerPayload.test.ts`
Expected: FAIL — `Cannot find module './triggerPayload'`.

- [ ] **Step 3: Implement `src/interaction/triggerPayload.ts`**

```ts
import { Vector3, Quaternion, Euler, type Object3D } from 'three'

export interface TriggerTarget {
  point: [number, number, number]
  facing: number
}

const tempVec = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()

export function computeTriggerPayload(object: Object3D): TriggerTarget {
  object.getWorldPosition(tempVec)
  object.getWorldQuaternion(tempQuat)
  tempEuler.setFromQuaternion(tempQuat)
  return { point: [tempVec.x, tempVec.y, tempVec.z], facing: tempEuler.y }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/interaction/triggerPayload.test.ts`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `InteractionTrigger`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { InteractionTrigger } from './InteractionTrigger'

describe('InteractionTrigger', () => {
  it('renders nothing when onTrigger is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(<InteractionTrigger />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0)
  })

  it('renders one mesh when onTrigger is provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(<InteractionTrigger onTrigger={vi.fn()} />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/interaction/InteractionTrigger.test.tsx`
Expected: FAIL — `Cannot find module './InteractionTrigger'`.

- [ ] **Step 7: Implement `src/interaction/InteractionTrigger.tsx`**

```tsx
import { useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { computeTriggerPayload, type TriggerTarget } from './triggerPayload'

export interface InteractionTriggerProps {
  position?: [number, number, number]
  size?: [number, number, number]
  onTrigger?: (target: TriggerTarget) => void
}

export function InteractionTrigger({ position = [0, 0, 0], size = [0.7, 0.6, 0.7], onTrigger }: InteractionTriggerProps) {
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onTrigger?.(computeTriggerPayload(event.object))
    },
    [onTrigger],
  )

  if (!onTrigger) return null

  return (
    <mesh
      position={position}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
```

Note: the trigger mesh must stay `visible` (the default) — three.js's `Raycaster` skips invisible objects entirely, so an invisible-but-clickable hitbox has to hide via a fully transparent material, not `visible={false}`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/interaction/InteractionTrigger.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/interaction
git commit -m "feat: add reusable InteractionTrigger clickable-marker component"
```

---

### Task 7: Wire triggers into Workstation and CoffeeMachine

**Files:**
- Modify: `src/furniture/Workstation.tsx`
- Modify: `src/furniture/Workstation.test.tsx`
- Modify: `src/furniture/CoffeeMachine.tsx`
- Modify: `src/furniture/CoffeeMachine.test.tsx`

**Interfaces:**
- Modifies: `WorkstationProps` gains `onSelect?: (target: TriggerTarget) => void`; `CoffeeMachineProps` gains `onSelect?: (target: TriggerTarget) => void`. Both consumed by room tasks (Task 10).

- [ ] **Step 1: Update the failing test for `Workstation`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Workstation } from './Workstation'

describe('Workstation', () => {
  it('renders desk + chair + monitor + keyboard + mouse + mug + trigger (27 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Workstation chairColor="#c0392b" onSelect={vi.fn()} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(27)
  })

  it('renders 26 meshes (no trigger) when onSelect is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Workstation chairColor="#c0392b" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(26)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Workstation.test.tsx`
Expected: FAIL — mesh count is 26, not 27, for the first case (no `onSelect` prop exists yet, so it's ignored).

- [ ] **Step 3: Update `src/furniture/Workstation.tsx`**

```tsx
import { Desk } from './Desk'
import { Chair } from './Chair'
import { Monitor } from './Monitor'
import { Keyboard, Mouse, Mug } from './DeskAccessories'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface WorkstationProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  chairColor?: string
  onSelect?: (target: TriggerTarget) => void
}

export function Workstation({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  chairColor = '#3b3f46',
  onSelect,
}: WorkstationProps) {
  return (
    <group position={position} rotation={rotation}>
      <Desk />
      <Chair position={[0, 0, -0.55]} color={chairColor} />
      <Monitor position={[0, 0.75, 0.2]} rotation={[0, Math.PI, 0]} />
      <Keyboard position={[0, 0.76, -0.1]} />
      <Mouse position={[0.28, 0.765, -0.1]} />
      <Mug position={[-0.25, 0.75, -0.15]} />
      <InteractionTrigger position={[0, 0.3, -0.55]} size={[0.6, 0.6, 0.6]} onTrigger={onSelect} />
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Workstation.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Update the failing test for `CoffeeMachine`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CoffeeMachine } from './CoffeeMachine'

describe('CoffeeMachine', () => {
  it('renders body + tank + tray + display + spout + trigger (6 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeMachine onSelect={vi.fn()} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(6)
  })

  it('renders 5 meshes (no trigger) when onSelect is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeMachine />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/CoffeeMachine.test.tsx`
Expected: FAIL — mesh count is 5, not 6, for the first case.

- [ ] **Step 7: Update `src/furniture/CoffeeMachine.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface CoffeeMachineProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

export function CoffeeMachine({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: CoffeeMachineProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.4, 0.4]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[-0.12, 0.38, -0.15]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.1]} />
        <meshStandardMaterial color="#8fb8d9" roughness={0.15} metalness={0} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0.05]}>
        <boxGeometry args={[0.24, 0.02, 0.25]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.05, 0.32, 0.201]}>
        <boxGeometry args={[0.08, 0.04, 0.002]} />
        <meshStandardMaterial {...materials.screenEmissive} />
      </mesh>
      <mesh position={[0, 0.22, 0.15]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <InteractionTrigger position={[0, 0.3, 0.4]} size={[0.5, 0.8, 0.5]} onTrigger={onSelect} />
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/CoffeeMachine.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 9: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; all tests pass (existing office tests + new character tests so far).

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Workstation.tsx src/furniture/Workstation.test.tsx src/furniture/CoffeeMachine.tsx src/furniture/CoffeeMachine.test.tsx
git commit -m "feat: wire InteractionTrigger into Workstation and CoffeeMachine"
```

---

### Task 8: Floor click catcher

**Files:**
- Create: `src/character/FloorClickCatcher.tsx`
- Test: `src/character/FloorClickCatcher.test.tsx`

**Interfaces:**
- Consumes: `BUILDING` (`src/scene/layout.ts`), `useCharacterStore` (Task 5).
- Produces: `FloorClickCatcher()` — no props. Consumed by `Office.tsx` (Task 10).

Unlike `InteractionTrigger` (which reports a *fixed* world position regardless of where on the hitbox you click — right for "go to this desk"), a floor click needs the *actual* clicked point, since you can click anywhere on the floor — so this is its own small component using the click event's `point` directly, not built on `InteractionTrigger`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { FloorClickCatcher } from './FloorClickCatcher'

describe('FloorClickCatcher', () => {
  it('renders a single invisible floor plane', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FloorClickCatcher />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/character/FloorClickCatcher.test.tsx`
Expected: FAIL — `Cannot find module './FloorClickCatcher'`.

- [ ] **Step 3: Implement `src/character/FloorClickCatcher.tsx`**

```tsx
import type { ThreeEvent } from '@react-three/fiber'
import { BUILDING } from '../scene/layout'
import { useCharacterStore } from './characterStore'

export function FloorClickCatcher() {
  const width = BUILDING.maxX - BUILDING.minX
  const depth = BUILDING.maxZ - BUILDING.minZ

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    useCharacterStore.getState().clickFloor([event.point.x, 0, event.point.z])
  }

  return (
    <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/character/FloorClickCatcher.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/character/FloorClickCatcher.tsx src/character/FloorClickCatcher.test.tsx
git commit -m "feat: add floor click-to-move catcher"
```

---

### Task 9: Character render component

**Files:**
- Create: `src/character/Character.tsx`

**Interfaces:**
- Consumes: `useCharacterStore` (Task 5), `stepTowards` (Task 3).
- Produces: `Character()` — no props, loads its own GLTF assets. Consumed by `Office.tsx` (Task 10).

No test file — this is the GLTF-loading, real-asset piece that `@react-three/test-renderer` cannot exercise (same class of problem as `OfficeMaterialsProvider`/`Lighting` in the base office plan). Its two non-trivial pieces of logic (`stepTowards`, `nextState`) are already fully unit-tested in Tasks 3–4; this component is verified via `tsc`/`vite build`/manual `npm run dev`.

- [ ] **Step 1: Implement `src/character/Character.tsx`**

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'

const WALK_SPEED = 1.4
const SIT_SETTLE_MS = 1000
const BREW_MS = 3500

const CLIP_URLS = {
  idle: '/character/idle.glb',
  walk: '/character/walk.glb',
  sit: '/character/sit.glb',
  type: '/character/type.glb',
  drink: '/character/drink.glb',
} as const

const ANIMATION_FOR_STATE: Record<string, keyof typeof CLIP_URLS> = {
  idle: 'idle',
  walking: 'walk',
  sittingDown: 'sit',
  working: 'type',
  brewingCoffee: 'idle',
  drinkingCoffee: 'drink',
}

export function Character() {
  const base = useGLTF(CLIP_URLS.idle)
  const walk = useGLTF(CLIP_URLS.walk)
  const sit = useGLTF(CLIP_URLS.sit)
  const type = useGLTF(CLIP_URLS.type)
  const drink = useGLTF(CLIP_URLS.drink)

  const clips = useMemo(
    () => [base.animations[0], walk.animations[0], sit.animations[0], type.animations[0], drink.animations[0]],
    [base, walk, sit, type, drink],
  )

  const group = useRef<Group>(null)
  const { actions } = useAnimations(clips, group)

  const stateKind = useCharacterStore((s) => s.state.kind)

  useEffect(() => {
    const clipName = ANIMATION_FOR_STATE[stateKind] ?? 'idle'
    const action = actions[clipName]
    action?.reset().fadeIn(0.3).play()
    return () => {
      action?.fadeOut(0.3)
    }
  }, [stateKind, actions])

  useEffect(() => {
    if (stateKind === 'sittingDown') {
      const timer = setTimeout(() => useCharacterStore.getState().dispatch({ type: 'SETTLE_ELAPSED' }), SIT_SETTLE_MS)
      return () => clearTimeout(timer)
    }
    if (stateKind === 'brewingCoffee') {
      const timer = setTimeout(() => useCharacterStore.getState().dispatch({ type: 'BREW_ELAPSED' }), BREW_MS)
      return () => clearTimeout(timer)
    }
  }, [stateKind])

  useFrame((_, delta) => {
    const store = useCharacterStore.getState()
    if (store.state.kind === 'walking') {
      const target = store.state.path[store.state.nextIndex]
      const result = stepTowards(store.position, target, WALK_SPEED, delta, store.rotationY)
      store.setTransform(result.position, result.rotationY)
      if (result.reachedTarget) store.dispatch({ type: 'WAYPOINT_REACHED' })
    }
    if (group.current) {
      group.current.position.set(...store.position)
      group.current.rotation.y = store.rotationY
    }
  })

  return (
    <group ref={group}>
      <primitive object={base.scene} />
    </group>
  )
}

useGLTF.preload(CLIP_URLS.idle)
useGLTF.preload(CLIP_URLS.walk)
useGLTF.preload(CLIP_URLS.sit)
useGLTF.preload(CLIP_URLS.type)
useGLTF.preload(CLIP_URLS.drink)
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/character/Character.tsx
git commit -m "feat: add Character render component (GLTF load, animation mixer, movement)"
```

---

### Task 10: Wire the character into the office

**Files:**
- Modify: `src/scene/Office.tsx`
- Modify: `src/scene/Office.test.tsx`
- Modify: `src/rooms/OpenSpace.tsx`
- Modify: `src/rooms/FocusRoom.tsx`
- Modify: `src/rooms/Kitchen.tsx`

**Interfaces:**
- Modifies: `OfficeProps` gains `CharacterComponent?: ComponentType` (defaults to the real `Character`, same injectable pattern as `MaterialsProvider`/`LightingComponent`).

- [ ] **Step 1: Update the failing test for `Office`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { SceneLights } from './lighting/Lighting'
import { Office } from './Office'

describe('Office', () => {
  it('mounts the full building with all 7 rooms, the camera, and the character without throwing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Office MaterialsProvider={StubMaterialsProvider} LightingComponent={SceneLights} CharacterComponent={() => null} />,
    )
    await renderer.advanceFrames(2, 16)
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(400)
    expect(renderer.scene.findAllByType('OrthographicCamera').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/Office.test.tsx`
Expected: FAIL — `Office` doesn't accept a `CharacterComponent` prop yet (TypeScript error) / test passes a prop that has no effect.

- [ ] **Step 3: Update `src/scene/Office.tsx`**

```tsx
import { Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { OfficeMaterialsProvider } from '../materials/OfficeMaterialsProvider'
import { IsometricCamera } from './camera/IsometricCamera'
import { Lighting } from './lighting/Lighting'
import { Building } from './Building'
import { OpenSpace } from '../rooms/OpenSpace'
import { MeetingRoom } from '../rooms/MeetingRoom'
import { FocusRoom } from '../rooms/FocusRoom'
import { ServerRoom } from '../rooms/ServerRoom'
import { CeoOffice } from '../rooms/CeoOffice'
import { Kitchen } from '../rooms/Kitchen'
import { GameRoom } from '../rooms/GameRoom'
import { Character } from '../character/Character'
import { FloorClickCatcher } from '../character/FloorClickCatcher'

export interface OfficeProps {
  MaterialsProvider?: ComponentType<{ children: ReactNode }>
  LightingComponent?: ComponentType
  CharacterComponent?: ComponentType
}

export function Office({
  MaterialsProvider = OfficeMaterialsProvider,
  LightingComponent = Lighting,
  CharacterComponent = Character,
}: OfficeProps) {
  return (
    <Suspense fallback={null}>
      <MaterialsProvider>
        <IsometricCamera />
        <LightingComponent />
        <Building />
        <FloorClickCatcher />
        <OpenSpace />
        <MeetingRoom />
        <FocusRoom />
        <ServerRoom />
        <CeoOffice />
        <Kitchen />
        <GameRoom />
        <CharacterComponent />
      </MaterialsProvider>
    </Suspense>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/Office.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Wire workstation clicks in `src/rooms/OpenSpace.tsx`**

Replace the `Workstation` usage inside `WorkstationCluster` — add the import and the `onSelect` prop:

```tsx
import { Workstation } from '../furniture/Workstation'
import { Plant } from '../furniture/Plant'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Signage } from '../furniture/Signage'
import { TrackLight } from '../furniture/TrackLight'
import { AcousticCeilingPanel } from '../furniture/AcousticCeilingPanel'
import { useCharacterStore } from '../character/characterStore'
import { ROOMS, roomCenter } from '../scene/layout'

const CLUSTER_CENTERS: [number, number][] = [
  [-3, -4],
  [3, -4],
  [-3, 4],
  [3, 4],
]
const CLUSTER_DESK_OFFSETS: [number, number][] = [
  [-1.1, -0.9],
  [1.1, -0.9],
  [-1.1, 0.9],
  [1.1, 0.9],
]
const CHAIR_COLORS = ['#c0392b', '#2166c9', '#2f9e59', '#e0a72b']

function WorkstationCluster({ center }: { center: [number, number] }) {
  return (
    <group position={[center[0], 0, center[1]]}>
      {CLUSTER_DESK_OFFSETS.map(([dx, dz], i) => (
        <Workstation
          key={i}
          position={[dx, 0, dz]}
          chairColor={CHAIR_COLORS[i % CHAIR_COLORS.length]}
          onSelect={(target) => useCharacterStore.getState().clickWorkstation(target)}
        />
      ))}
    </group>
  )
}
```

(The rest of `OpenSpace.tsx` — `PLANT_POSITIONS`, the `OpenSpace` component itself — is unchanged.)

- [ ] **Step 6: Wire workstation clicks in `src/rooms/FocusRoom.tsx`**

Add the `onSelect` prop to both `Workstation` instances:

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { Workstation } from '../furniture/Workstation'
import { useCharacterStore } from '../character/characterStore'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function FocusRoom() {
  const bounds = ROOMS.focusRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)
  const onSelect = (target: TriggerTarget) => useCharacterStore.getState().clickWorkstation(target)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[width / 2, 0, 0]} />
      <Wall
        axis="x"
        length={width}
        center={[0, 1.4, depth / 2]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: width / 2, width: 0.9 }}
      />
      <Workstation position={[-1.5, 0, 0]} chairColor="#5c6b78" onSelect={onSelect} />
      <Workstation position={[1.5, 0, 0]} rotation={[0, Math.PI, 0]} chairColor="#5c6b78" onSelect={onSelect} />
    </group>
  )
}
```

- [ ] **Step 7: Wire the coffee machine click in `src/rooms/Kitchen.tsx`**

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { KitchenIsland } from '../furniture/KitchenIsland'
import { CoffeeMachine } from '../furniture/CoffeeMachine'
import { BarStool } from '../furniture/BarStool'
import { Fridge } from '../furniture/Fridge'
import { Plant } from '../furniture/Plant'
import { useCharacterStore } from '../character/characterStore'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const STOOL_X = [-0.7, 0, 0.7]

export function Kitchen() {
  const bounds = ROOMS.kitchen
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <Wall
        axis="x"
        length={width}
        center={[0, 1.4, depth / 2]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: width / 2, width: 0.9 }}
      />
      <KitchenIsland position={[0, 0, -0.6]} />
      <CoffeeMachine
        position={[0.7, 0.9, -0.6]}
        onSelect={(target) => useCharacterStore.getState().clickCoffeeMachine(target)}
      />
      {STOOL_X.map((x) => (
        <BarStool key={x} position={[x, 0, 0.3]} />
      ))}
      <Fridge position={[width / 2 - 0.5, 0, depth / 2 - 0.5]} />
      <Plant position={[-width / 2 + 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
```

- [ ] **Step 8: Run the full test suite and type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; every test passes (existing office suite + this plan's new tests, with `Workstation`/`CoffeeMachine`/`Office` tests reflecting their updated mesh counts and props).

- [ ] **Step 9: Verify production build**

Run: `npx vite build`
Expected: `✓ built in ...ms`, no errors.

- [ ] **Step 10: Commit**

```bash
git add src/scene/Office.tsx src/scene/Office.test.tsx src/rooms/OpenSpace.tsx src/rooms/FocusRoom.tsx src/rooms/Kitchen.tsx
git commit -m "feat: wire Character, FloorClickCatcher, and all clickable furniture into the office"
```

---

### Task 11: Final verification and README

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — documentation and final checks only.

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: all three succeed.

- [ ] **Step 2: Update `README.md`**

Add a new section (after "Run it"):

```markdown
## The character

Click anywhere on the floor to walk there. Click any workstation to walk
over, sit, and start typing. Click the coffee machine to walk over, brew,
and drink. Clicking a new target at any time interrupts whatever the
character is doing and walks to the new one.
```

Also add, near "Known limitation":

```markdown
The character's walking direction was tuned from the Mixamo model's
apparent forward axis without a live render to confirm it (see
`src/character/movement.ts` — `Math.atan2(dx, dz)` assumes the model faces
+Z at identity rotation). If the character walks backward, that function is
the one place to flip.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the office character controls"
```

- [ ] **Step 4: Manual visual check**

Run `npm run dev`, open the printed URL, and click a workstation, then the
coffee machine, then empty floor in a different room, to confirm the walk /
sit / type / brew / drink sequence looks right end-to-end. This is the one
check nothing in this plan can automate — see the base office plan's
screenshot workflow (Playwright + headless Chromium + `preserveDrawingBuffer`)
if a live human isn't available to look at it.
