# Cinematic Cutscene Camera & Real Guard Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the shipped `security-breach` cutscene from an isometric-camera zoom to a real cinematic sequence: a swappable perspective camera for scenes, the real `security_1`/`security_2` guard models replacing placeholder boxes, and restaged blocking (PM explicitly seated at a real desk before leaving it with the monitor lit, player already seated before the office reveal).

**Architecture:** A second, always-mounted `PerspectiveCamera` rig becomes R3F's active camera only while a cutscene runs (toggled via a shared `useCutsceneCameraStore` flag), leaving the isometric `OrthographicCamera`'s orbited state untouched underneath. `CutsceneDirector` gains `spawnModeledActor`/`look`/`sit`, built entirely on the character machine's existing walk/settle mechanics plus one new generic `looking` state (mirrors the existing `talking` state).

**Tech Stack:** React Three Fiber, drei (`PerspectiveCamera`, `CameraControls`), `camera-controls`, zustand v5, TypeScript, `fbx2gltf`/`@gltf-transform` (existing conversion pipeline).

## Global Constraints

- Per `AGENTS.md`: **NO TESTS** — no new automated tests; verify every task by running `tsc`/`vite build` plus a live Playwright-driven check of actual behavior, same as the rest of this feature.
- Per `AGENTS.md`: **KISS / NO MOCK FEATURES** — reuse the existing character machine/pathfinding/dialogue systems; the only genuinely new mechanism is the camera swap, because it's the only way to get real cinematic depth.
- Existing tests must keep passing (`npx vitest run`) even though none are added — `characterMachine.test.ts` in particular touches a file this plan modifies.
- Guard `CharacterDefinition`s are **not** added to `CHARACTERS`/`NPC_CHARACTERS` in `src/character/characters/index.ts` — they have no autonomous office life, only ever spawned by a cutscene.
- All camera/blocking coordinates below are starting values, tuned by eye against real screenshots during implementation — same practice as every other camera beat already shipped in this project.
- `security-breach` is still only triggered via the existing dev-only `window.__startCutscene('security-breach')` hook — no change to real trigger wiring in this plan.

---

## Task 1: Convert the guard animation assets

**Files:**
- Modify: `scripts/convert-character.mjs:13-29` (the `ALL_CLIPS` array)

**Interfaces:**
- Produces: `public/character/security_1/{idle,walk,talk,look}.glb` and `public/character/security_2/{idle,walk,talk,look}.glb`. Consumed by Task 3's `CharacterDefinition`s.

The source FBX files already exist at `character-source/security/security_1_standing_idle.fbx`, `security_1_walking.fbx`, `security_1_talking.fbx`, `security_1_looking_down.fbx`, and the `security_2_*` equivalents (`security_2_looking_around.fbx` instead of `_looking_down`). Nothing needs to be added to `character-source/` — only the conversion config and running the script.

- [ ] **Step 1: Add the guard entries to `ALL_CLIPS`**

Append these 8 entries to the `ALL_CLIPS` array in `scripts/convert-character.mjs` (right after the existing `female_pm` entries, before the closing `]`):

```js
  { file: 'security/security_1_standing_idle', name: 'idle', out: 'security_1/idle', keepMesh: true },
  { file: 'security/security_1_walking', name: 'walk', out: 'security_1/walk' },
  { file: 'security/security_1_talking', name: 'talk', out: 'security_1/talk' },
  { file: 'security/security_1_looking_down', name: 'look', out: 'security_1/look' },
  { file: 'security/security_2_standing_idle', name: 'idle', out: 'security_2/idle', keepMesh: true },
  { file: 'security/security_2_walking', name: 'walk', out: 'security_2/walk' },
  { file: 'security/security_2_talking', name: 'talk', out: 'security_2/talk' },
  { file: 'security/security_2_looking_around', name: 'look', out: 'security_2/look' },
```

- [ ] **Step 2: Run the conversion for just the new entries**

```bash
node scripts/convert-character.mjs security
```

