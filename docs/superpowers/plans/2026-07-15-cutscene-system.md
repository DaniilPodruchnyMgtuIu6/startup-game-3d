# Scripted Cutscenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable scripted-cutscene engine (camera moves, character choreography, branching dialogue, side effects) and ship its first scene: two placeholder-box guards catching the PM's unlocked screen, confronting the player, ending in a mandatory recurring security-training duty.

**Architecture:** Scenes are plain async functions driven by a `director` object (`walk`, `camera`, `say`, `choice`, `talk`, `spawnActor`, `addTask`, ...) that a generic `CutsceneRunner` component executes. The director is implemented entirely on top of systems that already exist — `characterStore`'s pathfinding/state machine, `gameStore`'s dialogue queue, and the isometric camera's `CameraControls` — so no new movement, dialogue-rendering, or pathfinding code is written. Branching is ordinary `if`/`else` inside a scene's script.

**Tech Stack:** React Three Fiber, zustand v5 (curried `create<T>()(...)`), `camera-controls` (via drei `CameraControls`), TypeScript.

## Global Constraints

- Per `AGENTS.md`: **NO TESTS** — no new automated unit/component tests are written for this feature. Every task is verified by running `tsc`/`vite build` plus a manual or Playwright-driven check of actual behavior, matching how the project has verified UI features elsewhere.
- Per `AGENTS.md`: **NO MOCK FEATURES** — every piece of code built, including the placeholder-box guards, is fully functional (real movement, real state machine, real dialogue participation). Only the guards' *visuals* are a stand-in for a model that doesn't exist yet.
- Per `AGENTS.md`: **KISS** — reuse existing systems wherever possible (see Architecture above); do not build a declarative scene-graph interpreter, a generic "action queue," or any abstraction this one scene doesn't need.
- Existing tests must keep passing (`npx vitest run`) even though none are added — `characterStore.test.ts`, `gameStore.test.ts`, `TaskBoard.test.tsx`, `DialoguePanel.test.tsx` all touch files this plan modifies.
- Guard dialogue lines use `speaker: 'Охранник 1'` / `'Охранник 2'`, `speakerRole: 'Служба безопасности'`, no `portrait`.
- The first scene is triggered only via a dev-only `window.__startCutscene(id)` hook (`import.meta.env.DEV`). No real trigger condition is wired up in this plan.
- Camera-controls' `setLookAt(px, py, pz, tx, ty, tz, enableTransition?)` returns `Promise<void>`, resolving when the transition finishes — confirmed in `node_modules/camera-controls/dist/index.d.ts:765`. `CameraControls.smoothTime: number` (seconds) governs transition speed (`index.d.ts:294`).

---

## Task 1: Extract the shared character-transform hook

**Files:**
- Create: `src/character/useCharacterTransform.ts`
- Modify: `src/character/CharacterModel.tsx:1-16` (imports/consts), `src/character/CharacterModel.tsx:121-138` (the `useFrame` block)

**Interfaces:**
- Produces: `useCharacterTransform(characterId: string, group: RefObject<Group | null>): void` — per-frame walk integration + position/rotation application to `group`. Used by Task 2's `PlaceholderActorModel` and by `CharacterModel` itself.

This is a pure refactor — behavior must not change. `CharacterModel.tsx` currently does per-frame walking/pose integration inline; the guard boxes (Task 2) need that exact same logic without the skinned-mesh/animation machinery around it, so it's pulled into its own hook first.

- [ ] **Step 1: Create the hook**

```ts
// src/character/useCharacterTransform.ts
import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'

const WALK_SPEED = 1.4
// The downloaded sit/type clips reach for a lower surface than our desks. Lifting
// the seated pose closes most of the gap without visibly lifting off the chair.
const SEATED_LIFT = 0.05

// Per-frame walking integration and position/rotation application, shared by
// every rendered body (skinned models and placeholder boxes alike) so they
// all move through the exact same pathfinding/state machine loop.
export function useCharacterTransform(characterId: string, group: RefObject<Group | null>) {
  useFrame((_, delta) => {
    const store = useCharacterStore.getState()
    const entity = store.characters[characterId]
    if (!entity) return
    if (entity.state.kind === 'walking') {
      const target = entity.state.path[entity.state.nextIndex]
      const result = stepTowards(entity.position, target, WALK_SPEED, delta, entity.rotationY)
      store.setTransform(characterId, result.position, result.rotationY)
      if (result.reachedTarget) store.dispatchTo(characterId, { type: 'WAYPOINT_REACHED' })
    }
    if (group.current) {
      const seated =
        entity.state.kind === 'sittingDown' || entity.state.kind === 'working' || entity.state.kind === 'sittingIdle'
      const [x, y, z] = entity.position
      group.current.position.set(x, y + (seated ? SEATED_LIFT : 0), z)
      group.current.rotation.y = entity.rotationY
    }
  })
}
```

- [ ] **Step 2: Update `CharacterModel.tsx` to use it**

Replace the top of the file (lines 1-16) with:

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { Vector3, type Group, type Object3D } from 'three'
import { useCharacterStore } from './characterStore'
import { useCharacterTransform } from './useCharacterTransform'
import { buildHeldMug, disposeHeldProp } from './heldProps'
import type { CharacterModelConfig, ClipName } from './characters/definition'

const SIT_SETTLE_MS = 1000
const BREW_MS = 3500
```

(`useFrame` is no longer imported directly — nothing else in this file calls it. `stepTowards` is no longer imported here — it moved into the hook. `WALK_SPEED`/`SEATED_LIFT` are dropped from this file — they moved into the hook.)

Replace the `useFrame((_, delta) => { ... })` block (original lines 121-138) with a single line:

```tsx
  useCharacterTransform(characterId, group)
