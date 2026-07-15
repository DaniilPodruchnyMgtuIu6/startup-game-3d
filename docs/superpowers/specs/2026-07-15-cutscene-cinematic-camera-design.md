# Cinematic Cutscene Camera & Real Guard Models — Design

Addendum to `2026-07-15-cutscene-system-design.md`. Upgrades the shipped
`security-breach` cutscene from an isometric-camera zoom to an actual
cinematic sequence: a dedicated perspective camera for scenes (close,
dramatic framing instead of the top-down isometric lift), the real
`security_1`/`security_2` character models replacing the placeholder boxes,
and restaged blocking so the PM visibly gets up from a specific desk with
her monitor left on, and the player is already seated when the office shot
reveals him.

This **supersedes** two decisions from the original spec: "guards are
plain boxes" (§ Decisions) and "camera calls `cameraController.flyTo`
against the isometric rig" (§ `director.ts`). Everything else from the
original spec — the director/story engine, dialogue/choice flow, task/
reprimand effects, input locking, NPC-brain pausing — is unchanged.

## Decisions (from brainstorm)

- A scripted scene needs genuine perspective-camera cinematography (depth,
  dramatic angle) to read as a "cutscene" rather than a repositioned
  top-down view — an orthographic camera cannot produce this regardless of
  how close it's zoomed. A second, always-mounted `PerspectiveCamera` is
  swapped in as R3F's active camera only while a cutscene runs; the
  isometric `OrthographicCamera`'s orbited position is preserved untouched
  underneath and reappears exactly as the player left it once the scene
  ends.
- The PM's desk is pinned to a specific real workstation in the open space
  (the one nearest her existing spawn point) rather than relocating any
  furniture or building a dedicated room — the free-standing cutscene
  camera can be placed on whichever side shows her monitor regardless of
  the desk's fixed orientation. The `Monitor` component already renders its
  screen with `materials.screenEmissive` — "the screen is on" is already
  visually true today, this only needs the camera framed to see it.
- The scene now explicitly seats the PM at that desk (`director.sit`) as
  its first beat, instead of assuming her autonomous NPC brain happened to
  leave her there — she could otherwise be anywhere in the office when the
  scene is triggered.
- The player is seated in his own office chair (`director.sit`) *before*
  the camera cuts to the CEO office, so the cut reveals him already seated,
  matching "мы уже сидим в своём кресле."
- Guards use their real models and animations. `security_1`'s
  `looking_down` clip plays while he examines the monitor; `security_2`'s
  `looking_around` clip plays at the same time as his own reaction — both
  used together rather than forcing one semantic meaning onto both.
- A new generic character-machine state `looking` (mirrors the existing
  `talking` state) backs this — reusable by any future scene, not
  guard-specific.
- Per `AGENTS.md` ("NO TESTS"), verified by running the app, not by new
  automated tests.

## Architecture

```
src/scene/camera/CutsceneCamera.tsx  — always-mounted PerspectiveCamera + non-interactive CameraControls
src/scene/camera/cameraController.ts — + useCutsceneCameraStore, enterCutsceneCamera/exitCutsceneCamera, registerCutsceneCameraControls; flyTo now drives the cutscene rig
src/scene/camera/IsometricCamera.tsx — makeDefault/enabled toggle opposite the cutscene camera's active flag (state otherwise untouched)

character-source/security/          — already has the 8 source FBX files (security_1/2 × idle/walk/talk/look)
public/character/security_1/, security_2/ — conversion output (new)
scripts/convert-character.mjs        — + ALL_CLIPS entries for both guards

src/character/characters/definition.ts — CLIP_NAMES + 'look'
src/character/characters/security1.ts  — new CharacterDefinition (no npc/persona)
src/character/characters/security2.ts  — new CharacterDefinition (no npc/persona)
src/character/CharacterModel.tsx       — CLIP_FOR_STATE/CLIP_FALLBACKS get looking: 'look'
src/character/characterMachine.ts      — + 'looking' state, LOOK_START/LOOK_END events

src/cutscenes/types.ts     — CutsceneDirector: + spawnModeledActor, look, sit
src/cutscenes/director.ts  — implementations of the three additions
src/cutscenes/cutsceneStore.ts — actors value becomes a placeholder|model union
src/cutscenes/CutsceneRunner.tsx — renders CharacterModel for model-kind actors; calls enter/exitCutsceneCamera
src/cutscenes/securityBreach.ts  — restaged beats (rewritten)
```

### Cutscene camera (`src/scene/camera/`)

`cameraController.ts` additions:

```ts
export const useCutsceneCameraStore = create<{ active: boolean }>()((set) => ({ active: false }))

export function registerCutsceneCameraControls(instance: CameraControlsImpl | null): void
// sets the module-level cutscene controls reference, same pattern as registerCameraControls

export function enterCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: true })
}
export function exitCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: false })
}
```

`flyTo` (used by `director.camera`) is retargeted to the cutscene rig — it
now reads/writes `cutsceneControls`, the instance `CutsceneCamera.tsx`
registers, instead of the isometric one. Its signature and smoothTime-based
duration handling are unchanged from the original spec.