The script's existing CLI filter (`c.file.includes(r) || c.out.includes(r) || c.name === r`) matches all 8 new entries by the `security/` substring in their `file` path and does not touch the existing `business_man`/`female_pm` entries.

Expected: 8 lines like `[security_1/idle] wrote .../public/character/security_1/idle.glb (NN KB)`, ending in `done`. If it throws `Hips node not found`, stop and report — it would mean these FBX rigs use a different bone-naming convention than the existing Mixamo-sourced characters, which needs a real fix, not a workaround.

- [ ] **Step 3: Verify the output files exist**

```bash
ls public/character/security_1/ public/character/security_2/
```

Expected: `idle.glb`, `walk.glb`, `talk.glb`, `look.glb` in both directories.

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-character.mjs public/character/security_1 public/character/security_2
git commit -m "feat: convert security guard animation assets"
```

---

## Task 2: Add the `look` clip type and `looking` character-machine state

**Files:**
- Modify: `src/character/characters/definition.ts:4`
- Modify: `src/character/characterMachine.ts:15-24` (state union), `:26-36` (event union), `:66-69` (switch cases)
- Modify: `src/character/CharacterModel.tsx:12-35` (`CLIP_FOR_STATE`/`CLIP_FALLBACKS`)

**Interfaces:**
- Produces: `ClipName` gains `'look'`; `CharacterState` gains `{ kind: 'looking' }`; `CharacterEvent` gains `{ type: 'LOOK_START' }` / `{ type: 'LOOK_END' }`. Consumed by Task 3 (guard clip config), Task 5 (`director.look`).

This is a pure additive change mirroring the existing `talking`/`TALK_START`/`TALK_END` pattern exactly — no existing state, event, or clip mapping is altered.

- [ ] **Step 1: Add `'look'` to `CLIP_NAMES`**

In `src/character/characters/definition.ts`, change:

```ts
export const CLIP_NAMES = ['idle', 'walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit', 'talk'] as const
```

to:

```ts
export const CLIP_NAMES = ['idle', 'walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit', 'talk', 'look'] as const
```

- [ ] **Step 2: Add the `looking` state and `LOOK_START`/`LOOK_END` events**

In `src/character/characterMachine.ts`, change the `CharacterState` union:

```ts
export type CharacterState =
  | { kind: 'idle' }
  | { kind: 'walking'; path: Point[]; nextIndex: number; onArrive: ArrivalGoal }
  | { kind: 'sittingDown'; target: Target }
  | { kind: 'working'; target: Target }
  | { kind: 'brewingCoffee'; target: Target }
  | { kind: 'drinkingCoffee'; target: Target }
  | { kind: 'sittingIdle'; target: Target }
  | { kind: 'sofaSitting'; target: Target }
  | { kind: 'talking' }
  | { kind: 'looking' }
```

and the `CharacterEvent` union:

```ts
export type CharacterEvent =
  | { type: 'CLICK_FLOOR'; point: Point }
  | { type: 'CLICK_WORKSTATION'; target: Target }
  | { type: 'CLICK_COFFEE_MACHINE'; target: Target }
  | { type: 'CLICK_SEAT'; target: Target }
  | { type: 'CLICK_SOFA'; target: Target }
  | { type: 'WAYPOINT_REACHED' }
  | { type: 'SETTLE_ELAPSED' }
  | { type: 'BREW_ELAPSED' }
  | { type: 'TALK_START' }
  | { type: 'TALK_END' }
  | { type: 'LOOK_START' }
  | { type: 'LOOK_END' }
```

and add two cases to the `switch` in `nextState` (right after the existing `TALK_END` case):

```ts
    case 'TALK_START':
      return { kind: 'talking' }
    case 'TALK_END':
      return current.kind === 'talking' ? { kind: 'idle' } : current
    case 'LOOK_START':
      return { kind: 'looking' }
    case 'LOOK_END':
      return current.kind === 'looking' ? { kind: 'idle' } : current