```

- [ ] **Step 3: Verify no behavior changed**

Run:
```bash
npx tsc --noEmit
npx vitest run
```
Expected: both clean (no new tests added; `movement.test.ts`, `characterStore.test.ts` etc. still pass unchanged). Then run `npx vite build` to confirm the production bundle still compiles.

Start the dev server (`npm run dev`) and manually click a workstation and a floor tile in the browser — the player must still walk and sit exactly as before. This is a refactor with no visible behavior change, so "looks identical to before" is the pass condition.

- [ ] **Step 4: Commit**

```bash
git add src/character/useCharacterTransform.ts src/character/CharacterModel.tsx
git commit -m "refactor: extract useCharacterTransform from CharacterModel"
```

---

## Task 2: Placeholder actor renderer

**Files:**
- Create: `src/character/PlaceholderActorModel.tsx`

**Interfaces:**
- Consumes: `useCharacterTransform(characterId, group)` from Task 1.
- Produces: `<PlaceholderActorModel characterId={string} color?={string} />` — a box-body stand-in for a character with no model yet. Used by Task 9's `CutsceneRunner`.

- [ ] **Step 1: Create the component**

```tsx
// src/character/PlaceholderActorModel.tsx
import { useRef } from 'react'
import type { Group } from 'three'
import { useCharacterTransform } from './useCharacterTransform'

export interface PlaceholderActorModelProps {
  characterId: string
  color?: string
}

// Stand-in body for scene-only actors that don't have a real model yet (e.g.
// the security guards): a box torso and a smaller box head. Walks and turns
// through the exact same per-frame integration as a real skinned character -
// only the visual representation differs.
export function PlaceholderActorModel({ characterId, color = '#3a4a5c' }: PlaceholderActorModelProps) {
  const group = useRef<Group>(null)
  useCharacterTransform(characterId, group)

  return (
    <group ref={group}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.5, 1.3, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, 1.44, 0]} castShadow>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#e0c9a6" roughness={0.7} metalness={0} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Verify it renders and walks**

