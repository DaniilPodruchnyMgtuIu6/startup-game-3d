# Scripted Cutscenes — Design

Adds a reusable system for scripted story "cutscenes": choreographed beats
(camera moves, NPC/actor walks, dialogue, player choices, side effects) that
can be triggered at any point in the running game. Ships alongside the
system's first concrete scene: two security guards catch the PM leaving her
computer unlocked, then confront the player, ending in a mandatory recurring
security-training duty.

## Decisions (from brainstorm)

- Scenes are written as code (async functions), not a declarative data
  graph — branching is plain `if`/`else`, no interpreter/graph engine needed.
  Chosen over a JSON scene-graph for being far cheaper to build and matching
  the codebase's existing imperative-orchestration style (`MeetPmController`
  is already a hand-written single-purpose cutscene).
- Each scene lives in its own file under `src/cutscenes/`; a registry maps
  scene id → script. Real trigger conditions (time elapsed, task completed,
  etc.) are out of scope for this iteration — the first scene is started
  manually during development via a `window.__startCutscene(id)` hook
  exposed only in dev builds. Wiring a real trigger is future work and does
  not require any change to the engine itself, only a call to
  `cutsceneStore.getState().startScene(id)` from wherever the real condition
  is detected.
- The two guards are temporary, code-spawned actors rendered as plain boxes
  (no model/animation yet, no dialogue portraits) — visual placeholders only;
  their movement, state machine and dialogue participation are fully real,
  reusing the same character store/pathfinding/talking machinery as the
  player and NPCs. Real models will be swapped in later without changing the
  scene script.
- The PM's screen not being locked is narrative flavor delivered through
  dialogue text only — no separate "locked screen" visual mechanic is built.
- The guard scene has exactly one player choice, and both branches still end
  in the same mandatory outcome (a recurring task on the board): the harsher
  branch (deflecting blame onto the PM) additionally logs a reprimand on the
  player, the calmer branch (accepting responsibility) does not.
- Per `AGENTS.md` ("NO TESTS"), this feature is verified by running the dev
  server and checking behavior directly (see Verification), not by writing
  automated unit/component tests.

## Architecture

New `src/cutscenes/` module, kept separate from both the character
simulation (`src/character/`) and the story/dialogue state (`src/game/`),
depending on both:

```
src/cutscenes/types.ts           — CutsceneDirector / CutsceneScript types
src/cutscenes/cutsceneStore.ts   — zustand: active scene id, spawned actors
src/cutscenes/director.ts        — createDirector(): implements CutsceneDirector over characterStore/gameStore/camera
src/cutscenes/CutsceneRunner.tsx — mounted once; runs the active script, owns lock/unlock of input, camera, NPC brains
src/cutscenes/registry.ts        — CUTSCENES: Record<string, CutsceneEntry> (script + optional ownsNpcIds)
src/cutscenes/securityBreach.ts  — first scene's script + dialogue content

src/character/PlaceholderActorModel.tsx — box-body renderer for actors with no real model yet
src/character/useCharacterTransform.ts  — walking/position/rotation stepping hook, extracted out of CharacterModel.tsx

src/scene/camera/cameraController.ts — registerCameraControls/flyTo/setInputEnabled, wraps the CameraControls instance
```

Modified:

```
src/scene/camera/IsometricCamera.tsx — registers its CameraControls instance with cameraController
src/character/CharacterModel.tsx     — movement/pose stepping moved into useCharacterTransform (behavior unchanged)
src/character/characterStore.ts      — + inputLocked/setInputLocked, + sceneOwned/setSceneOwned (see below)
src/character/Npcs.tsx               — useNpcBrain also gates on characterStore.sceneOwned
src/game/gameStore.ts                — + activeChoice/chooseOption, + reprimands/addReprimand, tasks become store state
src/game/tasks.ts                    — BOARD_TASKS becomes the store's initial tasks seed (no longer read directly by UI)
src/ui/TaskBoard.tsx                 — reads tasks from gameStore instead of the static BOARD_TASKS export
src/ui/DialoguePanel.tsx             — renders choice buttons instead of the advance button when activeChoice is set
src/App.tsx                          — mounts CutsceneRunner; dev-only window.__startCutscene hook
```