`CutsceneCamera.tsx` (new):

```tsx
export function CutsceneCamera() {
  const active = useCutsceneCameraStore((s) => s.active)
  // CameraControls needs an explicit `camera` prop here - two rigs exist at
  // once (this one and IsometricCamera's), so it cannot rely on "whichever
  // camera is currently ambient-default" the way a single-camera scene
  // could. A state-backed ref (not a plain useRef) is required because the
  // <CameraControls> below can't mount until the camera instance exists.
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

`enabled={false}` is permanent — this rig is only ever driven
programmatically by `flyTo`; it must never respond to mouse/touch even by
accident. Mounted once in `Office.tsx` alongside `IsometricCamera`, never
unmounted (so drei's `makeDefault` toggle is a clean swap, not a
remount-and-reset).

`IsometricCamera.tsx` changes: reads `useCutsceneCameraStore((s) => s.active)`
and passes `makeDefault={!active}` to its `OrthographicCamera` and
`enabled={!active}` to its `CameraControls`. This **replaces** the
original spec's `setInputEnabled` calls for disabling player dragging —
having both the reactive `enabled` prop and an imperative
`setInputEnabled(false)` call fight over the same `CameraControls.enabled`
property would race. `setInputEnabled`/`registerCameraControls`'s enable-
toggling responsibility is retired; `enterCutsceneCamera`/`exitCutsceneCamera`
become the single source of truth for "is a cutscene visually in control,"
driving both the camera swap and the isometric rig's drag-disable off the
one shared flag. Neither prop unmounts anything, so `setLookAt`'s orbited
state survives a cutscene untouched.

`CutsceneRunner.tsx` calls `enterCutsceneCamera()` at scene start (replacing
the old `setInputEnabled(false)` call there) and `exitCutsceneCamera()` in
the same `finally` block that already restores everything else (replacing
the old `setInputEnabled(true)` call). The `setInputEnabled` export is
removed from `cameraController.ts` — nothing calls it anymore.

### Real guard models

`convert-character.mjs` gets four new `ALL_CLIPS` entries per guard
(pattern matches `business_man`/`female_pm` exactly — one `keepMesh: true`
base, the rest animation-only):

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

`definition.ts`: `CLIP_NAMES` gains `'look'` at the end of the array (a new
`ClipName` union member). `security1.ts`/`security2.ts` follow the exact
`CharacterDefinition` shape `femalePm.ts` uses, minus `persona`/`npc`:

```ts
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

(`security2.ts` mirrors this with `id: 'security-2'`, `displayName:
'Охранник 2'`, and its own clip URLs.) These are **not** added to the
`CHARACTERS`/`NPC_CHARACTERS` roster in `characters/index.ts` — they have no
autonomous office life and are only ever spawned by a cutscene, unlike
`businessMan`/`femalePm`.

`CharacterModel.tsx`: `CLIP_FOR_STATE` gains `looking: 'look'`;
`CLIP_FALLBACKS` gains `look: ['idle']` (a character without a `look` clip
just stays idle — no crash, matches the existing fallback philosophy).

`characterMachine.ts`: adds the `looking` state and `LOOK_START`/`LOOK_END`
events, following the exact shape already used for `talking`:

```ts
export type CharacterState =
  | ... // unchanged
  | { kind: 'talking' }
  | { kind: 'looking' }

export type CharacterEvent =
  | ... // unchanged
  | { type: 'TALK_START' } | { type: 'TALK_END' }
  | { type: 'LOOK_START' } | { type: 'LOOK_END' }
```

with `case 'LOOK_START': return { kind: 'looking' }` and
`case 'LOOK_END': return current.kind === 'looking' ? { kind: 'idle' } : current`
alongside the existing `TALK_START`/`TALK_END` cases.

### `CutsceneDirector` additions

```ts
export interface CutsceneDirector {
  // ...unchanged members...
  spawnModeledActor(id: string, at: Point, definition: CharacterDefinition, rotationY?: number): void
  look(characterId: string, on: boolean): void
  sit(characterId: string, target: { point: Point; facing: number }, kind: 'workstation' | 'seat'): Promise<void>
}
```

- `spawnModeledActor` calls `characterStore.spawnCharacter` (same as
  `spawnActor`) plus `cutsceneStore.upsertModeledActor(id, definition)`
  instead of `upsertActor(id, color)`.
- `look` dispatches `LOOK_START`/`LOOK_END`, mirroring `talk`.
- `sit` dispatches `CLICK_WORKSTATION` (kind `'workstation'`, settles into
  `working` — typing pose) or `CLICK_SEAT` (kind `'seat'`, settles into
  `sittingIdle`), then waits until the character's state reaches that
  settled kind (same subscribe-and-check pattern as `waitForIdle`, just
  checking for `'working'`/`'sittingIdle'` instead of "not walking").

### `cutsceneStore.ts` actor union