Run `npx tsc --noEmit`. Then temporarily verify it in the running scene: in `src/character/Npcs.tsx`, for a moment, render one alongside the real NPCs to see it appear and idle (do not commit this temporary change — it's a throwaway visual check):

```tsx
// TEMPORARY - not committed
import { PlaceholderActorModel } from './PlaceholderActorModel'
// inside Npcs(): <PlaceholderActorModel characterId={NPC_CHARACTERS[0].id} color="#c0392b" />
```
Confirm in the browser you see a red box-and-head figure standing at the PM's spawn point (sharing her position since it reads the same `characterId`). Revert this temporary edit — it was only to visually confirm the box renders at the right transform before any scene exists to spawn one for real. `PlaceholderActorModel` has no independent consumer until Task 9, so this manual check is the only way to see it before then.

- [ ] **Step 3: Commit**

```bash
git add src/character/PlaceholderActorModel.tsx
git commit -m "feat: box placeholder renderer for actors without a model yet"
```

---

## Task 3: Camera controller

**Files:**
- Create: `src/scene/camera/cameraController.ts`
- Modify: `src/scene/camera/IsometricCamera.tsx:1-27`

**Interfaces:**
- Produces: `registerCameraControls(instance: CameraControlsImpl | null): void`, `flyTo(target: Point, position?: Point, durationMs?: number): Promise<void>`, `setInputEnabled(enabled: boolean): void`. Used by Task 8's `director.ts` and Task 9's `CutsceneRunner`.

- [ ] **Step 1: Create the controller module**

```ts
// src/scene/camera/cameraController.ts
import { Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'

export type Point = [number, number, number]

let controls: CameraControlsImpl | null = null
const tmpPosition = new Vector3()

// IsometricCamera registers its live CameraControls instance here so code
// outside the R3F tree (the cutscene director) can command the camera
// without prop-drilling a ref through the scene graph.
export function registerCameraControls(instance: CameraControlsImpl | null): void {
  controls = instance
}

// Smoothly moves the camera to look at `target` from `position` (defaults to
// the camera's current position, so a scene can re-aim without relocating
// it). Resolves once the transition finishes - camera-controls' own
// setLookAt already returns that promise. durationMs temporarily overrides
// the controls' smoothTime for just this move, then restores it.
export async function flyTo(target: Point, position?: Point, durationMs = 1500): Promise<void> {
  if (!controls) return
  const [px, py, pz] = position ?? controls.getPosition(tmpPosition).toArray()
  const [tx, ty, tz] = target
  const previousSmoothTime = controls.smoothTime
  controls.smoothTime = Math.max(0.01, durationMs / 1000)
  try {
    await controls.setLookAt(px, py, pz, tx, ty, tz, true)
  } finally {
    controls.smoothTime = previousSmoothTime
  }
}

export function setInputEnabled(enabled: boolean): void {
  if (controls) controls.enabled = enabled
}
```

- [ ] **Step 2: Wire it into `IsometricCamera.tsx`**

Add the import (after the existing `BUILDING` import):

```ts
import { registerCameraControls } from './cameraController'
```

Change the `attachControls` callback to also register the instance:

```tsx
  const attachControls = useCallback((instance: CameraControlsImpl | null) => {
    instance?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false)
    instance?.setBoundary(PAN_BOUNDARY)
    registerCameraControls(instance)
  }, [])
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` and `npx vite build` — both clean. Then start the dev server, open the browser devtools console, and run:

```js
window.__r3f // (already exposed by the existing debug pattern if present; otherwise skip to the next check)
```

Simplest direct check: temporarily add one line at the bottom of `src/App.tsx` (not committed) —
```ts
import('./scene/camera/cameraController').then((m) => ((window as any).__camera = m))
```
then in the console run `window.__camera.flyTo([0, 1, 0], [10, 10, 10], 800)` and confirm the camera animates to that framing over ~0.8s and the promise it returns resolves (`window.__camera.flyTo(...).then(() => console.log('done'))`). Also confirm dragging the mouse still orbits the camera normally afterward (input wasn't left disabled by anything here — `setInputEnabled` isn't called by this check). Remove the temporary import before committing.

- [ ] **Step 4: Commit**

```bash
git add src/scene/camera/cameraController.ts src/scene/camera/IsometricCamera.tsx
git commit -m "feat: camera controller for scripted camera moves"
```

---

## Task 4: Player-input lock and scene-ownership flags on characterStore

**Files:**
- Modify: `src/character/characterStore.ts` (interface at lines 18-32, store body at lines 34-86)

**Interfaces:**
- Produces: `useCharacterStore`'s state gains `inputLocked: boolean`, `setInputLocked(locked: boolean): void`, `sceneOwned: Set<string>`, `setSceneOwned(ids: Set<string>): void`. Used by Task 5 (`Npcs.tsx`) and Task 9 (`CutsceneRunner`).

These flags live in `characterStore`, not a new cutscene-specific store, because every player-click handler (`clickFloor`/`clickWorkstation`/`clickCoffeeMachine`/`clickSeat`/`clickSofa`) is already funneled through this one file from many different room/furniture components — gating here is one change instead of patching every call site, and it keeps the dependency direction one-way (`cutscenes/` depends on `character/`, never the reverse).

- [ ] **Step 1: Add the fields to the interface**

In `CharactersStore` (after `characters: Record<string, CharacterEntity>`):

```ts
  characters: Record<string, CharacterEntity>
  inputLocked: boolean
  setInputLocked: (locked: boolean) => void
  sceneOwned: Set<string>
  setSceneOwned: (ids: Set<string>) => void
  spawnCharacter: (id: string, position: Point, rotationY?: number) => void
```

- [ ] **Step 2: Add the state and gate the click actions**

In the store body, add the fields right after `characters: { ... }`:

```ts
    characters: {
      [PLAYER_ID]: { state: { kind: 'idle' }, position: SPAWN_POSITION, rotationY: SPAWN_ROTATION_Y },
    },
    inputLocked: false,
    setInputLocked: (locked) => set({ inputLocked: locked }),
    sceneOwned: new Set(),
    setSceneOwned: (ids) => set({ sceneOwned: ids }),
```

Gate `playerClick`:

```ts
  const playerClick = (type: 'CLICK_WORKSTATION' | 'CLICK_COFFEE_MACHINE' | 'CLICK_SEAT' | 'CLICK_SOFA') => {
    return (target: Target) => {
      if (get().inputLocked) return
      // one seat, one character - clicks on a spot someone else already took
      // are ignored instead of stacking two characters on it
      if (!isTargetFree(target, PLAYER_ID)) return
      claimTarget(PLAYER_ID, target)
      get().dispatchTo(PLAYER_ID, { type, target })
    }
  }
```

Gate `clickFloor`:

```ts
    clickFloor: (point) => {
      if (get().inputLocked) return
      releaseClaims(PLAYER_ID)
      get().dispatchTo(PLAYER_ID, { type: 'CLICK_FLOOR', point: nearestWalkable(point) })
    },
```

- [ ] **Step 3: Verify**

Run:
```bash
npx tsc --noEmit
npx vitest run
```
Expected: `characterStore.test.ts` still passes unchanged (it never sets `inputLocked`, so it defaults to `false` and every existing assertion holds).

Manual check via the dev server console:
```js
window.__characterStore // exposed only by the temporary debug harness pattern used elsewhere in this project - if not present, skip this and rely on the build/test check above plus Task 9's end-to-end check, which exercises this lock for real.
```
If a debug harness is available, run `useCharacterStore.getState().setInputLocked(true)` then click a floor tile in the 3D view — the player must not move. Then `setInputLocked(false)` and click again — the player must move normally.

- [ ] **Step 4: Commit**

```bash
git add src/character/characterStore.ts
git commit -m "feat: input lock and scene-ownership flags on characterStore"
```

---

## Task 5: Pause NPC autonomy for scene-owned characters

**Files:**
- Modify: `src/character/Npcs.tsx:24-39`

**Interfaces:**
- Consumes: `characterStore.sceneOwned` from Task 4.

- [ ] **Step 1: Add the gate**

Change the top of `useNpcBrain` and its effect condition:

```tsx
function useNpcBrain(id: string, planActivity: ActivityPlanner = planNextActivity) {
  const stateKind = useCharacterStore((s) => s.characters[id]?.state.kind)
  const gamePhase = useGameStore((s) => s.phase)
  const sceneOwned = useCharacterStore((s) => s.sceneOwned.has(id))
  const planRef = useRef<ActivityPlan | null>(null)
  const rngRef = useRef<(() => number) | null>(null)
  if (!rngRef.current) {
    let seed = 0
    for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) | 0
    rngRef.current = createRng(seed ^ (Date.now() & 0xffff))
  }

  useEffect(() => {
    // story gating: NPCs live their office life only once the game reaches
    // free play (after the player has met the PM), and pause entirely while
    // a cutscene has taken direct control of this character
    if (gamePhase !== 'free' || sceneOwned) return
    if (!stateKind || !SETTLED_STATES.has(stateKind)) return
```

...and add `sceneOwned` to the effect's dependency array:

```tsx
  }, [stateKind, id, planActivity, gamePhase, sceneOwned])
```

- [ ] **Step 2: Verify**

Run `npx tsc --noEmit` and `npx vitest run` (no existing test covers `Npcs.tsx` directly — confirm no regressions elsewhere).

Manual check: start the dev server, reach `free` phase, wait for the PM to be doing something autonomous. In the console (via whatever debug global is available, or temporarily add one to `src/App.tsx` and remove before committing):
```js
useCharacterStore.getState().setSceneOwned(new Set(['npc-female-pm']))
```
Confirm she stops picking new activities (finishes whatever she's mid-way through, since `SETTLED_STATES`-gating already only plans *new* activities, but no new one gets scheduled). Then:
```js
useCharacterStore.getState().setSceneOwned(new Set())
```
Confirm she resumes her autonomous office life shortly after.

- [ ] **Step 3: Commit**

```bash
git add src/character/Npcs.tsx
git commit -m "feat: pause NPC brain while a cutscene owns the character"
```

---

## Task 6: Game store additions — choice prompts, reprimands, reactive tasks

**Files:**
- Modify: `src/game/gameStore.ts` (whole file — shown in full below since nearly every section changes)
- Modify: `src/game/tasks.ts:1-4` (comment only)
- Modify: `src/ui/TaskBoard.tsx`

**Interfaces:**
- Produces: `useGameStore` gains `activeChoice: { options: ChoiceOption[] } | null`, `presentChoice(options: ChoiceOption[], onChoose: (id: string) => void): void`, `chooseOption(id: string): void`, `tasks: BoardTask[]`, `addTask(task: BoardTask): void`, `reprimands: number`, `addReprimand(): void`. Exports `ChoiceOption`. Used by Task 7 (`DialoguePanel`) and Task 8 (`director.ts`).

- [ ] **Step 1: Replace `src/game/gameStore.ts`**

```ts
import { create } from 'zustand'
import { BOARD_TASKS, type BoardTask } from './tasks'

// 'fired' is the refusal ending - never persisted, a reload starts over.
export type GamePhase = 'intro' | 'meetPm' | 'free' | 'fired'

export interface DialogueLine {
  speaker: string
  speakerRole?: string
  // Drawn portrait of the speaker shown beside the line.
  portrait?: string
  text: string
}

interface ActiveDialogue {
  lines: DialogueLine[]
  index: number
}

export interface ChoiceOption {
  id: string
  label: string
}

interface ActiveChoice {
  options: ChoiceOption[]
  onChoose: (id: string) => void
}

const STORAGE_KEY = 'startup-office-progress'

interface SavedProgress {
  playerName: string
  phase: GamePhase
  tasks: BoardTask[]
  reprimands: number
}

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): ProgressStorage | null {
  try {
    return window.localStorage
  } catch {
    return null // private mode / storage disabled
  }
}

// Reads saved progress; `?intro` in the search string wipes it so the intro
// can be replayed. Exported for tests.
export function loadProgress(storage: ProgressStorage | null, search: string): SavedProgress {
  const fresh: SavedProgress = { playerName: '', phase: 'intro', tasks: BOARD_TASKS, reprimands: 0 }
  if (!storage) return fresh
  try {
    if (new URLSearchParams(search).has('intro')) {
      storage.removeItem(STORAGE_KEY)
      return fresh
    }
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as Partial<SavedProgress>
    if (typeof parsed.playerName !== 'string') return fresh
    if (parsed.phase !== 'meetPm' && parsed.phase !== 'free') return fresh
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : BOARD_TASKS
    const reprimands = typeof parsed.reprimands === 'number' ? parsed.reprimands : 0
    return { playerName: parsed.playerName, phase: parsed.phase, tasks, reprimands }
  } catch {
    return fresh
  }
}

export function saveProgress(storage: ProgressStorage | null, progress: SavedProgress): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // private mode - the game simply restarts from the intro next time
  }
}

interface GameStore {
  phase: GamePhase
  playerName: string
  activeDialogue: ActiveDialogue | null
  activeChoice: ActiveChoice | null
  tasks: BoardTask[]
  reprimands: number
  // the meeting room whiteboard with the task reminders
  taskBoardOpen: boolean
  completeIntro: (name: string) => void
  refuseJob: () => void
  restartGame: () => void
  startDialogue: (lines: DialogueLine[]) => void
  advanceDialogue: () => void
  presentChoice: (options: ChoiceOption[], onChoose: (id: string) => void) => void
  chooseOption: (id: string) => void
  addTask: (task: BoardTask) => void
  addReprimand: () => void
  openTaskBoard: () => void
  closeTaskBoard: () => void
}

const initial = loadProgress(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameStore = create<GameStore>()((set, get) => ({
  phase: initial.phase,
  playerName: initial.playerName,
  activeDialogue: null,
  activeChoice: null,
  tasks: initial.tasks,
  reprimands: initial.reprimands,
  taskBoardOpen: false,
  completeIntro: (name) => {
    const playerName = name.trim()
    if (!playerName) return
    set({ playerName, phase: 'meetPm' })
    saveProgress(safeStorage(), { playerName, phase: 'meetPm', tasks: get().tasks, reprimands: get().reprimands })
  },
  refuseJob: () => set({ phase: 'fired' }),
  restartGame: () => {
    try {
      safeStorage()?.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    set({
      phase: 'intro',
      playerName: '',
      activeDialogue: null,
      activeChoice: null,
      tasks: BOARD_TASKS,
      reprimands: 0,
    })
  },
  startDialogue: (lines) => {
    if (lines.length === 0) return
    set({ activeDialogue: { lines, index: 0 } })
  },
  presentChoice: (options, onChoose) => set({ activeChoice: { options, onChoose } }),
  chooseOption: (id) => {
    const choice = get().activeChoice
    set({ activeChoice: null })
    choice?.onChoose(id)
  },
  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  addReprimand: () => {
    set((s) => ({ reprimands: s.reprimands + 1 }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  openTaskBoard: () => set({ taskBoardOpen: true }),
  closeTaskBoard: () => set({ taskBoardOpen: false }),
  advanceDialogue: () => {
    const dialogue = get().activeDialogue
    if (!dialogue) return
    if (dialogue.index + 1 < dialogue.lines.length) {
      set({ activeDialogue: { ...dialogue, index: dialogue.index + 1 } })
      return
    }
    // the only dialogue in phase meetPm is the PM intro - closing it unlocks
    // free play and starts NPC life
    if (get().phase === 'meetPm') {
      set({ activeDialogue: null, phase: 'free' })
      saveProgress(safeStorage(), {
        playerName: get().playerName,
        phase: 'free',
        tasks: get().tasks,
        reprimands: get().reprimands,
      })
      return
    }
    set({ activeDialogue: null })
  },
}))
```

- [ ] **Step 2: Update `src/game/tasks.ts`'s comment**

```ts
// Seed data for the department's task board. gameStore's `tasks` field is
// what the game and the whiteboard UI actually read and mutate at runtime -
// this array only seeds its initial value.

export interface BoardTask {
  id: string
  text: string
  done: boolean
}

export const BOARD_TASKS: BoardTask[] = [{ id: 'build-team', text: 'Сформировать команду', done: false }]
```

- [ ] **Step 3: Update `TaskBoard.tsx` to read from the store**

```tsx
import { useGameStore } from '../game/gameStore'
import './ui.css'

// The meeting room whiteboard, up close: a hand-written TODO list of the
// department's tasks. Opens by clicking the whiteboard in the 3D scene.
export function TaskBoard() {
  const open = useGameStore((s) => s.taskBoardOpen)
  const close = useGameStore((s) => s.closeTaskBoard)
  const tasks = useGameStore((s) => s.tasks)
  if (!open) return null

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="taskboard" onClick={(e) => e.stopPropagation()}>
        <button className="taskboard-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <h2 className="taskboard-title">TODO:</h2>
        <ul className="taskboard-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? 'taskboard-done' : ''}>
              <span className="taskboard-checkbox">{task.done ? '✔' : ''}</span>
              <span>{task.text}</span>
            </li>
          ))}
        </ul>
        <div className="taskboard-tray" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run:
```bash
npx tsc --noEmit
npx vitest run
```
Expected: `gameStore.test.ts` and `TaskBoard.test.tsx` both still pass unchanged (neither test touches `tasks`/`activeChoice`/`reprimands`, and `tasks` still seeds to the same single `'Сформировать команду'` entry). Then `npx vite build`.

Manual check via dev server console: `useGameStore.getState().addTask({ id: 'x', text: 'Тест', done: false })`, open the whiteboard in the 3D scene, confirm the new item appears. Reload the page (still in `free` phase) and confirm it's still there (persisted).

- [ ] **Step 5: Commit**

```bash
git add src/game/gameStore.ts src/game/tasks.ts src/ui/TaskBoard.tsx
git commit -m "feat: reactive tasks, reprimands and choice prompts in gameStore"
```

---

## Task 7: Choice buttons in the dialogue panel

**Files:**
- Modify: `src/ui/DialoguePanel.tsx`
- Modify: `src/ui/ui.css` (append at end)

**Interfaces:**
- Consumes: `useGameStore().activeChoice` / `chooseOption` from Task 6.

- [ ] **Step 1: Update `DialoguePanel.tsx`**

```tsx
import { useGameStore } from '../game/gameStore'
import './ui.css'

// Bottom dialogue panel: one line at a time with the speaker's name and
// role. Once a dialogue's last line has been read, a scene may follow up
// with a player choice (activeChoice) - the panel then swaps the single
// advance button for one button per option.
export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.activeDialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  const choice = useGameStore((s) => s.activeChoice)
  const chooseOption = useGameStore((s) => s.chooseOption)

  if (choice) {
    return (
      <div className="dialogue-panel">
        <div className="card-body">
          <div className="dialogue-choices">
            {choice.options.map((option) => (
              <button key={option.id} className="primary" onClick={() => chooseOption(option.id)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!dialogue) return null

  const line = dialogue.lines[dialogue.index]
  const isLast = dialogue.index === dialogue.lines.length - 1

  return (
    <div className="dialogue-panel">
      {line.portrait ? <img className="card-picture" src={line.portrait} alt={line.speaker} /> : null}
      <div className="card-body">
        <div className="dialogue-speaker">
          {line.speaker}
          {line.speakerRole ? <span className="dialogue-role"> · {line.speakerRole}</span> : null}
        </div>
        <p className="dialogue-text">{line.text}</p>
        <button className="primary" onClick={advance}>
          {isLast ? 'За работу' : 'Далее'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Append CSS for the choice buttons**

Append to the end of `src/ui/ui.css`:

```css
.dialogue-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
}

.dialogue-choices button.primary {
  margin-top: 0;
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` and `npx vitest run` — `DialoguePanel.test.tsx` still passes (it never sets `activeChoice`, so the choice branch never renders for it, and the existing advance-button assertions are unaffected).

Manual check via dev server console:
```js
useGameStore.getState().presentChoice(
  [{ id: 'a', label: 'Вариант А' }, { id: 'b', label: 'Вариант Б' }],
  (id) => console.log('chosen', id),
)
```
Confirm two buttons appear in the dialogue panel at the bottom of the screen with no speaker/portrait, and clicking one logs the chosen id and makes the panel disappear.

- [ ] **Step 4: Commit**

```bash
git add src/ui/DialoguePanel.tsx src/ui/ui.css
git commit -m "feat: player choice buttons in the dialogue panel"
```

---

## Task 8: Cutscene types, store and director

**Files:**
- Create: `src/cutscenes/types.ts`
- Create: `src/cutscenes/cutsceneStore.ts`
- Create: `src/cutscenes/director.ts`

**Interfaces:**
- Consumes: `characterStore` (Task 4: `inputLocked`/`sceneOwned` are set by Task 9, not here; this task's `director.ts` uses `spawnCharacter`/`removeCharacter`/`dispatchTo`/`setTransform`/`characters` which already existed), `cameraController.flyTo` (Task 3), `gameStore.startDialogue`/`presentChoice`/`addTask` (Task 6).
- Produces: `CutsceneDirector`, `CutsceneScript`, `CutsceneEntry` types; `createDirector(): CutsceneDirector`; `useCutsceneStore` with `activeSceneId`, `actors`, `startScene(id)`, `endScene()`, `upsertActor(id, color)`, `removeActor(id)`. Used by Task 9's `CutsceneRunner`/`registry.ts` and Task 10's `securityBreach.ts`.

- [ ] **Step 1: Create `types.ts`**

```ts
// src/cutscenes/types.ts
import type { DialogueLine, ChoiceOption } from '../game/gameStore'
import type { BoardTask } from '../game/tasks'

export type Point = [number, number, number]

export interface CutsceneDirector {
  walk(characterId: string, point: Point): Promise<void>
  face(characterId: string, towardId: string): void
  camera(target: Point, opts?: { position?: Point; durationMs?: number }): Promise<void>
  say(lines: DialogueLine[]): Promise<void>
  choice(options: ChoiceOption[]): Promise<string>
  wait(ms: number): Promise<void>
  talk(characterId: string, on: boolean): void
  spawnActor(id: string, at: Point, rotationY?: number, color?: string): void
  despawnActor(id: string): void
  addTask(task: BoardTask): void
}

export type CutsceneScript = (director: CutsceneDirector) => Promise<void>

export interface CutsceneEntry {
  script: CutsceneScript
  // Existing persistent NPCs this scene must pause the autonomous brain of
  // for its duration (ephemeral scene-only actors never have one to pause).
  ownsNpcIds?: string[]
}
```

- [ ] **Step 2: Create `cutsceneStore.ts`**

```ts
// src/cutscenes/cutsceneStore.ts
import { create } from 'zustand'

interface CutsceneStore {
  activeSceneId: string | null
  // ephemeral scene-only actors currently spawned, keyed by character id
  actors: Record<string, { color: string }>
  startScene: (id: string) => void
  endScene: () => void
  upsertActor: (id: string, color: string) => void
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
  upsertActor: (id, color) => set((s) => ({ actors: { ...s.actors, [id]: { color } } })),
  removeActor: (id) =>
    set((s) => {
      const actors = { ...s.actors }
      delete actors[id]
      return { actors }
    }),
}))
```

- [ ] **Step 3: Create `director.ts`**

```ts
// src/cutscenes/director.ts
import { useCharacterStore } from '../character/characterStore'
import { nearestWalkable } from '../character/grid'
import { useGameStore } from '../game/gameStore'
import { flyTo } from '../scene/camera/cameraController'
import { useCutsceneStore } from './cutsceneStore'
import type { CutsceneDirector, Point } from './types'

function waitForIdle(characterId: string): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => useCharacterStore.getState().characters[characterId]?.state.kind !== 'walking'
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

function waitForDialogueClosed(): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => useGameStore.getState().activeDialogue === null
    if (isDone()) {
      resolve()
      return
    }
    const unsubscribe = useGameStore.subscribe(() => {
      if (!isDone()) return
      unsubscribe()
      resolve()
    })
  })
}

function facingTowards(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}

export function createDirector(): CutsceneDirector {
  return {
    walk(characterId, point) {
      const entity = useCharacterStore.getState().characters[characterId]
      if (!entity) return Promise.resolve()
      useCharacterStore.getState().dispatchTo(characterId, { type: 'CLICK_FLOOR', point: nearestWalkable(point) })
      return waitForIdle(characterId)
    },
    face(characterId, towardId) {
      const store = useCharacterStore.getState()
      const self = store.characters[characterId]
      const other = store.characters[towardId]
      if (!self || !other) return
      store.setTransform(characterId, self.position, facingTowards(self.position, other.position))
    },
    camera(target, opts) {
      return flyTo(target, opts?.position, opts?.durationMs)
    },
    say(lines) {
      useGameStore.getState().startDialogue(lines)
      return waitForDialogueClosed()
    },
    choice(options) {
      return new Promise((resolve) => {
        useGameStore.getState().presentChoice(options, resolve)
      })
    },
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    },
    talk(characterId, on) {
      useCharacterStore.getState().dispatchTo(characterId, { type: on ? 'TALK_START' : 'TALK_END' })
    },
    spawnActor(id, at, rotationY = 0, color = '#3a4a5c') {
      useCharacterStore.getState().spawnCharacter(id, at, rotationY)
      useCutsceneStore.getState().upsertActor(id, color)
    },
    despawnActor(id) {
      useCharacterStore.getState().removeCharacter(id)
      useCutsceneStore.getState().removeActor(id)
    },
    addTask(task) {
      useGameStore.getState().addTask(task)
    },
  }
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```
Expected: clean. There is no runtime behavior to exercise yet — nothing calls `createDirector()` until Task 9's `CutsceneRunner` exists, so this task is verified by type-correctness alone; Task 9 is where the director's actual behavior gets exercised end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/cutscenes/types.ts src/cutscenes/cutsceneStore.ts src/cutscenes/director.ts
git commit -m "feat: cutscene director, types and scene store"
```

---

## Task 9: Runner, registry and the scene's first working slice

**Files:**
- Create: `src/cutscenes/registry.ts`
- Create: `src/cutscenes/CutsceneRunner.tsx`
- Create: `src/cutscenes/securityBreach.ts`
- Modify: `src/scene/Office.tsx` (mount `CutsceneRunner`)
- Modify: `src/App.tsx` (dev-only trigger)

**Interfaces:**
- Consumes: `createDirector`, `useCutsceneStore` (Task 8); `PlaceholderActorModel` (Task 2); `setInputEnabled` (Task 3); `characterStore.setInputLocked`/`setSceneOwned` (Task 4).
- Produces: `CUTSCENES: Record<string, CutsceneEntry>`; `<CutsceneRunner />`; `securityBreachScene: CutsceneScript` (a real but partial scene — extended to completion in Task 10).

This task proves the whole plumbing works end-to-end with a small, real slice of the scene: the PM leaves her desk, two guard boxes walk in and comment, then leave. Task 10 extends `securityBreach.ts` with the rest (office confrontation, player choice, task-board effect) — nothing here is a stub; it's simply less content than the final scene.

- [ ] **Step 1: Create `registry.ts`**

```ts
// src/cutscenes/registry.ts
import { femalePm } from '../character/characters/femalePm'
import { securityBreachScene } from './securityBreach'
import type { CutsceneEntry } from './types'

export const CUTSCENES: Record<string, CutsceneEntry> = {
  'security-breach': { script: securityBreachScene, ownsNpcIds: [femalePm.id] },
}
```

- [ ] **Step 2: Create `CutsceneRunner.tsx`**

```tsx
// src/cutscenes/CutsceneRunner.tsx
import { useEffect, useRef } from 'react'
import { PlaceholderActorModel } from '../character/PlaceholderActorModel'
import { useCharacterStore } from '../character/characterStore'
import { setInputEnabled } from '../scene/camera/cameraController'
import { createDirector } from './director'
import { CUTSCENES } from './registry'
import { useCutsceneStore } from './cutsceneStore'

// Mounted once inside the office scene, alongside Npcs/MeetPmController. Runs
// whichever scene cutsceneStore.activeSceneId names: locks player input and
// camera dragging, pauses the listed NPCs' own brains, plays the scene
// script through to completion (or failure), then hands everything back.
export function CutsceneRunner() {
  const activeSceneId = useCutsceneStore((s) => s.activeSceneId)
  const actors = useCutsceneStore((s) => s.actors)
  const running = useRef<string | null>(null)

  useEffect(() => {
    if (!activeSceneId || running.current === activeSceneId) return
    const entry = CUTSCENES[activeSceneId]
    if (!entry) {
      console.error(`Unknown cutscene id: ${activeSceneId}`)
      useCutsceneStore.getState().endScene()
      return
    }
    running.current = activeSceneId
    setInputEnabled(false)
    const characterStore = useCharacterStore.getState()
    characterStore.setInputLocked(true)
    characterStore.setSceneOwned(new Set(entry.ownsNpcIds ?? []))

    const director = createDirector()
    void entry.script(director)
      .catch((error) => {
        console.error(`Cutscene "${activeSceneId}" threw`, error)
      })
      .finally(() => {
        running.current = null
        useCutsceneStore.getState().endScene()
        setInputEnabled(true)
        useCharacterStore.getState().setInputLocked(false)
        useCharacterStore.getState().setSceneOwned(new Set())
      })
  }, [activeSceneId])

  return (
    <>
      {Object.entries(actors).map(([id, actor]) => (
        <PlaceholderActorModel key={id} characterId={id} color={actor.color} />
      ))}
    </>
  )
}
```

- [ ] **Step 3: Create the first (partial) `securityBreach.ts`**

```ts
// src/cutscenes/securityBreach.ts
import { femalePm } from '../character/characters/femalePm'
import type { CutsceneScript, Point } from './types'

const PM_DESK: Point = [-2, 0.8, 6.3]
const PM_DESK_CAMERA: Point = [4, 8, 12]
const PM_AWAY_POINT: Point = [-2, 0, 3]
const GUARD1_SPAWN: Point = [-5, 0, 5]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 6.3]
const GUARD2_SPAWN: Point = [-5, 0, 7]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 6.9]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK, { position: PM_DESK_CAMERA, durationMs: 1500 })
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnActor('guard1', GUARD1_SPAWN, 0, '#37475c')
  director.spawnActor('guard2', GUARD2_SPAWN, 0, '#4a3c3c')
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  director.despawnActor('guard1')
  director.despawnActor('guard2')
}
```

- [ ] **Step 4: Mount `CutsceneRunner` in the 3D scene**

In `src/scene/Office.tsx`, add the import:

```ts
import { CutsceneRunner } from '../cutscenes/CutsceneRunner'
```

Add `<CutsceneRunner />` right after `<StoryComponent />` in the JSX:

```tsx
        <CharacterComponent />
        <NpcsComponent />
        <StoryComponent />
        <CutsceneRunner />
      </MaterialsProvider>
    </Suspense>
  )
}
```

- [ ] **Step 5: Add the dev-only trigger to `App.tsx`**

Add the import and a module-scope block (runs once on load, not inside the component) near the top of `src/App.tsx`, after the existing imports:

```ts
import { useCutsceneStore } from './cutscenes/cutsceneStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { __startCutscene?: (id: string) => void }).__startCutscene = (id: string) =>
    useCutsceneStore.getState().startScene(id)
}
```

- [ ] **Step 6: Verify end-to-end**

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```
All clean.

Start the dev server, reach `free` phase (name entry + PM intro dialogue, or append `?intro` to replay from scratch first if needed to get a clean run). In the browser console:

```js
window.__startCutscene('security-breach')
```

Confirm, in order:
- the camera smoothly moves to frame the PM's desk
- the PM (real skinned model) walks away from her desk
- two dark boxes with lighter box "heads" appear near her desk and walk to their marks
- the dialogue panel shows two lines with speaker "Охранник 1" / "Охранник 2", no portrait
- after the last line, both boxes disappear
- camera dragging and floor clicks work again immediately after

If a Playwright driver is available in this environment, script the same sequence (`page.evaluate(() => window.__startCutscene('security-breach'))`, screenshot at each stage) instead of doing it by hand — follow the project's existing pattern of a throwaway script under a scratch/tmp directory, not committed.

- [ ] **Step 7: Commit**

```bash
git add src/cutscenes/registry.ts src/cutscenes/CutsceneRunner.tsx src/cutscenes/securityBreach.ts src/scene/Office.tsx src/App.tsx
git commit -m "feat: cutscene runner wired up with the first scene's opening beat"
```

---

## Task 10: Full security-breach scene — office confrontation, choice, consequences

**Files:**
- Modify: `src/cutscenes/securityBreach.ts` (full rewrite, extending Task 9's version)

**Interfaces:**
- Consumes: `director.choice`/`addTask` (Task 8), `useGameStore.getState().addReprimand` (Task 6), `PLAYER_ID` (`src/character/characterStore.ts`, pre-existing).

- [ ] **Step 1: Replace `securityBreach.ts` with the full scene**

```ts
// src/cutscenes/securityBreach.ts
import { PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { useGameStore } from '../game/gameStore'
import type { CutsceneScript, Point } from './types'

const PM_DESK: Point = [-2, 0.8, 6.3]
const PM_DESK_CAMERA: Point = [4, 8, 12]
const PM_AWAY_POINT: Point = [-2, 0, 3]
const GUARD1_SPAWN: Point = [-5, 0, 5]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 6.3]
const GUARD2_SPAWN: Point = [-5, 0, 7]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 6.9]

const OFFICE_CAMERA_TARGET: Point = [9, 0.8, -5.3]
const OFFICE_CAMERA_POSITION: Point = [15, 8, 1]
const PLAYER_OFFICE_MARK: Point = [8, 0, -6.5]
const GUARD1_OFFICE_MARK: Point = [7.2, 0, -6.5]
const GUARD2_OFFICE_MARK: Point = [8.8, 0, -6.5]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK, { position: PM_DESK_CAMERA, durationMs: 1500 })
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnActor('guard1', GUARD1_SPAWN, 0, '#37475c')
  director.spawnActor('guard2', GUARD2_SPAWN, 0, '#4a3c3c')
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  await director.camera(OFFICE_CAMERA_TARGET, { position: OFFICE_CAMERA_POSITION, durationMs: 1500 })
  await Promise.all([
    director.walk(PLAYER_ID, PLAYER_OFFICE_MARK),
    director.walk('guard1', GUARD1_OFFICE_MARK),
    director.walk('guard2', GUARD2_OFFICE_MARK),
  ])
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

- [ ] **Step 2: Verify end-to-end (both branches)**

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```
All clean.

Start the dev server, reach `free` phase, run `window.__startCutscene('security-breach')` in the console and walk the **accept** branch to completion. Confirm, in order, beyond what Task 9 already covered:
- camera cuts to the CEO office
- the player character and both guard boxes walk into the office
- the dialogue panel shows the guards' office-confrontation lines
- the two choice buttons appear with the exact accept/blame labels above
- picking "Беру ответственность..." shows the calm follow-up line, then the recurring-duty line
- opening the whiteboard (click it in the 3D scene) now shows **two** items: "Сформировать команду" and "Проводить курсы по безопасности (регулярно)"
- both guard boxes disappear, camera and floor clicks work again

Reload with `?intro`, replay through to `free`, run the scene again and pick **blame** this time. Confirm the harsher follow-up line plays instead, and that `useGameStore.getState().reprimands` is `1` after this run (was `0` after the accept run) — check via the console. Confirm the task-board outcome is identical either way (still exactly the two items, no duplicate `security-training` entries if you happen to trigger the scene twice in one session — triggering twice isn't a supported flow per this plan's Global Constraints, so a duplicate in that specific case is expected and fine, not a bug to chase).

- [ ] **Step 3: Commit**

```bash
git add src/cutscenes/securityBreach.ts
git commit -m "feat: full security-breach scene - office confrontation, choice, consequences"
```