`characterStore.ts` — not `cutsceneStore.ts` — owns the "is the player/NPCs
allowed to act on their own" flags. `clickWorkstation`/`clickCoffeeMachine`/
`clickSeat`/`clickSofa`/`clickFloor` are called from many different room/
furniture files (`OpenSpace.tsx`, `Kitchen.tsx`, `CeoOffice.tsx`,
`FocusRoom.tsx`, `GameRoom.tsx`, `MeetingRoom.tsx`,
`FloorClickCatcher.tsx`...), all of them already funneling into
`characterStore`'s shared `playerClick` factory and `clickFloor` action —
gating there is one change instead of patching every call site (and nothing
new needs updating when future furniture is added). Keeping the flags in
`characterStore` also avoids a circular import: `cutscenes/` already depends
on `character/` (via `director.ts`); if `character/Npcs.tsx` also imported
`cutsceneStore.ts`, the dependency would go both ways.

### Types (`src/cutscenes/types.ts`)

```ts
export type Point = [number, number, number]

export interface CutsceneDirector {
  walk(characterId: string, point: Point): Promise<void>
  face(characterId: string, towardId: string): void
  camera(target: Point, opts?: { position?: Point; durationMs?: number }): Promise<void>
  say(lines: DialogueLine[]): Promise<void>
  choice(options: { id: string; label: string }[]): Promise<string>
  wait(ms: number): Promise<void>
  talk(characterId: string, on: boolean): void
  spawnActor(id: string, at: Point, rotationY?: number, color?: string): void
  despawnActor(id: string): void
  addTask(task: BoardTask): void
}

export type CutsceneScript = (director: CutsceneDirector) => Promise<void>
```

`DialogueLine` and `BoardTask` are imported from `src/game/gameStore.ts` and
`src/game/tasks.ts` respectively (both already exist).

### `cutsceneStore.ts`

```ts
interface CutsceneStore {
  activeSceneId: string | null
  actors: Record<string, { position: Point; rotationY: number; color: string }>
  startScene: (id: string) => void
  endScene: () => void
  upsertActor: (id: string, entry: { position: Point; rotationY: number; color: string }) => void
  removeActor: (id: string) => void
}
```

`startScene`/`endScene` only flip `activeSceneId` and reset the actor map —
the actual script execution loop lives in `CutsceneRunner`, which reacts to
`activeSceneId` changing and is also where `characterStore`'s
`setInputLocked`/`setSceneOwned` get called (see below) — `cutsceneStore`
itself never reaches into `characterStore`.

`characterStore.ts` additions:

```ts
inputLocked: boolean
setInputLocked: (locked: boolean) => void
sceneOwned: Set<string>
setSceneOwned: (ids: Set<string>) => void
```

`clickFloor` and the shared `playerClick` factory both start with
`if (get().inputLocked) return` (same guard style already used for
`isTargetFree`). `Npcs.tsx`'s `useNpcBrain` adds
`const sceneOwned = useCharacterStore((s) => s.sceneOwned.has(id))` and
includes it in the existing gating condition (alongside `gamePhase !== 'free'`)
and effect dependency array.

### `director.ts`

`createDirector(): CutsceneDirector` closes over `useCharacterStore`,
`useGameStore`, and `cameraController`. It has no notion of "which NPCs does
this scene own" — that gating is handled by `CutsceneRunner` before the
script runs (see below), not by the director the script calls into.

- `walk` dispatches `CLICK_FLOOR` (reusing existing pathfinding/obstacle
  avoidance — no new movement logic) and resolves via a
  `useCharacterStore.subscribe` callback that fires once
  `characters[id].state.kind` leaves `'walking'`.
- `face` computes the facing angle between two live positions and calls
  `setTransform` immediately (same math `MeetPmController` already uses).
- `camera` calls `cameraController.flyTo(opts.position ?? currentPos, target,
  opts.durationMs)`; resolves when the transition's promise resolves.
- `say` calls `gameStore.startDialogue(lines)` and resolves once
  `activeDialogue` becomes `null` (subscribed the same way as `walk`) — this
  is the existing `DialoguePanel`/advance-button flow, unchanged.
- `choice` sets `gameStore.activeChoice = { options }`; resolves with the
  picked id once `gameStore.chooseOption(id)` is called from the UI, then
  clears `activeChoice`.