```

- [ ] **Step 3: Map the `looking` state to the `look` clip**

In `src/character/CharacterModel.tsx`, change `CLIP_FOR_STATE`:

```ts
const CLIP_FOR_STATE: Record<string, ClipName> = {
  idle: 'idle',
  walking: 'walk',
  sittingDown: 'sit',
  working: 'type',
  brewingCoffee: 'idle',
  drinkingCoffee: 'drink',
  sittingIdle: 'sitIdle',
  sofaSitting: 'sofaSit',
  talking: 'talk',
  looking: 'look',
}
```

and `CLIP_FALLBACKS` (a character with no `look` clip just stays idle):

```ts
const CLIP_FALLBACKS: Record<ClipName, ClipName[]> = {
  idle: [],
  walk: ['idle'],
  sit: ['sitIdle', 'idle'],
  type: ['sitIdle', 'idle'],
  drink: ['idle'],
  sitIdle: ['sit', 'idle'],
  sofaSit: ['sitIdle', 'idle'],
  talk: ['idle'],
  look: ['idle'],
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both clean — `characterMachine.test.ts` still passes unchanged (its `TALK_START`/`TALK_END` test is untouched; nothing exercises `LOOK_START`/`LOOK_END` yet, which is fine, this task adds no automated tests per the Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add src/character/characters/definition.ts src/character/characterMachine.ts src/character/CharacterModel.tsx
git commit -m "feat: add generic 'looking' character state and 'look' clip type"
```

---

## Task 3: Guard character definitions

**Files:**
- Create: `src/character/characters/security1.ts`
- Create: `src/character/characters/security2.ts`

**Interfaces:**
- Consumes: `ClipName` including `'look'` (Task 2), converted GLB files (Task 1).
- Produces: `security1: CharacterDefinition`, `security2: CharacterDefinition` (`id: 'security-1'`/`'security-2'`). Imported directly by file path wherever needed (matching how `femalePm` is imported directly, not via `characters/index.ts`) — used by Task 6's `securityBreach.ts`.

- [ ] **Step 1: Create `security1.ts`**

```ts
// src/character/characters/security1.ts
import type { CharacterDefinition } from './definition'

// Cutscene-only actor - not part of the autonomous NPC roster (no
// npc/persona field). Spawned and despawned directly by whichever scene
// needs him; never listed in characters/index.ts's CHARACTERS array.
export const security1: CharacterDefinition = {
  id: 'security-1',
  displayName: 'Охранник 1',
  model: {
    clips: {
      idle: '/character/security_1/idle.glb',
      walk: '/character/security_1/walk.glb',
      talk: '/character/security_1/talk.glb',
      look: '/character/security_1/look.glb',
    },
  },
}
```

- [ ] **Step 2: Create `security2.ts`**

```ts
// src/character/characters/security2.ts
import type { CharacterDefinition } from './definition'

export const security2: CharacterDefinition = {
  id: 'security-2',
  displayName: 'Охранник 2',
  model: {
    clips: {
      idle: '/character/security_2/idle.glb',
      walk: '/character/security_2/walk.glb',
      talk: '/character/security_2/talk.glb',
      look: '/character/security_2/look.glb',
    },
  },
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: clean. There's no runtime consumer yet (Task 6 wires these into the scene) — a full visual check happens then.

- [ ] **Step 4: Commit**

```bash
git add src/character/characters/security1.ts src/character/characters/security2.ts
git commit -m "feat: security1/security2 character definitions"
```

---

## Task 4: Cutscene camera swap system

**Files:**
- Modify: `src/scene/camera/cameraController.ts` (full rewrite)
- Modify: `src/scene/camera/IsometricCamera.tsx` (full rewrite)
- Create: `src/scene/camera/CutsceneCamera.tsx`
- Modify: `src/scene/Office.tsx` (mount `CutsceneCamera`)
- Modify: `src/cutscenes/CutsceneRunner.tsx:1-7` (imports), `:26-27` (enter), `:39-40` (exit)

**Interfaces:**
- Produces: `useCutsceneCameraStore` (`{ active: boolean }`), `registerCutsceneCameraControls(instance)`, `enterCutsceneCamera()`, `exitCutsceneCamera()`, `flyTo(target, position?, durationMs?)` (now drives the cutscene rig, not the isometric one). `<CutsceneCamera />` component. Used by Task 5's `director.camera` (unchanged call site, new target) and by `CutsceneRunner`.
- **Removes:** `registerCameraControls`, `setInputEnabled` — nothing calls them once `IsometricCamera` derives its own enabled/default state reactively from `useCutsceneCameraStore`. `Point` type stays exported from this file (already used elsewhere).

- [ ] **Step 1: Replace `cameraController.ts`**

```ts
// src/scene/camera/cameraController.ts
import { create } from 'zustand'
import { Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'

export type Point = [number, number, number]

let cutsceneControls: CameraControlsImpl | null = null
const tmpPosition = new Vector3()

// Whether the cutscene camera is the one currently rendered. IsometricCamera
// reads this to yield makeDefault/enabled to the cutscene rig without ever
// unmounting - so its own orbited position survives a cutscene untouched.
export const useCutsceneCameraStore = create<{ active: boolean }>()(() => ({ active: false }))

// CutsceneCamera registers its live CameraControls instance here so the
// cutscene director can command it without prop-drilling a ref through the
// scene graph.
export function registerCutsceneCameraControls(instance: CameraControlsImpl | null): void {
  cutsceneControls = instance
}

export function enterCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: true })
}

export function exitCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: false })
}

// Smoothly moves the cutscene camera to look at `target` from `position`
// (defaults to its current position, so a scene can re-aim without
// relocating it). Resolves once the transition finishes - camera-controls'
// own setLookAt already returns that promise. durationMs temporarily
// overrides the controls' smoothTime for just this move, then restores it.
export async function flyTo(target: Point, position?: Point, durationMs = 1500): Promise<void> {
  if (!cutsceneControls) return
  const [px, py, pz] = position ?? cutsceneControls.getPosition(tmpPosition).toArray()
  const [tx, ty, tz] = target
  const previousSmoothTime = cutsceneControls.smoothTime
  cutsceneControls.smoothTime = Math.max(0.01, durationMs / 1000)
  try {
    await cutsceneControls.setLookAt(px, py, pz, tx, ty, tz, true)
  } finally {
    cutsceneControls.smoothTime = previousSmoothTime
  }
}
```

- [ ] **Step 2: Replace `IsometricCamera.tsx`**

```tsx
// src/scene/camera/IsometricCamera.tsx
import { useCallback } from 'react'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'
import { BUILDING } from '../layout'
import { useCutsceneCameraStore } from './cameraController'

const CAMERA_POSITION: [number, number, number] = [22, 26, 22]
const CAMERA_TARGET: [number, number, number] = [0, 0.8, 0]
const PAN_PADDING = 3

// Keeps orbiting free of the building's footprint - the target can pan
// anywhere inside, but not drift off into empty space while orbiting.
const PAN_BOUNDARY = new Box3(
  new Vector3(BUILDING.minX - PAN_PADDING, 0, BUILDING.minZ - PAN_PADDING),
  new Vector3(BUILDING.maxX + PAN_PADDING, BUILDING.wallHeight, BUILDING.maxZ + PAN_PADDING),
)

export function IsometricCamera() {
  // Yields makeDefault/enabled to the cutscene camera while one is active -
  // this rig is never unmounted, so its orbited setLookAt state is exactly
  // where the player left it once a cutscene ends.
  const cutsceneActive = useCutsceneCameraStore((s) => s.active)

  // A callback ref (not useEffect + useRef) because CameraControls' internal
  // camera-controls instance is recreated once OrthographicCamera's makeDefault
  // effect swaps in the real camera (its first instance briefly wraps R3F's
  // stock default camera) — a one-shot effect would orient that discarded
  // instance and leave the real one at its identity rotation.
  const attachControls = useCallback((instance: CameraControlsImpl | null) => {
    instance?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false)
    instance?.setBoundary(PAN_BOUNDARY)
  }, [])

  return (
    <>
      <OrthographicCamera makeDefault={!cutsceneActive} position={CAMERA_POSITION} zoom={28} near={0.1} far={150} />
      <CameraControls
        ref={attachControls}
        makeDefault={!cutsceneActive}
        enabled={!cutsceneActive}
        minZoom={12}
        maxZoom={70}
        minPolarAngle={0.3}
        maxPolarAngle={1.4}
        minDistance={14}
        maxDistance={75}
        boundaryFriction={0.9}
      />
    </>
  )
}
```

- [ ] **Step 3: Create `CutsceneCamera.tsx`**

```tsx
// src/scene/camera/CutsceneCamera.tsx
import { useCallback, useState } from 'react'
import { PerspectiveCamera, CameraControls } from '@react-three/drei'
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import type CameraControlsImpl from 'camera-controls'
import { registerCutsceneCameraControls, useCutsceneCameraStore } from './cameraController'

// Dedicated cutscene camera: a perspective rig (real depth/dramatic angle,
// which the gameplay OrthographicCamera can never produce) that becomes
// R3F's active camera only while a scripted scene is running. Mounted once
// alongside IsometricCamera and never unmounted, so toggling `active` is a
// clean swap rather than a remount that would reset either rig.
export function CutsceneCamera() {
  const active = useCutsceneCameraStore((s) => s.active)
  // CameraControls needs an explicit `camera` prop here - two rigs exist at
  // once (this one and IsometricCamera's), so it cannot rely on "whichever
  // camera is currently ambient-default." A state-backed ref (not a plain
  // useRef) is required because <CameraControls> can't mount until the
  // camera instance exists.
  const [camera, setCamera] = useState<PerspectiveCameraImpl | null>(null)
  const attachControls = useCallback((instance: CameraControlsImpl | null) => {
    registerCutsceneCameraControls(instance)
  }, [])

  return (
    <>
      <PerspectiveCamera ref={setCamera} makeDefault={active} position={[0, 2, 6]} fov={40} near={0.05} far={100} />
      {camera && <CameraControls ref={attachControls} camera={camera} enabled={false} />}
    </>
  )
}
```

- [ ] **Step 4: Mount `CutsceneCamera` in `Office.tsx`**

Add the import:

```ts
import { CutsceneCamera } from './camera/CutsceneCamera'
```

Add `<CutsceneCamera />` right after `<IsometricCamera />`:

```tsx
        <IsometricCamera />
        <CutsceneCamera />
        <LightingComponent />
```

- [ ] **Step 5: Update `CutsceneRunner.tsx` to use the new enter/exit calls**

Change the import (drop `setInputEnabled`, add the two new functions):

```tsx
import { enterCutsceneCamera, exitCutsceneCamera } from '../scene/camera/cameraController'
```

Change the `setInputEnabled(false)` call (right after `running.current = activeSceneId`) to:

```tsx
    enterCutsceneCamera()
```

Change the `setInputEnabled(true)` call (in the `.finally()` block) to:

```tsx
        exitCutsceneCamera()
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```

Expected: all clean.

Manual check via the dev server (start it, use a Playwright script driving the browser through `window.__startCutscene('security-breach')` — the scene will look broken/unfinished until Task 6 restages it, that's expected here):
- Confirm the moment the scene starts, the rendered view visibly changes (a perspective shot, not the isometric lift) even though nothing in the scene has been restaged yet to use it meaningfully.
- Confirm that after the scene ends (or errors out, which it will until Task 6 lands, since `director.spawnActor`/`walk` calls in the still-old `securityBreach.ts` are unaffected by this task), the isometric camera reappears and can still be dragged/orbited.
- Before triggering, orbit the isometric camera to a non-default position, then trigger and let the scene finish - confirm the isometric camera is back at that same non-default position afterward (not reset to the default framing).

- [ ] **Step 7: Commit**

```bash
git add src/scene/camera/cameraController.ts src/scene/camera/IsometricCamera.tsx src/scene/camera/CutsceneCamera.tsx src/scene/Office.tsx src/cutscenes/CutsceneRunner.tsx
git commit -m "feat: swappable perspective camera for cutscenes"
```

---

## Task 5: Director support for modeled actors, looking, and sitting

**Files:**
- Modify: `src/cutscenes/types.ts` (add three `CutsceneDirector` members)
- Modify: `src/cutscenes/cutsceneStore.ts` (full rewrite — actor union)
- Modify: `src/cutscenes/director.ts` (add `waitForSeated` + three methods)
- Modify: `src/cutscenes/CutsceneRunner.tsx` (render swap on actor kind)

**Interfaces:**
- Consumes: `CharacterDefinition` (`src/character/characters/definition.ts`), `security1`/`security2` (Task 3, for later manual verification), `'looking'` state (Task 2).
- Produces: `CutsceneDirector.spawnModeledActor(id, at, definition, rotationY?)`, `.look(characterId, on)`, `.sit(characterId, target, kind)`. Used by Task 6's restaged `securityBreach.ts`.

- [ ] **Step 1: Add the three members to `CutsceneDirector`**

In `src/cutscenes/types.ts`, add the import:

```ts
import type { CharacterDefinition } from '../character/characters/definition'
```

Add three members to the `CutsceneDirector` interface (after `spawnActor`, before `despawnActor`):

```ts
  spawnActor(id: string, at: Point, rotationY?: number, color?: string): void
  spawnModeledActor(id: string, at: Point, definition: CharacterDefinition, rotationY?: number): void
  look(characterId: string, on: boolean): void
  sit(characterId: string, target: { point: Point; facing: number }, kind: 'workstation' | 'seat'): Promise<void>
  despawnActor(id: string): void
```

- [ ] **Step 2: Replace `cutsceneStore.ts`**

```ts
// src/cutscenes/cutsceneStore.ts
import { create } from 'zustand'
import type { CharacterDefinition } from '../character/characters/definition'

type SceneActor = { kind: 'placeholder'; color: string } | { kind: 'model'; definition: CharacterDefinition }

interface CutsceneStore {
  activeSceneId: string | null
  // ephemeral scene-only actors currently spawned, keyed by character id
  actors: Record<string, SceneActor>
  startScene: (id: string) => void
  endScene: () => void
  upsertActor: (id: string, color: string) => void
  upsertModeledActor: (id: string, definition: CharacterDefinition) => void
  removeActor: (id: string) => void
}

export const useCutsceneStore = create<CutsceneStore>()((set) => ({
  activeSceneId: null,
  actors: {},
  // ignored while a scene is already running - this project has no scene
  // queueing/interruption, only one scene plays at a time
  startScene: (id) =>
    set((s) => {
      if (s.activeSceneId) return s
      return { activeSceneId: id, actors: {} }
    }),
  endScene: () => set({ activeSceneId: null, actors: {} }),
  upsertActor: (id, color) => set((s) => ({ actors: { ...s.actors, [id]: { kind: 'placeholder', color } } })),
  upsertModeledActor: (id, definition) =>
    set((s) => ({ actors: { ...s.actors, [id]: { kind: 'model', definition } } })),
  removeActor: (id) =>
    set((s) => {
      const actors = { ...s.actors }
      delete actors[id]
      return { actors }
    }),
}))
```

- [ ] **Step 3: Add the director implementations**

In `src/cutscenes/director.ts`, add a `waitForSeated` helper right after the existing `waitForIdle` function:

```ts
function waitForSeated(characterId: string): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => {
      const kind = useCharacterStore.getState().characters[characterId]?.state.kind
      return kind === undefined || kind === 'working' || kind === 'sittingIdle'
    }
    if (isDone()) {
      resolve()
      return
    }
    const unsubscribe = useCharacterStore.subscribe(() => {
      if (!isDone()) return
      unsubscribe()
      resolve()
    })
  })
}
```

Add three methods to the object `createDirector` returns (right after `spawnActor`, before `despawnActor`):

```ts
    spawnModeledActor(id, at, definition, rotationY = 0) {
      useCharacterStore.getState().spawnCharacter(id, at, rotationY)
      useCutsceneStore.getState().upsertModeledActor(id, definition)
    },
    look(characterId, on) {
      useCharacterStore.getState().dispatchTo(characterId, { type: on ? 'LOOK_START' : 'LOOK_END' })
    },
    sit(characterId, target, kind) {
      const eventType = kind === 'workstation' ? ('CLICK_WORKSTATION' as const) : ('CLICK_SEAT' as const)
      useCharacterStore.getState().dispatchTo(characterId, { type: eventType, target })
      return waitForSeated(characterId)
    },
```

- [ ] **Step 4: Render model-kind actors in `CutsceneRunner.tsx`**

Add the import:

```tsx
import { CharacterModel } from '../character/CharacterModel'
```

Replace the render's `.map(...)` body:

```tsx
      {Object.entries(actors).map(([id, actor]) =>
        actor.kind === 'model' ? (
          <CharacterModel key={id} characterId={id} config={actor.definition.model} />
        ) : (
          <PlaceholderActorModel key={id} characterId={id} color={actor.color} />
        ),
      )}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: both clean. No runtime consumer of `spawnModeledActor`/`look`/`sit` exists yet - Task 6 wires them in and is where this is exercised end-to-end.

- [ ] **Step 6: Commit**

```bash
git add src/cutscenes/types.ts src/cutscenes/cutsceneStore.ts src/cutscenes/director.ts src/cutscenes/CutsceneRunner.tsx
git commit -m "feat: director support for modeled actors, looking, and sitting"
```

---

## Task 6: Restage `securityBreach.ts` with real models and cinematic blocking

**Files:**
- Modify: `src/cutscenes/securityBreach.ts` (full rewrite)

**Interfaces:**
- Consumes: `security1`/`security2` (Task 3), `director.sit`/`.look`/`.spawnModeledActor` (Task 5), the cutscene camera (Task 4, via the unchanged `director.camera` call site).

World coordinates (verified against `OpenSpace.tsx`'s cluster grid and `CeoOffice.tsx`'s furniture positions, not invented):
- PM's designated workstation - the real desk nearest her spawn: chair at `[-1.9, 0, 4.35]`, monitor at `[-1.9, 0.7, 5.1]` (screen faces -z, toward the chair; desks in this layout are never individually rotated).
- Player's CaptainChair (`CeoOffice.tsx`): `[9, 0, -7.53]`, facing `0`.

The camera cut happens *first* in the PM's-desk beat (not after she's already seated) so the player watches her walk in and sit rather than seeing a flash of the cutscene camera's unpositioned default view before the first `director.camera` call lands.

- [ ] **Step 1: Replace `securityBreach.ts`**

```ts
// src/cutscenes/securityBreach.ts
import { PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { security1 } from '../character/characters/security1'
import { security2 } from '../character/characters/security2'
import { useGameStore } from '../game/gameStore'
import type { CutsceneScript, Point } from './types'

const PM_SEAT: Point = [-1.9, 0, 4.35]
const PM_DESK_CAMERA_TARGET: Point = [-1.9, 1.1, 4.7]
const PM_DESK_CAMERA_POSITION: Point = [-4.5, 1.6, 3.5]
const PM_AWAY_POINT: Point = [-2, 0, 2]
const GUARD1_SPAWN: Point = [-5, 0, 4]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 4.9]
const GUARD2_SPAWN: Point = [-5, 0, 6]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 5.4]

const PLAYER_SEAT: Point = [9, 0, -7.53]
const OFFICE_CAMERA_TARGET: Point = [9, 1.3, -7.53]
const OFFICE_CAMERA_POSITION: Point = [12.5, 1.6, -6]
const GUARD1_OFFICE_MARK: Point = [7.2, 0, -6.5]
const GUARD2_OFFICE_MARK: Point = [8.8, 0, -6.5]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK_CAMERA_TARGET, { position: PM_DESK_CAMERA_POSITION, durationMs: 1200 })
  await director.sit(femalePm.id, { point: PM_SEAT, facing: 0 }, 'workstation')
  await director.wait(800)
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnModeledActor('guard1', GUARD1_SPAWN, security1)
  director.spawnModeledActor('guard2', GUARD2_SPAWN, security2)
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  director.look('guard1', true)
  director.look('guard2', true)

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  director.look('guard1', false)
  director.look('guard2', false)

  await director.sit(PLAYER_ID, { point: PLAYER_SEAT, facing: 0 }, 'seat')

  await director.camera(OFFICE_CAMERA_TARGET, { position: OFFICE_CAMERA_POSITION, durationMs: 1200 })
  await Promise.all([director.walk('guard1', GUARD1_OFFICE_MARK), director.walk('guard2', GUARD2_OFFICE_MARK)])
  director.face('guard1', PLAYER_ID)
  director.face('guard2', PLAYER_ID)
  director.face(PLAYER_ID, 'guard1')
  director.talk(PLAYER_ID, true)
  director.talk('guard1', true)

  await director.say([
    {
      ...GUARD1,
      text: 'У вас в отделе только что нашли разблокированный компьютер без присмотра. Это прямое нарушение политики безопасности.',
    },
    { ...GUARD2, text: 'Мы обязаны сообщать о таком наверх. Но для начала хотим услышать вашу версию.' },
  ])

  const pick = await director.choice([
    { id: 'accept', label: 'Беру ответственность на себя, разберёмся.' },
    { id: 'blame', label: 'Это недосмотр PM, я тут ни при чём.' },
  ])

  if (pick === 'blame') {
    useGameStore.getState().addReprimand()
    await director.say([
      {
        ...GUARD1,
        text: 'Понятно. Только перекладывать ответственность на сотрудников — не лучшая черта для руководителя. Это мы тоже отметим.',
      },
    ])
  } else {
    await director.say([
      { ...GUARD1, text: 'Разумно. По крайней мере, вы не пытаетесь спихнуть вину на подчинённых — уже неплохо.' },
    ])
  }

  await director.say([
    {
      ...GUARD2,
      text: 'В качестве меры — отдел обязан регулярно проводить курсы по безопасности для сотрудников. Мы это проконтролируем.',
    },
  ])
  director.addTask({ id: 'security-training', text: 'Проводить курсы по безопасности (регулярно)', done: false })

  director.talk(PLAYER_ID, false)
  director.talk('guard1', false)
  director.despawnActor('guard1')
  director.despawnActor('guard2')
}
```

- [ ] **Step 2: Verify types, tests, build**

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```

Expected: all clean.

- [ ] **Step 3: Verify end-to-end (live, both choice branches)**

Start the dev server, reach `free` phase, trigger `window.__startCutscene('security-breach')`. Confirm, in order:
- The camera cuts to a close perspective shot of the PM's desk immediately (no flash of a default/unpositioned view).
- The PM (real skinned model, not a box) walks to that desk from wherever she was and sits, typing.
- After a beat, she stands and walks away - the monitor's lit screen (`screenEmissive`) stays visible in frame, empty chair.
- Both guards appear as their real `security_1`/`security_2` models (not boxes), walk to the desk, and play `looking_down`/`looking_around` simultaneously while their dialogue lines show.
- The camera cuts to the CEO office; the player is already seated in his chair the instant the cut lands (not walking in).
- Both guards walk into the office, face the player, dialogue and the accept/blame choice proceed exactly as before.
- Whiteboard/task-board effect and `reprimands` behave exactly as already verified for the shipped scene (`accept` → `reprimands` unchanged, `blame` → `+1`; both → the `security-training` task added).
- After the scene ends: guards despawn, the isometric camera reappears at whatever pan/zoom the player had before triggering, dragging it works again, floor clicks work again.

Use the same fresh-browser-context-per-branch Playwright approach already used to verify the shipped scene (a throwaway script under a scratch/tmp directory, not committed) rather than doing this by hand, given the multi-minute wall-clock time of a full run.

- [ ] **Step 4: Commit**

```bash
git add src/cutscenes/securityBreach.ts
git commit -m "feat: restage security-breach with real guard models and cinematic camera"
```
