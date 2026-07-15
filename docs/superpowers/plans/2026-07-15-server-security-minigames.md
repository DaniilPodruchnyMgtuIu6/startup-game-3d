# Server Security Mini-Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server racks breakable (blink red, white outline, clickable); the player walks to a broken rack and fixes it through one of three educational security mini-games (firewall, log forensics, SQL injection).

**Architecture:** A new in-memory zustand store (`serverIncidentsStore`) owns rack health, the open mini-game, and an incident history. Racks bind permanently to roles/games by seed. Repair reuses the character state machine (click → walk → `repairing` state → overlay opens on arrival), mirroring how workstations/seats already work. Mini-games are React overlays with pure logic modules split out (same split as `serverRackLights.ts`).

**Tech Stack:** React 19, @react-three/fiber 9, three 0.185, zustand 5, TypeScript. Existing patterns: zustand stores in `src/game/`, UI overlays in `src/ui/` styled via `src/ui/ui.css`, interaction triggers via `InteractionTrigger`, hover outline via `attachHoverOutline`.

## Global Constraints

- **NO TESTS** (`AGENTS.md`). Do not add `*.test.ts(x)` files. Verify every task by running the app (`npm run dev`) and driving it via the browser console and/or headless Playwright. Keep pure logic in `.ts` modules separate from React so it stays inspectable, matching `serverRackLights.ts`.
- **NO MOCK FEATURES** (`AGENTS.md`) — wire real store/state, no fake stubs left behind (the Task 4 stub game is replaced by real games in 5–7).
- **KISS** (`AGENTS.md`) — smallest change that works; follow existing patterns exactly.
- **No `Date.now()`/`performance.now()` at module top level** — only inside store actions/handlers (keeps modules import-safe and matches the codebase's testable-logic style).
- Русский язык для всего текста, видимого игроку (заголовки, brief, выводы, метки) — matches existing UI copy.
- Dev-only globals go behind `if (import.meta.env.DEV)` in `src/App.tsx`, next to the existing `window.__startCutscene`.

---

## File Structure

```
Create:
  src/game/serverIncidentsStore.ts            # rack health, roles, history, overlay state, dev trigger action
  src/game/minigames/registry.ts              # MinigameKind → MinigameModule contract + lookup
  src/game/minigames/MinigameOverlay.tsx      # shared overlay shell + result screen
  src/game/minigames/firewall.ts              # firewall scenarios + pure evaluation
  src/game/minigames/firewall.tsx             # firewall React component
  src/game/minigames/logs.ts                  # logs scenarios + pure evaluation
  src/game/minigames/logs.tsx                 # logs React component
  src/game/minigames/sqli.ts                  # sqli scenarios + pure evaluation
  src/game/minigames/sqli.tsx                 # sqli React component
Modify:
  src/furniture/serverRackLights.ts           # + alarm waveform, forced-red for broken racks
  src/furniture/ServerRack.tsx                # + status visuals, role plate, clickable trigger while broken
  src/rooms/ServerRoom.tsx                     # pass role to each rack (seed already maps)
  src/interaction/interactionRegistry.ts       # + 'server' interaction kind
  src/character/characterMachine.ts            # + CLICK_SERVER event, repairing state, REPAIR_DONE event
  src/character/characterStore.ts              # + clickServer action
  src/character/CharacterModel.tsx             # + player-only repairing effect (beginRepair / closeMinigame)
  src/ui/ui.css                                # + minigame overlay styles
  src/App.tsx                                  # + <MinigameOverlay/>, window.__breakServer
```

---

## Task 1: Server incidents store

**Files:**
- Create: `src/game/serverIncidentsStore.ts`

**Interfaces:**
- Produces:
  - `type ServerRole = 'gateway' | 'auth' | 'database' | 'backup'`
  - `type RackStatus = 'ok' | 'broken' | 'repairing'`
  - `type MinigameKind = 'firewall' | 'logs' | 'sqli'`
  - `ROLE_BY_SEED: ServerRole[]` (index = rack seed)
  - `ROLE_LABEL: Record<ServerRole, string>`
  - `MINIGAME_BY_ROLE: Partial<Record<ServerRole, MinigameKind>>`
  - `useServerIncidentsStore` with actions `breakServer(role?)`, `beginRepair(role)`, `failAttempt(role)`, `completeRepair(role)`, `closeMinigame()`
  - `activeMinigame: { role: ServerRole; kind: MinigameKind } | null`

- [ ] **Step 1: Create the store**

Create `src/game/serverIncidentsStore.ts`:

```ts
import { create } from 'zustand'

export type ServerRole = 'gateway' | 'auth' | 'database' | 'backup'
export type RackStatus = 'ok' | 'broken' | 'repairing'
export type MinigameKind = 'firewall' | 'logs' | 'sqli'

// Rack seed (left→right in ServerRoom) → permanent role. 'backup' has no
// mini-game yet and never breaks (reserved slot for a future fourth game).
export const ROLE_BY_SEED: ServerRole[] = ['gateway', 'auth', 'database', 'backup']

// Short ASCII codes for the 3D rack plate. Deliberately ASCII: the plate is
// rendered with drei/troika <Text>, whose default font does not guarantee
// Cyrillic glyphs. Russian role identity is shown in the DOM overlay title
// (each mini-game module's `title`), which renders Cyrillic fine.
export const ROLE_LABEL: Record<ServerRole, string> = {
  gateway: 'GATE',
  auth: 'AUTH',
  database: 'DB',
  backup: 'BKP',
}

export const MINIGAME_BY_ROLE: Partial<Record<ServerRole, MinigameKind>> = {
  gateway: 'firewall',
  auth: 'logs',
  database: 'sqli',
}

export interface RackState {
  role: ServerRole
  status: RackStatus
  brokenAt: number | null // performance.now() when it broke; null while ok
  failures: number // failed mini-game attempts on the current incident
}

// A closed incident. history feeds a future "consequences" module (penalties
// for long downtime / repeated failures) with no change to this mechanic.
export interface IncidentRecord {
  role: ServerRole
  brokenAt: number
  fixedAt: number
  failures: number
}

interface ServerIncidentsStore {
  racks: Record<ServerRole, RackState>
  activeMinigame: { role: ServerRole; kind: MinigameKind } | null
  history: IncidentRecord[]
  breakServer: (role?: ServerRole) => void
  beginRepair: (role: ServerRole) => void
  failAttempt: (role: ServerRole) => void
  completeRepair: (role: ServerRole) => void
  closeMinigame: () => void
}

const ROLES: ServerRole[] = ['gateway', 'auth', 'database', 'backup']

function freshRacks(): Record<ServerRole, RackState> {
  return {
    gateway: { role: 'gateway', status: 'ok', brokenAt: null, failures: 0 },
    auth: { role: 'auth', status: 'ok', brokenAt: null, failures: 0 },
    database: { role: 'database', status: 'ok', brokenAt: null, failures: 0 },
    backup: { role: 'backup', status: 'ok', brokenAt: null, failures: 0 },
  }
}

export const useServerIncidentsStore = create<ServerIncidentsStore>()((set, get) => ({
  racks: freshRacks(),
  activeMinigame: null,
  history: [],

  // Break a specific rack, or a random currently-healthy rack that has a
  // mini-game (never 'backup'). No-op if the target is already broken.
  breakServer: (role) => {
    const racks = get().racks
    let target = role
    if (!target) {
      const candidates = ROLES.filter((r) => MINIGAME_BY_ROLE[r] && racks[r].status === 'ok')
      if (candidates.length === 0) return
      // No Math.random at module scope is fine; this is inside an action.
      target = candidates[Math.floor(Math.random() * candidates.length)]
    }
    if (!MINIGAME_BY_ROLE[target] || racks[target].status !== 'ok') return
    set((s) => ({
      racks: { ...s.racks, [target!]: { ...s.racks[target!], status: 'broken', brokenAt: performance.now(), failures: 0 } },
    }))
  },

  // Player arrived at the rack → open the overlay for its bound mini-game.
  beginRepair: (role) => {
    const kind = MINIGAME_BY_ROLE[role]
    if (!kind || get().racks[role].status === 'ok') return
    set((s) => ({
      racks: { ...s.racks, [role]: { ...s.racks[role], status: 'repairing' } },
      activeMinigame: { role, kind },
    }))
  },

  failAttempt: (role) =>
    set((s) => ({ racks: { ...s.racks, [role]: { ...s.racks[role], failures: s.racks[role].failures + 1 } } })),

  // Mini-game won → rack healthy, record the incident, close the overlay.
  completeRepair: (role) => {
    const rack = get().racks[role]
    const record: IncidentRecord | null = rack.brokenAt
      ? { role, brokenAt: rack.brokenAt, fixedAt: performance.now(), failures: rack.failures }
      : null
    set((s) => ({
      racks: { ...s.racks, [role]: { role, status: 'ok', brokenAt: null, failures: 0 } },
      activeMinigame: null,
      history: record ? [...s.history, record] : s.history,
    }))
  },

  // Exit without fixing → overlay closes, a 'repairing' rack reverts to
  // 'broken'. Never demotes an already-'ok' rack (idempotent safety net for
  // the win path, which calls completeRepair first).
  closeMinigame: () =>
    set((s) => {
      const active = s.activeMinigame
      if (!active) return {}
      const rack = s.racks[active.role]
      const racks =
        rack.status === 'repairing' ? { ...s.racks, [active.role]: { ...rack, status: 'broken' as RackStatus } } : s.racks
      return { activeMinigame: null, racks }
    }),
}))
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify store behavior in the browser console**

Run `npm run dev`, open the app, and in the console:

```js
const s = () => window.__si.getState()
window.__si = (await import('/src/game/serverIncidentsStore.ts')).useServerIncidentsStore
s().breakServer('gateway'); console.log(s().racks.gateway.status) // 'broken'
s().beginRepair('gateway'); console.log(s().activeMinigame)        // { role:'gateway', kind:'firewall' }
s().completeRepair('gateway'); console.log(s().racks.gateway.status, s().history.length) // 'ok' 1
s().breakServer('backup'); console.log(s().racks.backup.status)    // 'ok' (backup never breaks)
```
Expected: the commented values.

- [ ] **Step 4: Commit**

```bash
git add src/game/serverIncidentsStore.ts
git commit -m "feat: server incidents store (rack health, roles, history)"
```

---

## Task 2: Broken-rack visuals, role plate, clickable trigger

**Files:**
- Modify: `src/furniture/serverRackLights.ts`
- Modify: `src/furniture/ServerRack.tsx`
- Modify: `src/rooms/ServerRoom.tsx`
- Modify: `src/interaction/interactionRegistry.ts`

**Interfaces:**
- Consumes: `useServerIncidentsStore`, `ROLE_BY_SEED`, `ROLE_LABEL`, `RackStatus` (Task 1); `attachHoverOutline` (existing); `InteractionTrigger` (existing).
- Produces:
  - `alarmIntensityAt(unit: number, timeSeconds: number): number` in `serverRackLights.ts`
  - `ServerRack` now accepts `onRepair?: (target: TriggerTarget) => void` and renders a clickable trigger while broken.
  - `'server'` added to `InteractionKind`.

- [ ] **Step 1: Add the alarm waveform to serverRackLights.ts**

In `src/furniture/serverRackLights.ts`, append:

```ts
// Broken-rack alarm: every unit flashes red together (unlike the normal
// per-unit phased mix), reading as a hard fault rather than routine activity.
export function alarmIntensityAt(unit: number, timeSeconds: number): number {
  const on = Math.sin(timeSeconds * Math.PI * 2 * 2.6) > -0.2
  // tiny per-unit phase so the row isn't a single flat sheet of light
  const flicker = Math.sin((timeSeconds + unit * 0.05) * Math.PI * 2 * 9) > 0.7 ? DIM : 1
  return (on ? BASE_INTENSITY : BASE_INTENSITY * DIM) * flicker
}
```

- [ ] **Step 2: Add 'server' to the interaction registry kinds**

In `src/interaction/interactionRegistry.ts`, change:

```ts
export type InteractionKind = 'workstation' | 'coffee' | 'seat' | 'sofa'
```
to:
```ts
export type InteractionKind = 'workstation' | 'coffee' | 'seat' | 'sofa' | 'server'
```

- [ ] **Step 3: Wire status, alarm LEDs, outline, plate, and trigger into ServerRack**

Replace the contents of `src/furniture/ServerRack.tsx` with:

```tsx
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { Group, MeshStandardMaterial } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { ledStatusFor, ledMaterialKeyFor, ledIntensityAt, alarmIntensityAt } from './serverRackLights'
import { attachHoverOutline } from '../interaction/hoverOutline'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { useServerIncidentsStore, ROLE_BY_SEED, ROLE_LABEL } from '../game/serverIncidentsStore'

export interface ServerRackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  seed?: number
  onRepair?: (target: TriggerTarget) => void
}