- `wait` is a plain `setTimeout` promise.
- `talk` dispatches `TALK_START`/`TALK_END` to the character machine (no
  change to `characterMachine.ts` — the `talking` state already exists and is
  generic).
- `spawnActor`/`despawnActor` call `characterStore.spawnCharacter`/
  `removeCharacter` (already generic, already used by `Npcs.tsx`) plus
  `cutsceneStore.upsertActor`/`removeActor` so `CutsceneRunner` knows to
  render/stop rendering a `PlaceholderActorModel` for that id.
- `addTask` calls `gameStore.addTask(task)`.

### `registry.ts`

```ts
interface CutsceneEntry {
  script: CutsceneScript
  ownsNpcIds?: string[]   // existing persistent NPCs this scene must pause the brain of
}
export const CUTSCENES: Record<string, CutsceneEntry>
```

Ephemeral scene-only actors (the guards) are never in `NPC_CHARACTERS`, so
they have no autonomous brain to pause — only pre-existing persistent NPCs
a scene hijacks (here: `femalePm`) need to be listed in `ownsNpcIds`.

### `CutsceneRunner.tsx`

Mounted once at the app root, alongside `MeetPmController` and `Npcs`.

```tsx
export function CutsceneRunner(): JSX.Element | null
```

On `activeSceneId` becoming non-null: looks up the entry in `CUTSCENES`,
calls `cameraController.setInputEnabled(false)` (blocks camera dragging) and
`useCharacterStore.getState().setInputLocked(true)` +
`setSceneOwned(new Set(entry.ownsNpcIds ?? []))` (blocks player clicks and
pauses the listed NPCs' brains), builds a director, and runs
`entry.script(director)`. On the script's promise settling (success or throw
— a thrown error is logged and the scene still ends, it does not hang the
game): calls `cutsceneStore.endScene()` (clears the actor map),
`cameraController.setInputEnabled(true)`, `setInputLocked(false)`, and
`setSceneOwned(new Set())`. While a scene is active, `CutsceneRunner` renders
`<PlaceholderActorModel>` for every entry in `cutsceneStore.actors`.

### `PlaceholderActorModel.tsx` / `useCharacterTransform.ts`

`useCharacterTransform(characterId, groupRef, seatedLift)` is the exact
`useFrame` body currently inside `CharacterModel.tsx` (walk-step-towards
integration + position/rotation application to the group ref) — moved
verbatim into a hook so it can be shared. `CharacterModel` calls it and keeps
everything else (GLTF loading, animation crossfade, held props) unchanged.
`PlaceholderActorModel` calls the same hook but renders two simple meshes
(a box body, a smaller box head) instead of a skinned model — it participates
in walking/pathfinding/talking identically to a real character, it just looks
like a placeholder.

### Camera controller (`src/scene/camera/cameraController.ts`)

```ts
export function registerCameraControls(instance: CameraControlsImpl | null): void
export function flyTo(target: Point, position?: Point, durationMs?: number): Promise<void>
export function setInputEnabled(enabled: boolean): void
```

`IsometricCamera.tsx`'s existing setup callback registers its
`CameraControls` ref here (one extra line). `flyTo` calls the same
`instance.setLookAt(...)` the camera already uses for its initial framing,
but with the transition flag enabled instead of `false`; `camera-controls`'
`setLookAt` already returns a promise that resolves when the animated
transition finishes, so no manual tweening/clock code is needed.

### Game store additions

```ts
activeChoice: { options: { id: string; label: string }[] } | null
chooseOption: (id: string) => void   // resolves the pending director.choice() promise, clears activeChoice
reprimands: number
addReprimand: () => void
addTask: (task: BoardTask) => void
tasks: BoardTask[]   // replaces the static BOARD_TASKS export as the source of truth
```

`tasks` is seeded from the current `BOARD_TASKS` array on store init and
persisted in the existing `startup-office-progress` localStorage blob
alongside `phase`/`playerName`, so a task a cutscene adds survives reload.
`reprimands` is persisted the same way; nothing currently reads it beyond
being available for future scenes/UI to reference.

### `DialoguePanel.tsx`

When `activeChoice` is set (only ever true once the current dialogue's last
line has been shown — `say()` completes before a scene calls `choice()`,
so the two states never overlap), the panel renders one button per option
instead of the single advance button; clicking calls
`gameStore.chooseOption(id)`.

## First scene — `src/cutscenes/securityBreach.ts`