```ts
type SceneActor = { kind: 'placeholder'; color: string } | { kind: 'model'; definition: CharacterDefinition }
interface CutsceneStore {
  activeSceneId: string | null
  actors: Record<string, SceneActor>
  // startScene/endScene/removeActor unchanged
  upsertActor: (id: string, color: string) => void
  upsertModeledActor: (id: string, definition: CharacterDefinition) => void
}
```

`CutsceneRunner.tsx`'s render swaps on `actor.kind`:
`<PlaceholderActorModel characterId={id} color={actor.color} />` for
`'placeholder'`, `<CharacterModel characterId={id} config={actor.definition.model} />`
for `'model'`.

### Restaged `securityBreach.ts`

World coordinates used below are derived directly from the existing room
layout (`OpenSpace.tsx`'s cluster grid, `CeoOffice.tsx`'s furniture
positions) — not invented:

- PM's designated workstation (nearest real desk to her spawn):
  `[-1.9, 0, 4.9]` (chair at `[-1.9, 0, 4.35]`, monitor at
  `[-1.9, 0.7, 5.1]`, screen facing -z toward the chair — desks in this
  layout are never individually rotated, so this geometry is the same for
  every workstation in the office).
- Player's CaptainChair (`CeoOffice.tsx`): world `[9, 0, -7.53]`, facing
  `0` (chair has no rotation applied; character sits facing +z toward the
  desk, matching the existing facing convention).

All coordinates below are starting values — like every camera beat already
shipped in this project, they get tuned by eye against real screenshots
during implementation, not treated as final on first write.

Beats:

1. `director.sit(femalePm.id, { point: [-1.9, 0, 4.35], facing: 0 }, 'workstation')`
   — guarantees she's at *this* desk, typing, before anything else happens
   (she could otherwise be anywhere from her autonomous NPC life).
2. `director.camera([-1.9, 1.1, 4.7], { position: [-4.5, 1.6, 3.5] })` —
   cinematic side angle on her desk; framed close enough to read as a shot,
   not an establishing view of the room.
3. `director.walk(femalePm.id, [-2, 0, 2])` — she stands and leaves into the
   open aisle; the monitor (still on) stays in frame behind her empty chair.
4. `director.spawnModeledActor('guard1', [-5, 0, 4], security1)`,
   `director.spawnModeledActor('guard2', [-5, 0, 6], security2)`, then
   `director.walk('guard1', [-1.2, 0, 4.9])` and
   `director.walk('guard2', [-2.8, 0, 5.4])` (marks near the empty desk).
5. `director.look('guard1', true)` (plays `looking_down` at the monitor),
   `director.look('guard2', true)` (plays `looking_around`) — both at once.
6. `director.say([...])` — same two lines as before (guard1 notices the
   unlocked screen, guard2 says it'll get the department in trouble).
7. `director.look('guard1', false)`, `director.look('guard2', false)`.
8. `director.sit(PLAYER_ID, { point: [9, 0, -7.53], facing: 0 }, 'seat')` —
   player is seated *before* the cut, per the brainstorm.
9. `director.camera([9, 1.3, -7.53], { position: [12.5, 1.6, -6] })` — the
   office reveal, framed from in front/beside the player's chair (guards
   enter from the door at world x≈6, so this angle catches both the
   player's seated reaction and the guards approaching).
10. `director.walk('guard1', [7.2, 0, -6.5])`, `director.walk('guard2', [8.8, 0, -6.5])`
    into the room; `director.talk(PLAYER_ID, true)`, `director.talk('guard1', true)`.
11. Onward: identical to the shipped scene — office dialogue, the
    accept/blame choice, branch-specific line, shared closing line,
    `addTask`, `talk(..., false)`, `despawnActor` both guards. No changes
    to this part of the script beyond guard1/guard2 now being real models
    instead of placeholder boxes.

## Error handling

- Same as the original spec (script throws → `CutsceneRunner` still ends
  the scene cleanly). Additionally: `exitCutsceneCamera()` is called from
  the same `finally` block, so a mid-scene failure can never leave the
  player staring through the cutscene camera with no way back — it always
  reverts to the isometric rig exactly where it was left.
- `sit`'s wait resolves immediately (rather than hanging) if the character
  entity disappears mid-wait, same defensive pattern as `waitForIdle`.

## Verification

Per `AGENTS.md` ("NO TESTS"), verified by running the dev server, same
Playwright-driven approach used for the rest of this feature:

- `npx tsc --noEmit` / `npx vite build` stay clean.
- Trigger `security-breach`, confirm: the camera visibly cuts to a close
  perspective shot (not the isometric lift) the instant the scene starts;
  the PM is seen typing, then stands and leaves with the monitor still lit
  behind her; both guards appear as their real models (not boxes) and play
  `looking_down`/`looking_around` while discussing; the camera cuts to the
  CEO office and the player is already seated when it arrives; the rest of
  the confrontation/choice/task-board flow behaves exactly as already
  shipped.
- After the scene ends, confirm the isometric camera reappears at the
  exact pan/zoom the player had before triggering the scene (not reset to
  the default framing) and dragging it works again.