const WIDTH = 0.6
const DEPTH = 1.0
const HEIGHT = 2.0
const UNIT_COUNT = 8
const UNIT_HEIGHT = 0.18
const UNIT_GAP = 0.02

const PATCH_CABLE_COLORS = ['#d97b29', '#2166c9', '#d9c22b']

export function ServerRack({ position = [0, 0, 0], rotation = [0, 0, 0], seed = 0, onRepair }: ServerRackProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const ledMaterials = useRef<(MeshStandardMaterial | null)[]>([])
  const elapsed = useRef(0)
  const stackHeight = UNIT_COUNT * (UNIT_HEIGHT + UNIT_GAP)
  const startY = HEIGHT - 0.15 - stackHeight

  const role = ROLE_BY_SEED[seed] ?? 'backup'
  const status = useServerIncidentsStore((s) => s.racks[role].status)
  const broken = status !== 'ok'

  // Persistent white outline while broken (same shell trick as hover),
  // attached to the rack group and removed on repair.
  useEffect(() => {
    if (!broken || !group.current) return
    const remove = attachHoverOutline(group.current)
    return remove
  }, [broken])

  useFrame((_, delta) => {
    elapsed.current += delta
    ledMaterials.current.forEach((material, unit) => {
      if (!material) return
      material.emissiveIntensity = broken
        ? alarmIntensityAt(unit, elapsed.current)
        : ledIntensityAt(ledStatusFor(seed, unit), unit, elapsed.current)
    })
  })

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * WIDTH) / 2 + side * 0.005, HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.01, HEIGHT - 0.02, DEPTH - 0.02]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {/* role plate on the rack front */}
      <mesh position={[0, HEIGHT - 0.08, DEPTH / 2 + 0.006]}>
        <boxGeometry args={[WIDTH - 0.12, 0.1, 0.008]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <Text
        position={[0, HEIGHT - 0.08, DEPTH / 2 + 0.012]}
        fontSize={0.06}
        color={broken ? '#ff5b5b' : '#9fb4c8'}
        anchorX="center"
        anchorY="middle"
      >
        {ROLE_LABEL[role]}
      </Text>
      {Array.from({ length: UNIT_COUNT }, (_, unit) => {
        const y = startY + unit * (UNIT_HEIGHT + UNIT_GAP)
        const ledKey = broken ? 'ledRed' : ledMaterialKeyFor(ledStatusFor(seed, unit))
        return (
          <group key={unit}>
            <mesh position={[0, y, DEPTH / 2 + 0.005]} castShadow>
              <boxGeometry args={[WIDTH - 0.04, UNIT_HEIGHT, 0.01]} />
              <meshStandardMaterial {...materials.metalFrame} />
            </mesh>
            <mesh position={[WIDTH / 2 - 0.06, y, DEPTH / 2 + 0.012]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial
                ref={(material) => {
                  ledMaterials.current[unit] = material
                }}
                {...materials[ledKey]}
              />
            </mesh>
          </group>
        )
      })}
      {PATCH_CABLE_COLORS.map((color, i) => {
        const unit = 1 + i * 2 + (seed % 2)
        const y = startY + unit * (UNIT_HEIGHT + UNIT_GAP) + (UNIT_HEIGHT + UNIT_GAP) / 2
        const x = -WIDTH / 2 + 0.12 + i * 0.14
        return (
          <mesh key={color} position={[x, y, DEPTH / 2 + 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[(UNIT_HEIGHT + UNIT_GAP) / 2, 0.008, 8, 16, Math.PI]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
          </mesh>
        )
      })}
      {broken && onRepair ? (
        <InteractionTrigger position={[0, 1.0, DEPTH / 2 + 0.2]} size={[WIDTH, HEIGHT, 0.5]} onTrigger={onRepair} kind="server" />
      ) : null}
    </group>
  )
}
```

Note: `ledMaterialKeyFor(ledStatusFor(...))` still keys the *material* at mount for the non-broken case; the broken case forces `'ledRed'`. Because material key selection happens at render and `broken` is reactive, toggling status re-renders and re-assigns the LED material set correctly.

- [ ] **Step 4: Pass a repair handler from ServerRoom**

In `src/rooms/ServerRoom.tsx`, change the rack mapping. Replace:

```tsx
      {RACK_X.map((x, i) => (
        <ServerRack key={x} position={[x, 0, 0]} seed={i} />
      ))}
```
with:
```tsx
      {RACK_X.map((x, i) => (
        <ServerRack
          key={x}
          position={[x, 0, 0]}
          seed={i}
          onRepair={(target) => useCharacterStore.getState().clickServer(target, ROLE_BY_SEED[i])}
        />
      ))}
```

And add imports at the top of `ServerRoom.tsx`:
```tsx
import { useCharacterStore } from '../character/characterStore'
import { ROLE_BY_SEED } from '../game/serverIncidentsStore'
```

(`clickServer` is added in Task 3; this file will not fully type-check until then — that's expected, they ship together conceptually but commit at the end of Task 3. Commit this task's rendering changes now; the `onRepair` wiring line is the seam.)

To keep Task 2 independently compilable, TEMPORARILY wire `onRepair` to a no-op and finish the real wiring in Task 3 Step 5:

```tsx
      {RACK_X.map((x, i) => (
        <ServerRack key={x} position={[x, 0, 0]} seed={i} onRepair={() => {}} />
      ))}
```
(Do not add the extra imports yet — add them in Task 3.)

- [ ] **Step 5: Verify visuals**

Run `npm run dev`. In the console:
```js
;(await import('/src/game/serverIncidentsStore.ts')).useServerIncidentsStore.getState().breakServer('gateway')
```
Walk the camera to the server room (bottom-left). Expected: the leftmost rack (`ШЛЮЗ`) LEDs all flash red in sync, a white outline hugs the rack, its plate label is red. Other racks unchanged. `tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add src/furniture/serverRackLights.ts src/furniture/ServerRack.tsx src/rooms/ServerRoom.tsx src/interaction/interactionRegistry.ts
git commit -m "feat: broken-rack visuals (alarm LEDs, white outline, role plate, trigger)"
```

---

## Task 3: Repair flow through the character state machine

**Files:**
- Modify: `src/character/characterMachine.ts`
- Modify: `src/character/characterStore.ts`
- Modify: `src/character/CharacterModel.tsx`
- Modify: `src/rooms/ServerRoom.tsx` (finish real wiring)

**Interfaces:**
- Consumes: `useServerIncidentsStore` (Task 1), `TriggerTarget`/`Target`.
- Produces:
  - `characterStore.clickServer(target: TriggerTarget, role: ServerRole)`
  - Machine event `{ type: 'CLICK_SERVER'; target: Target; role: string }` and `{ type: 'REPAIR_DONE' }`
  - Machine state `{ kind: 'repairing'; target: Target; role: string }`

- [ ] **Step 1: Extend the state machine**

In `src/character/characterMachine.ts`:

Add to `ArrivalGoal`:
```ts
  | { kind: 'repair'; target: Target; role: string }
```

Add to `CharacterState`:
```ts
  | { kind: 'repairing'; target: Target; role: string }
```

Add to `CharacterEvent`:
```ts
  | { type: 'CLICK_SERVER'; target: Target; role: string }
  | { type: 'REPAIR_DONE' }
```

Add a case in the `switch (event.type)` (next to `CLICK_SEAT`):
```ts
    case 'CLICK_SERVER':
      return startWalking(position, event.target.point, { kind: 'repair', target: event.target, role: event.role }, { exitFacing, entryFacing: event.target.facing })
    case 'REPAIR_DONE':
      return current.kind === 'repairing' ? { kind: 'idle' } : current
```

Add a case in `arrive`:
```ts
    case 'repair':
      return { kind: 'repairing', target: goal.target, role: goal.role }
```

(Do NOT add `repairing` to `SEATED_KINDS`: the player stands at the rack, so it exits like any standing state with no special exit facing.)

- [ ] **Step 2: Add clickServer to the character store**

In `src/character/characterStore.ts`:

Add the import:
```ts
import type { ServerRole } from '../game/serverIncidentsStore'
```

Add to the `CharactersStore` interface (next to `clickSofa`):
```ts
  clickServer: (target: Target, role: ServerRole) => void
```

Add the implementation inside the returned object (next to `clickSofa`). It follows the `playerClick` pattern but carries `role`:
```ts
    clickServer: (target, role) => {
      if (get().inputLocked) return
      if (!isTargetFree(target, PLAYER_ID)) return
      claimTarget(PLAYER_ID, target)
      get().dispatchTo(PLAYER_ID, { type: 'CLICK_SERVER', target: { point: target.point, facing: target.facing }, role })
    },
```

Note: `TriggerTarget` and `Target` are structurally identical (`{ point, facing }`); passing the trigger payload straight through is fine.

- [ ] **Step 3: Open/close the overlay on arrival (player only) in CharacterModel**

In `src/character/CharacterModel.tsx`:

Add imports:
```ts
import { useServerIncidentsStore, type ServerRole } from '../game/serverIncidentsStore'
import { PLAYER_ID } from './characterStore'
```

Add this effect after the existing settle/brew effect:
```tsx
  // The player reaching a broken rack opens its mini-game overlay; leaving
  // 'repairing' (walk away or REPAIR_DONE) closes it. NPCs never open overlays.
  useEffect(() => {
    if (characterId !== PLAYER_ID || stateKind !== 'repairing') return
    const state = useCharacterStore.getState().characters[characterId]?.state
    if (state?.kind !== 'repairing') return
    useServerIncidentsStore.getState().beginRepair(state.role as ServerRole)
    return () => {
      useServerIncidentsStore.getState().closeMinigame()
    }
  }, [stateKind, characterId])
```

- [ ] **Step 4: Finish the real ServerRoom wiring**

In `src/rooms/ServerRoom.tsx`, add the imports at the top:
```tsx
import { useCharacterStore } from '../character/characterStore'
import { ROLE_BY_SEED } from '../game/serverIncidentsStore'
```

Replace the temporary no-op rack mapping with:
```tsx
      {RACK_X.map((x, i) => (
        <ServerRack
          key={x}
          position={[x, 0, 0]}
          seed={i}
          onRepair={(target) => useCharacterStore.getState().clickServer(target, ROLE_BY_SEED[i])}
        />
      ))}
```

- [ ] **Step 5: Verify the walk-to-repair flow**

Run `npm run dev`. Seed free-play (console):
```js
;(await import('/src/game/serverIncidentsStore.ts')).useServerIncidentsStore.getState().breakServer('database')
```
Click the broken `БД` rack. Expected: the player walks into the server room, stops in front of that rack, and `useServerIncidentsStore.getState().activeMinigame` becomes `{ role:'database', kind:'sqli' }`. The rack's status becomes `'repairing'`. `tsc --noEmit` passes. (No overlay renders yet — Task 4.)

- [ ] **Step 6: Commit**

```bash
git add src/character/characterMachine.ts src/character/characterStore.ts src/character/CharacterModel.tsx src/rooms/ServerRoom.tsx
git commit -m "feat: repair flow via character state machine (walk to rack, open mini-game on arrival)"
```

---

## Task 4: Mini-game overlay shell, registry, and CSS

**Files:**
- Create: `src/game/minigames/registry.ts`
- Create: `src/game/minigames/MinigameOverlay.tsx`
- Modify: `src/ui/ui.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useServerIncidentsStore`, `useCharacterStore`, `PLAYER_ID`.
- Produces:
  - `interface MinigameModule<S>` contract in `registry.ts`
  - `MINIGAME_MODULES: Record<MinigameKind, MinigameModule<any>>`
  - `<MinigameOverlay/>` component
  - `window.__breakServer` dev global

- [ ] **Step 1: Define the mini-game module contract + registry (with a temporary stub)**

Create `src/game/minigames/registry.ts`:

```tsx
import type { FC } from 'react'
import type { MinigameKind } from '../serverIncidentsStore'

// Every mini-game exposes this tiny contract so the overlay shell stays
// generic. Pure scenario data + evaluation live in a sibling `.ts` file; the
// interactive part is `Component`.
export interface MinigameModule<S> {
  title: string
  // Pick a scenario from the hand-written pool. `rng` is 0..1 (Math.random by
  // default) — passed in so callers stay deterministic in tests if needed.
  pickScenario: (rng: () => number) => S
  brief: (scenario: S) => string
  // Called on win → 2-3 plain-language security takeaways. `won` lets a game
  // tailor the debrief for a loss.
  takeaways: (scenario: S, won: boolean) => string[]
  Component: FC<{ scenario: S; onWin: () => void; onLose: () => void }>
}

// Populated as each game lands (Tasks 5-7). Temporary stub keeps Task 4
// runnable end-to-end; replaced by the real modules.
const STUB: MinigameModule<{ id: string }> = {
  title: 'Заглушка',
  pickScenario: () => ({ id: 'stub' }),
  brief: () => 'Временная заглушка мини-игры.',
  takeaways: () => ['Заглушка заменяется реальной игрой.'],
  Component: ({ onWin, onLose }) => (
    <div className="minigame-stub">
      <button className="primary" onClick={onWin}>
        Победа
      </button>
      <button className="primary" onClick={onLose}>
        Проигрыш
      </button>
    </div>
  ),
}

export const MINIGAME_MODULES: Record<MinigameKind, MinigameModule<any>> = {
  firewall: STUB,
  logs: STUB,
  sqli: STUB,
}
```

- [ ] **Step 2: Build the overlay shell + result screen**

Create `src/game/minigames/MinigameOverlay.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { MINIGAME_MODULES } from './registry'
import '../../ui/ui.css'

type Phase = { kind: 'playing' } | { kind: 'result'; won: boolean }

export function MinigameOverlay() {
  const active = useServerIncidentsStore((s) => s.activeMinigame)
  const completeRepair = useServerIncidentsStore((s) => s.completeRepair)
  const failAttempt = useServerIncidentsStore((s) => s.failAttempt)
  const closeMinigame = useServerIncidentsStore((s) => s.closeMinigame)

  // Reset per-incident local state whenever a different mini-game opens.
  const gameKey = active ? active.role : 'none'
  const [phase, setPhase] = useState<Phase>({ kind: 'playing' })
  const [scenarioNonce, setScenarioNonce] = useState(0)

  const module = active ? MINIGAME_MODULES[active.kind] : null
  const scenario = useMemo(
    () => (module ? module.pickScenario(Math.random) : null),
    // reselect on new game or an explicit retry
    [module, gameKey, scenarioNonce],
  )

  if (!active || !module || !scenario) return null

  const returnPlayerToIdle = () => useCharacterStore.getState().dispatchTo(PLAYER_ID, { type: 'REPAIR_DONE' })

  const onWin = () => setPhase({ kind: 'result', won: true })
  const onLose = () => {
    failAttempt(active.role)
    setPhase({ kind: 'result', won: false })
  }
  const finishWin = () => {
    completeRepair(active.role)
    returnPlayerToIdle()
  }
  const retry = () => {
    setScenarioNonce((n) => n + 1)
    setPhase({ kind: 'playing' })
  }
  const exit = () => {
    closeMinigame()
    returnPlayerToIdle()
  }

  const Body = module.Component

  return (
    <div className="overlay-backdrop">
      <div className="minigame" onClick={(e) => e.stopPropagation()}>
        <div className="minigame-header">
          <span className="minigame-title">{module.title}</span>
          <button className="minigame-close" onClick={exit} aria-label="Выйти">
            ✕
          </button>
        </div>

        {phase.kind === 'playing' ? (
          <>
            <p className="minigame-brief">{module.brief(scenario)}</p>
            <div className="minigame-body">
              {/* key forces a fresh mount on retry */}
              <Body key={scenarioNonce} scenario={scenario} onWin={onWin} onLose={onLose} />
            </div>
          </>
        ) : (
          <div className="minigame-result">
            <h2 className={phase.won ? 'minigame-verdict minigame-verdict--win' : 'minigame-verdict minigame-verdict--lose'}>
              {phase.won ? 'Сервер восстановлен' : 'Атака не отражена'}
            </h2>
            <ul className="minigame-takeaways">
              {module.takeaways(scenario, phase.won).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <div className="minigame-actions">
              {phase.won ? (
                <button className="primary" onClick={finishWin}>
                  Готово
                </button>
              ) : (
                <>
                  <button className="primary" onClick={retry}>
                    Ещё раз
                  </button>
                  <button className="minigame-secondary" onClick={exit}>
                    Выйти
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add overlay styles**

Append to `src/ui/ui.css`:

```css
/* Server security mini-games */
.minigame {
  width: min(760px, calc(100vw - 48px));
  max-height: calc(100vh - 64px);
  overflow: auto;
  background: linear-gradient(160deg, #202b39, #161f2a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  color: #e8edf4;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  padding: 22px 24px 26px;
  animation: card-in 0.35s ease-out;
}
.minigame-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.minigame-title {
  font: 700 18px system-ui, sans-serif;
  letter-spacing: 0.02em;
}
.minigame-close {
  background: none;
  border: none;
  color: #7f8ea0;
  font-size: 20px;
  cursor: pointer;
}
.minigame-close:hover {
  color: #e8edf4;
}
.minigame-brief {
  margin: 0 0 16px;
  color: #a9b8c9;
  font-size: 14px;
  line-height: 1.5;
}
.minigame-body {
  font: 400 14px system-ui, sans-serif;
}
.minigame-result {
  text-align: center;
  padding: 8px 0 4px;
}
.minigame-verdict {
  font-size: 20px;
  margin: 4px 0 16px;
}
.minigame-verdict--win {
  color: #5fd08a;
}
.minigame-verdict--lose {
  color: #ff7676;
}
.minigame-takeaways {
  text-align: left;
  max-width: 560px;
  margin: 0 auto 20px;
  padding-left: 20px;
  line-height: 1.6;
  color: #cdd8e4;
}
.minigame-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.minigame-secondary {
  padding: 11px 22px;
  font: 600 14px system-ui, sans-serif;
  color: #cdd8e4;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  cursor: pointer;
}
.minigame-secondary:hover {
  border-color: rgba(255, 255, 255, 0.4);
}
.minigame-stub {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding: 24px 0;
}
/* shared building blocks used by the individual games (Tasks 5-7) */
.mg-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}
.mg-toggle {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: #223042;
  color: #dbe6f2;
  cursor: pointer;
  font: 600 13px ui-monospace, monospace;
}
.mg-toggle--on {
  background: #2f6b45;
  border-color: #43a06a;
}
.mg-log {
  font: 12px/1.5 ui-monospace, monospace;
  background: #0e151d;
  border-radius: 10px;
  padding: 10px 12px;
  max-height: 320px;
  overflow: auto;
}
.mg-log-line {
  padding: 2px 6px;
  border-radius: 5px;
  cursor: pointer;
  white-space: pre;
}
.mg-log-line--flagged {
  background: rgba(255, 122, 122, 0.22);
  outline: 1px solid rgba(255, 122, 122, 0.5);
}
.mg-query {
  font: 13px ui-monospace, monospace;
  background: #0e151d;
  border-radius: 8px;
  padding: 10px 12px;
  color: #a9d6ff;
  word-break: break-all;
}
.mg-hint {
  color: #8ea0b3;
  font-size: 13px;
}
```

- [ ] **Step 4: Mount the overlay + add the dev trigger**

In `src/App.tsx`:

Add import:
```tsx
import { MinigameOverlay } from './game/minigames/MinigameOverlay'
import { useServerIncidentsStore, type ServerRole } from './game/serverIncidentsStore'
```

Extend the existing dev block:
```tsx
if (import.meta.env.DEV) {
  ;(window as unknown as { __startCutscene?: (id: string) => void }).__startCutscene = (id: string) =>
    useCutsceneStore.getState().startScene(id)
  ;(window as unknown as { __breakServer?: (role?: ServerRole) => void }).__breakServer = (role?: ServerRole) =>
    useServerIncidentsStore.getState().breakServer(role)
}
```

Add `<MinigameOverlay />` next to the other overlays in the returned JSX:
```tsx
      <IntroOverlay />
      <DialoguePanel />
      <TaskBoard />
      <MinigameOverlay />
```

- [ ] **Step 5: Verify the full loop with the stub game**

Run `npm run dev`. In the console: `window.__breakServer('gateway')`. Click the broken rack → player walks over → overlay opens titled "Заглушка". Click **Победа** → result screen "Сервер восстановлен" → **Готово** → overlay closes, rack turns green (`status:'ok'`), `history.length` incremented, player free to move. Break again, click, **Проигрыш** → "Атака не отражена", `racks.gateway.failures === 1`, **Ещё раз** returns to play, **Выйти** closes leaving the rack broken. `tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add src/game/minigames/registry.ts src/game/minigames/MinigameOverlay.tsx src/ui/ui.css src/App.tsx
git commit -m "feat: mini-game overlay shell, registry contract, result screen, dev trigger"
```

---

## Task 5: Firewall mini-game (rack `gateway`)

**Files:**
- Create: `src/game/minigames/firewall.ts`
- Create: `src/game/minigames/firewall.tsx`
- Modify: `src/game/minigames/registry.ts`

**Interfaces:**
- Consumes: `MinigameModule` (Task 4).
- Produces: `firewallModule: MinigameModule<FirewallScenario>`.

- [ ] **Step 1: Pure firewall logic + scenarios**

Create `src/game/minigames/firewall.ts`:

```ts
export interface PortDef {
  port: number
  label: string
}
export interface RequestCard {
  id: string
  label: string
  port: number
  legit: boolean // true = legitimate traffic that must be allowed
}
export interface FirewallScenario {
  id: string
  brief: string
  ports: PortDef[]
  neededOpen: number[] // ports the player SHOULD leave open
  requests: RequestCard[]
  uptimeThreshold: number // 0..1 fraction of legit traffic that must pass
}
export interface FirewallResult {
  breach: number // attacks that hit an open port
  legitBlocked: number
  uptime: number // 0..1
  passed: boolean
}

// Score the player's open/closed config against the scenario's traffic.
export function evaluateFirewall(openPorts: Set<number>, s: FirewallScenario): FirewallResult {
  let breach = 0
  let legitTotal = 0
  let legitBlocked = 0
  for (const r of s.requests) {
    if (r.legit) {
      legitTotal++
      if (!openPorts.has(r.port)) legitBlocked++
    } else if (openPorts.has(r.port)) {
      breach++
    }
  }
  const uptime = legitTotal === 0 ? 1 : 1 - legitBlocked / legitTotal
  return { breach, legitBlocked, uptime, passed: breach === 0 && uptime >= s.uptimeThreshold }
}

export const FIREWALL_SCENARIOS: FirewallScenario[] = [
  {
    id: 'web-tier',
    brief: 'Публичный веб-сервер. Пропусти клиентов, но закрой всё лишнее — база данных смотреть в интернет не должна.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 80, label: '80 · HTTP' },
      { port: 443, label: '443 · HTTPS' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 21, label: '21 · FTP' },
    ],
    neededOpen: [443, 80],
    requests: [
      { id: 'a', label: 'Клиент открывает сайт (HTTPS)', port: 443, legit: true },
      { id: 'b', label: 'Старый клиент по HTTP', port: 80, legit: true },
      { id: 'c', label: 'Бот подбирает пароль MySQL снаружи', port: 3306, legit: false },
      { id: 'd', label: 'Скан уязвимого FTP', port: 21, legit: false },
      { id: 'e', label: 'Перебор SSH с чужого IP', port: 22, legit: false },
    ],
    uptimeThreshold: 1,
  },
  {
    id: 'admin-tier',
    brief: 'Внутренний сервис. Админам нужен SSH, приложению — HTTPS. FTP давно пора выключить.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 443, label: '443 · HTTPS' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 21, label: '21 · FTP' },
      { port: 8080, label: '8080 · debug' },
    ],
    neededOpen: [22, 443],
    requests: [
      { id: 'a', label: 'Админ подключается по SSH (доверенный IP)', port: 22, legit: true },
      { id: 'b', label: 'Приложение ходит по HTTPS', port: 443, legit: true },
      { id: 'c', label: 'Кто-то дергает debug-порт 8080', port: 8080, legit: false },
      { id: 'd', label: 'Скан FTP', port: 21, legit: false },
      { id: 'e', label: 'Прямой коннект к MySQL снаружи', port: 3306, legit: false },
    ],
    uptimeThreshold: 1,
  },
  {
    id: 'api-tier',
    brief: 'API-шлюз. Наружу — только HTTPS. Всё остальное — потенциальная дверь для атаки.',
    ports: [
      { port: 22, label: '22 · SSH' },
      { port: 443, label: '443 · HTTPS' },
      { port: 25, label: '25 · SMTP' },
      { port: 3306, label: '3306 · MySQL' },
      { port: 6379, label: '6379 · Redis' },
    ],
    neededOpen: [443],
    requests: [
      { id: 'a', label: 'Мобильное приложение (HTTPS)', port: 443, legit: true },
      { id: 'b', label: 'Партнёрский сервис (HTTPS)', port: 443, legit: true },
      { id: 'c', label: 'Открытый Redis без пароля', port: 6379, legit: false },
      { id: 'd', label: 'Спам-рассылка через SMTP', port: 25, legit: false },
      { id: 'e', label: 'Прямой коннект к MySQL', port: 3306, legit: false },
    ],
    uptimeThreshold: 1,
  },
]

export function pickFirewallScenario(rng: () => number): FirewallScenario {
  return FIREWALL_SCENARIOS[Math.floor(rng() * FIREWALL_SCENARIOS.length)]
}

export function firewallTakeaways(s: FirewallScenario, won: boolean): string[] {
  const needed = s.neededOpen.join(', ')
  return [
    won
      ? `Верно: открыты только нужные порты (${needed}), остальное закрыто.`
      : `Правило «default deny»: закрой всё, открой только необходимое (${needed}).`,
    'Базы данных (MySQL 3306, Redis 6379) никогда не смотрят в интернет напрямую.',
    'Устаревшие протоколы вроде FTP (21) — лёгкая мишень, их отключают.',
  ]
}
```

- [ ] **Step 2: Firewall component**

Create `src/game/minigames/firewall.tsx`:

```tsx
import { useState } from 'react'
import type { MinigameModule } from './registry'
import {
  type FirewallScenario,
  evaluateFirewall,
  pickFirewallScenario,
  firewallTakeaways,
} from './firewall'

function FirewallGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: FirewallScenario
  onWin: () => void
  onLose: () => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ReturnType<typeof evaluateFirewall> | null>(null)

  const toggle = (port: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(port)) next.delete(port)
      else next.add(port)
      return next
    })

  const run = () => {
    const r = evaluateFirewall(open, scenario)
    setResult(r)
    if (r.passed) onWin()
    else onLose()
  }

  return (
    <div>
      <p className="mg-hint">Нажми порт, чтобы открыть (зелёный) или закрыть его. Потом запусти трафик.</p>
      <div className="mg-row">
        {scenario.ports.map((p) => (
          <button
            key={p.port}
            className={open.has(p.port) ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
            onClick={() => toggle(p.port)}
          >
            {p.label} · {open.has(p.port) ? 'открыт' : 'закрыт'}
          </button>
        ))}
      </div>
      <ul className="minigame-takeaways">
        {scenario.requests.map((req) => (
          <li key={req.id}>{req.label}</li>
        ))}
      </ul>
      {result && !result.passed ? (
        <p className="mg-hint">
          Взломов: {result.breach}, заблокировано легитимного трафика: {result.legitBlocked}. Попробуй ещё.
        </p>
      ) : null}
      <div className="minigame-actions">
        <button className="primary" onClick={run}>
          Запустить трафик
        </button>
      </div>
    </div>
  )
}

export const firewallModule: MinigameModule<FirewallScenario> = {
  title: 'Фаервол · Шлюз',
  pickScenario: pickFirewallScenario,
  brief: (s) => s.brief,
  takeaways: firewallTakeaways,
  Component: FirewallGame,
}
```

- [ ] **Step 3: Register the firewall module**

In `src/game/minigames/registry.ts`, import and replace the `firewall` entry.
The `.tsx` extension is **required** (not a mistake): the sibling `firewall.ts`
holds the pure logic, so an extensionless `'./firewall'` would resolve to the
`.ts` file. `tsconfig` enables this via `allowImportingTsExtensions`.

```ts
import { firewallModule } from './firewall.tsx'
```
```ts
export const MINIGAME_MODULES: Record<MinigameKind, MinigameModule<any>> = {
  firewall: firewallModule,
  logs: STUB,
  sqli: STUB,
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. `window.__breakServer('gateway')`, click the rack. Play: open only the needed ports and run traffic → win, "Сервер восстановлен" with 3 takeaways. Open a database port and run → lose, breach counter shown, **Ещё раз** gives a possibly-different scenario. `tsc --noEmit` passes.

- [ ] **Step 5: Commit**

```bash
git add src/game/minigames/firewall.ts src/game/minigames/firewall.tsx src/game/minigames/registry.ts
git commit -m "feat: firewall mini-game (default-deny port config puzzle)"
```

---

## Task 6: Logs mini-game (rack `auth`)

**Files:**
- Create: `src/game/minigames/logs.ts`
- Create: `src/game/minigames/logs.tsx`
- Modify: `src/game/minigames/registry.ts`

**Interfaces:**
- Consumes: `MinigameModule` (Task 4).
- Produces: `logsModule: MinigameModule<LogsScenario>`.

- [ ] **Step 1: Pure logs logic + scenarios**

Create `src/game/minigames/logs.ts`:

```ts
export interface LogLine {
  id: string
  time: string
  ip: string
  user: string
  event: string
  suspicious: boolean // part of the attack evidence
}
export interface LogsScenario {
  id: string
  brief: string
  lines: LogLine[]
  attackerIp: string
  candidateIps: string[] // options in the ban selector
}
export interface LogsResult {
  flaggedCorrect: boolean
  bannedCorrect: boolean
  passed: boolean
  missed: LogLine[] // evidence the player failed to flag
  falsePositives: number
}

// Win = all evidence lines flagged, no innocent lines flagged, correct IP banned.
export function evaluateLogs(flaggedIds: Set<string>, bannedIp: string, s: LogsScenario): LogsResult {
  const evidence = s.lines.filter((l) => l.suspicious)
  const missed = evidence.filter((l) => !flaggedIds.has(l.id))
  let falsePositives = 0
  for (const id of flaggedIds) {
    const line = s.lines.find((l) => l.id === id)
    if (line && !line.suspicious) falsePositives++
  }
  const flaggedCorrect = missed.length === 0 && falsePositives === 0
  const bannedCorrect = bannedIp === s.attackerIp
  return { flaggedCorrect, bannedCorrect, passed: flaggedCorrect && bannedCorrect, missed, falsePositives }
}

export const LOGS_SCENARIOS: LogsScenario[] = [
  {
    id: 'brute-force',
    brief: 'Кто-то ломился в аккаунт всю ночь. Отметь улики атаки и забань нужный IP.',
    attackerIp: '185.203.44.10',
    candidateIps: ['10.0.0.5', '185.203.44.10', '10.0.0.9', '52.14.7.201'],
    lines: [
      { id: '1', time: '02:58', ip: '10.0.0.5', user: 'anna', event: 'login OK', suspicious: false },
      { id: '2', time: '03:11', ip: '185.203.44.10', user: 'admin', event: 'FAILED password', suspicious: true },
      { id: '3', time: '03:11', ip: '185.203.44.10', user: 'admin', event: 'FAILED password', suspicious: true },
      { id: '4', time: '03:12', ip: '185.203.44.10', user: 'admin', event: 'FAILED password ×180', suspicious: true },
      { id: '5', time: '03:14', ip: '52.14.7.201', user: 'deploy', event: 'login OK', suspicious: false },
      { id: '6', time: '03:15', ip: '185.203.44.10', user: 'admin', event: 'login OK', suspicious: true },
      { id: '7', time: '03:16', ip: '185.203.44.10', user: 'admin', event: 'sudo: added user "svc-x"', suspicious: true },
      { id: '8', time: '08:02', ip: '10.0.0.9', user: 'boris', event: 'login OK', suspicious: false },
    ],
  },
  {
    id: 'stolen-session',
    brief: 'Легитимный пользователь вдруг оказался в двух местах сразу. Найди подмену и забань чужой IP.',
    attackerIp: '91.240.16.7',
    candidateIps: ['203.0.113.8', '91.240.16.7', '10.0.0.12', '198.51.100.4'],
    lines: [
      { id: '1', time: '14:00', ip: '10.0.0.12', user: 'maria', event: 'login OK (office)', suspicious: false },
      { id: '2', time: '14:03', ip: '10.0.0.12', user: 'maria', event: 'open dashboard', suspicious: false },
      { id: '3', time: '14:05', ip: '91.240.16.7', user: 'maria', event: 'login OK (session reused)', suspicious: true },
      { id: '4', time: '14:06', ip: '91.240.16.7', user: 'maria', event: 'export all customers', suspicious: true },
      { id: '5', time: '14:07', ip: '91.240.16.7', user: 'maria', event: 'change recovery email', suspicious: true },
      { id: '6', time: '14:10', ip: '10.0.0.12', user: 'maria', event: 'open reports', suspicious: false },
      { id: '7', time: '18:20', ip: '198.51.100.4', user: 'ci-bot', event: 'login OK', suspicious: false },
    ],
  },
  {
    id: 'insider',
    brief: 'Веб-сервису вдруг понадобились права рута. Отметь подозрительные действия и забань источник.',
    attackerIp: '10.0.0.30',
    candidateIps: ['10.0.0.30', '10.0.0.5', '172.16.0.9', '203.0.113.77'],
    lines: [
      { id: '1', time: '11:00', ip: '10.0.0.5', user: 'anna', event: 'login OK', suspicious: false },
      { id: '2', time: '11:20', ip: '10.0.0.30', user: 'www-data', event: 'sudo: cat /etc/shadow', suspicious: true },
      { id: '3', time: '11:21', ip: '10.0.0.30', user: 'www-data', event: 'sudo: add key to authorized_keys', suspicious: true },
      { id: '4', time: '11:22', ip: '172.16.0.9', user: 'backup', event: 'nightly backup OK', suspicious: false },
      { id: '5', time: '11:25', ip: '10.0.0.30', user: 'www-data', event: 'download db dump', suspicious: true },
      { id: '6', time: '12:00', ip: '10.0.0.5', user: 'anna', event: 'open email', suspicious: false },
    ],
  },
]

export function pickLogsScenario(rng: () => number): LogsScenario {
  return LOGS_SCENARIOS[Math.floor(rng() * LOGS_SCENARIOS.length)]
}

export function logsTakeaways(s: LogsScenario, won: boolean): string[] {
  return [
    won
      ? 'Ты нашёл цепочку: всплеск отказов → успешный вход → действия под чужим именем.'
      : 'Ищи цепочку: много FAILED подряд, затем внезапный login OK — это и есть взлом.',
    'Успешный вход сразу после сотен неудачных с того же IP — классический признак брутфорса.',
    'Действия с повышением прав (sudo, экспорт данных, смена почты) после входа — подтверждение компрометации.',
  ]
}
```

- [ ] **Step 2: Logs component**

Create `src/game/minigames/logs.tsx`:

```tsx
import { useState } from 'react'
import type { MinigameModule } from './registry'
import { type LogsScenario, evaluateLogs, pickLogsScenario, logsTakeaways } from './logs'

function LogsGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: LogsScenario
  onWin: () => void
  onLose: () => void
}) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [bannedIp, setBannedIp] = useState<string>('')
  const [hint, setHint] = useState<string | null>(null)

  const toggle = (id: string) =>
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = () => {
    if (!bannedIp) {
      setHint('Сначала выбери IP для бана.')
      return
    }
    const r = evaluateLogs(flagged, bannedIp, scenario)
    if (r.passed) {
      onWin()
      return
    }
    if (!r.bannedCorrect) setHint('Забанен не тот IP — перепроверь, откуда шла атака.')
    else if (r.missed.length) setHint('Ты отметил не все улики атаки.')
    else setHint('Отмечены лишние строки — легитимный трафик это не атака.')
    onLose()
  }

  return (
    <div>
      <p className="mg-hint">Кликай подозрительные строки, чтобы отметить их. Затем выбери IP атакующего и забань.</p>
      <div className="mg-log">
        {scenario.lines.map((l) => (
          <div
            key={l.id}
            className={flagged.has(l.id) ? 'mg-log-line mg-log-line--flagged' : 'mg-log-line'}
            onClick={() => toggle(l.id)}
          >
            {l.time}  {l.ip.padEnd(15)}  {l.user.padEnd(9)}  {l.event}
          </div>
        ))}
      </div>
      <div className="mg-row">
        {scenario.candidateIps.map((ip) => (
          <button
            key={ip}
            className={bannedIp === ip ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
            onClick={() => setBannedIp(ip)}
          >
            {ip}
          </button>
        ))}
      </div>
      {hint ? <p className="mg-hint">{hint}</p> : null}
      <div className="minigame-actions">
        <button className="primary" onClick={submit}>
          Забанить
        </button>
      </div>
    </div>
  )
}

export const logsModule: MinigameModule<LogsScenario> = {
  title: 'Логи · Аутентификация',
  pickScenario: pickLogsScenario,
  brief: (s) => s.brief,
  takeaways: logsTakeaways,
  Component: LogsGame,
}
```

- [ ] **Step 3: Register the logs module**

In `src/game/minigames/registry.ts` add:
```ts
import { logsModule } from './logs.tsx'
```
and set `logs: logsModule` in `MINIGAME_MODULES`.

- [ ] **Step 4: Verify**

Run `npm run dev`. `window.__breakServer('auth')`, click the rack. Flag the FAILED-burst + subsequent OK + sudo lines, pick `185.203.44.10`, Забанить → win. Try a wrong IP → lose with the targeted hint. `tsc --noEmit` passes.

- [ ] **Step 5: Commit**

```bash
git add src/game/minigames/logs.ts src/game/minigames/logs.tsx src/game/minigames/registry.ts
git commit -m "feat: log-forensics mini-game (spot brute-force evidence, ban attacker IP)"
```

---

## Task 7: SQL-injection mini-game (rack `database`)

**Files:**
- Create: `src/game/minigames/sqli.ts`
- Create: `src/game/minigames/sqli.tsx`
- Modify: `src/game/minigames/registry.ts`

**Interfaces:**
- Consumes: `MinigameModule` (Task 4).
- Produces: `sqliModule: MinigameModule<SqliScenario>`.

- [ ] **Step 1: Pure sqli logic + scenarios**

Create `src/game/minigames/sqli.ts`:

```ts
export interface SqliScenario {
  id: string
  brief: string
  table: string
  column: string
  // tokens the player assembles in the ATTACK phase to inject
  attackTokens: string[]
  // rows that "leak" when the injection succeeds
  leakedRows: string[]
}

// A heuristic "is this input an auth-bypass injection?" — true when the input
// breaks out of the quoted string and adds an always-true clause or comment.
export function isInjection(input: string): boolean {
  const s = input.replace(/\s+/g, '').toLowerCase()
  return (
    s.includes("'or'1'='1") ||
    s.includes('or1=1') ||
    s.includes("'or1=1") ||
    (s.includes("'") && s.includes('--')) ||
    (s.includes("'or'") && s.endsWith('--'))
  )
}

// Vulnerable path: the input is concatenated straight into the query, so an
// injection rewrites its logic and bypasses auth.
export function buildConcatQuery(s: SqliScenario, input: string): string {
  return `SELECT * FROM ${s.table} WHERE ${s.column} = '${input}'`
}
export function concatBypasses(_s: SqliScenario, input: string): boolean {
  return isInjection(input)
}

// Safe path: the input is bound as a parameter, so it is ALWAYS treated as a
// literal value — the same injection string now matches nothing.
export function buildParamQuery(s: SqliScenario): string {
  return `SELECT * FROM ${s.table} WHERE ${s.column} = ?`
}
export function paramBypasses(): boolean {
  return false
}

export const SQLI_SCENARIOS: SqliScenario[] = [
  {
    id: 'login',
    brief: 'Форма входа в твой продукт. Сначала сам взломай её, потом почини.',
    table: 'users',
    column: 'login',
    attackTokens: ["'", ' OR ', "'1'='1", ' --', 'admin', 'password'],
    leakedRows: ['1  admin   ceo@startup.io', '2  anna   anna@startup.io', '3  boris  boris@startup.io'],
  },
  {
    id: 'search',
    brief: 'Поиск по каталогу товаров. Найди дыру инъекцией, затем закрой её.',
    table: 'products',
    column: 'name',
    attackTokens: ["'", ' OR ', "'1'='1", ' --', 'phone', 'laptop'],
    leakedRows: ['sku-1  Ноутбук   1290$', 'sku-2  Телефон   690$', 'ADMIN  внутренний прайс  секрет'],
  },
]

export function pickSqliScenario(rng: () => number): SqliScenario {
  return SQLI_SCENARIOS[Math.floor(rng() * SQLI_SCENARIOS.length)]
}

export function sqliTakeaways(_s: SqliScenario, won: boolean): string[] {
  return [
    won
      ? 'Ты увидел дыру и закрыл её: ввод больше не влияет на структуру запроса.'
      : 'Пока запрос собирается склейкой строк, ввод может переписать его логику.',
    "Инъекция ' OR '1'='1' -- делает условие всегда истинным и пропускает без пароля.",
    'Параметризованный запрос (WHERE login = ?) передаёт ввод как данные, а не как код — атака превращается в обычный текст.',
  ]
}
```

- [ ] **Step 2: SQLi component (two phases)**

Create `src/game/minigames/sqli.tsx`:

```tsx
import { useState } from 'react'
import type { MinigameModule } from './registry'
import {
  type SqliScenario,
  buildConcatQuery,
  concatBypasses,
  buildParamQuery,
  pickSqliScenario,
  sqliTakeaways,
} from './sqli'

type Phase = 'attack' | 'attack-done' | 'fix'

function SqliGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: SqliScenario
  onWin: () => void
  onLose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('attack')
  const [input, setInput] = useState('')
  const [parameterized, setParameterized] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const appendToken = (t: string) => setInput((prev) => prev + t)
  const clear = () => setInput('')

  const runAttack = () => {
    if (concatBypasses(scenario, input)) {
      setPhase('attack-done')
      setHint(null)
    } else {
      setHint('Пароль не подошёл. Подсказка: закрой кавычку и добавь всегда-истинное условие.')
      onLose()
    }
  }

  const runFix = () => {
    if (!parameterized) {
      setHint('Пока запрос собирается склейкой, атака снова пройдёт. Вынеси ввод в параметр (?).')
      onLose()
      return
    }
    // parameterized: the same attack string is now literal → rejected
    onWin()
  }

  const currentQuery = parameterized ? buildParamQuery(scenario) : buildConcatQuery(scenario, input || '…')

  return (
    <div>
      {phase === 'attack' ? (
        <>
          <p className="mg-hint">Фаза 1 — атака. Собери строку в поле логина, чтобы войти без пароля.</p>
          <div className="mg-query">{buildConcatQuery(scenario, input || '…')}</div>
          <div className="mg-row">
            {scenario.attackTokens.map((t, i) => (
              <button key={i} className="mg-toggle" onClick={() => appendToken(t)}>
                {t.trim() === '' ? '␣' : t}
              </button>
            ))}
            <button className="mg-toggle" onClick={clear}>
              очистить
            </button>
          </div>
          <p className="mg-hint">Ввод: <code>{input || '(пусто)'}</code></p>
          {hint ? <p className="mg-hint">{hint}</p> : null}
          <div className="minigame-actions">
            <button className="primary" onClick={runAttack}>
              Войти
            </button>
          </div>
        </>
      ) : phase === 'attack-done' ? (
        <>
          <p className="mg-hint">Инъекция сработала — запрос пропустил тебя и утекла таблица:</p>
          <div className="mg-query">{buildConcatQuery(scenario, input)}</div>
          <ul className="minigame-takeaways">
            {scenario.leakedRows.map((r, i) => (
              <li key={i}><code>{r}</code></li>
            ))}
          </ul>
          <div className="minigame-actions">
            <button className="primary" onClick={() => { setPhase('fix'); setHint(null) }}>
              Теперь починить →
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mg-hint">Фаза 2 — починка. Вынеси пользовательский ввод из тела запроса в параметр.</p>
          <div className="mg-query">{currentQuery}</div>
          <div className="mg-row">
            <button
              className={parameterized ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
              onClick={() => setParameterized((v) => !v)}
            >
              {parameterized ? 'ввод → параметр (?)' : 'склейка строк'}
            </button>
          </div>
          <p className="mg-hint">
            Повторная атака той же строкой <code>{input}</code>:{' '}
            {parameterized ? 'воспринята как обычный текст — вход отклонён.' : 'снова пройдёт.'}
          </p>
          {hint ? <p className="mg-hint">{hint}</p> : null}
          <div className="minigame-actions">
            <button className="primary" onClick={runFix}>
              Проверить защиту
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export const sqliModule: MinigameModule<SqliScenario> = {
  title: 'SQL-инъекция · База данных',
  pickScenario: pickSqliScenario,
  brief: (s) => s.brief,
  takeaways: sqliTakeaways,
  Component: SqliGame,
}
```

- [ ] **Step 3: Register the sqli module**

In `src/game/minigames/registry.ts` add:
```ts
import { sqliModule } from './sqli.tsx'
```
and set `sqli: sqliModule` in `MINIGAME_MODULES`. Remove the now-unused `STUB` (all three kinds are real) — delete the `STUB` constant and its import-free block.

Final `MINIGAME_MODULES`:
```ts
export const MINIGAME_MODULES: Record<MinigameKind, MinigameModule<any>> = {
  firewall: firewallModule,
  logs: logsModule,
  sqli: sqliModule,
}
```

- [ ] **Step 4: Verify all three end-to-end**

Run `npm run dev`. For each: `window.__breakServer('database')` (then `'gateway'`, `'auth'`), click rack, play to a win, confirm rack turns green and `history` grows. Confirm `window.__breakServer()` with no arg breaks a random non-backup rack and `backup` never breaks. `tsc --noEmit` passes.

- [ ] **Step 5: Headless screenshot pass (optional but recommended)**

Follow the `headless-game-verification` memo (Playwright + `recordVideo`, seed `phase:'free'`, import `/src/...` modules). Break each rack, click it, screenshot the broken rack and each overlay + result screen.

- [ ] **Step 6: Commit**

```bash
git add src/game/minigames/sqli.ts src/game/minigames/sqli.tsx src/game/minigames/registry.ts
git commit -m "feat: SQL-injection mini-game (attack-then-parameterize) + finalize registry"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** roles/plates (T2), manual `__breakServer` trigger (T4), broken visuals red+outline (T2), walk-to-repair via state machine (T3), overlay+result+takeaways (T4), three games (T5–T7), history for future penalties (T1), no penalties yet (nowhere applied), backup reserved/never-breaks (T1 `MINIGAME_BY_ROLE`), NO TESTS verification (every task's verify step).
- **Type consistency:** `beginRepair/failAttempt/completeRepair/closeMinigame`, `activeMinigame:{role,kind}`, `ROLE_BY_SEED`, `MINIGAME_BY_ROLE`, `MinigameModule<S>` (`title/pickScenario/brief/takeaways/Component`), and each game's `*Module` name are used identically across tasks.
- **Known seam:** Task 2 wires `onRepair` to a temporary no-op so it compiles alone; Task 3 Step 4 replaces it with the real `clickServer` call and adds the two imports. Don't commit Task 2 with the real imports.
```