Registered as `'security-breach'` with `ownsNpcIds: ['femalePm']` (the scene
walks her away from her desk, so her own brain must stay paused until the
scene ends). Beats, in order:

Guard dialogue lines use `speaker: 'Охранник 1'`/`'Охранник 2'`,
`speakerRole: 'Служба безопасности'`, no `portrait`. PM and player lines keep
their existing speaker names and portraits.

1. `camera(pmDeskPosition, { durationMs: 1500 })`
2. `walk('femalePm', awayFromDeskPoint)` — she leaves without locking her
   screen (flavor only, not enforced visually)
3. `spawnActor('guard1', entryPoint1)`, `spawnActor('guard2', entryPoint2)`,
   then `walk` both to positions near the empty desk
4. `say([...])`:
   - Охранник 1: «Так, а тут у нас непорядок. Компьютер не заблокирован —
     ушла и оставила всё как есть.»
   - Охранник 2: «Если это дойдёт до руководства — влетит всему отделу.
     Идём к начальнику отдела, обсудим.»
5. `camera(playerOfficePosition, { durationMs: 1500 })`
6. `walk('guard1', ...)`, `walk('guard2', ...)` into the player's office;
   `talk('player', true)`, `talk('guard1', true)`
7. `say([...])`:
   - Охранник 1: «У вас в отделе только что нашли разблокированный
     компьютер без присмотра. Это прямое нарушение политики безопасности.»
   - Охранник 2: «Мы обязаны сообщать о таком наверх. Но для начала хотим
     услышать вашу версию.»
8. `choice([{ id: 'accept', label: 'Беру ответственность на себя, разберёмся.' },
   { id: 'blame', label: 'Это недосмотр PM, я тут ни при чём.' }])`
9. Branch:
   - `'accept'`: `say([...])` — Охранник 1: «Разумно. По крайней мере, вы
     не пытаетесь спихнуть вину на подчинённых — уже неплохо.»
   - `'blame'`: `useGameStore.getState().addReprimand()`, then `say([...])`
     — Охранник 1: «Понятно. Только перекладывать ответственность на
     сотрудников — не лучшая черта для руководителя. Это мы тоже отметим.»
10. Both branches converge: `say([...])` — Охранник 2: «В качестве меры —
    отдел обязан регулярно проводить курсы по безопасности для сотрудников.
    Мы это проконтролируем.», then
    `addTask({ id: 'security-training', text: 'Проводить курсы по безопасности (регулярно)', done: false })`
11. `talk('player', false)`, `talk('guard1', false)`; `despawnActor('guard1')`,
    `despawnActor('guard2')`

`addReprimand` is a plain store action (same shape as `addTask`), listed
under Game store additions above.

## Error handling

- A script that throws mid-run: `CutsceneRunner` catches it, logs to
  `console.error`, and still calls `endScene()` so the player is never left
  permanently locked out of input/camera control.
- `director.walk`/`director.camera` resolving: if the target character is
  removed from the store mid-scene (shouldn't happen for scripted scenes
  under normal control flow, but guards against a stray `removeCharacter`
  elsewhere), the pending promise resolves immediately rather than hanging
  forever.
- If `window.__startCutscene` is called with an unknown id, it logs a
  `console.error` and does nothing (dev-only surface, no user-facing error
  UI needed).

## Verification

Per `AGENTS.md` ("NO TESTS"), no automated unit/component tests are added
for this feature. Verification is manual, via the running dev server:

- `npx tsc --noEmit` and `npx vite build` stay clean throughout.
- Run the dev server, reach `free` phase, trigger `window.__startCutscene('security-breach')`
  from the browser console (or Playwright's `page.evaluate`), and confirm via
  screenshots/state inspection (`window.__cutsceneStore`, `window.__gameStore`
  exposed the same way existing debug harnesses already do):
  - camera moves to the PM's desk, then to the player's office
  - PM walks away from her desk
  - both guard boxes appear, walk to their marks, and are visible only during
    the scene
  - the dialogue panel shows guard lines with no portrait
  - the choice buttons appear once and both are clickable
  - both branches converge on the same added task, visible afterwards by
    opening the whiteboard task board
  - `blame` branch increments `reprimands`; `accept` does not
  - after the scene ends, camera control and floor clicks work again, and
    the PM resumes her autonomous office life
