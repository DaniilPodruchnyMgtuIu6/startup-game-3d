# Controllable office character — design

Date: 2026-07-14

## Goal

Add one clickable, animated character to the existing 3D office scene:
click empty floor to walk there; click a workstation to walk over, sit down,
and start typing; click the coffee machine to walk over, "make" coffee, and
drink it. Realistic-looking movement, clean/uncomplicated code — no state
machine library, no physics engine, no pathfinding library.

Builds on `docs/superpowers/specs/2026-07-13-3d-office-scene-design.md` and
the `startup-office-scene` codebase it produced.

## Character source

Fully rigged, textured, mocap-animated humans cannot be authored procedurally
the way the office furniture was — skinning and motion capture aren't
something to hand-code. The user sources a free rigged, clothed Mixamo
character ("Business Man" or similar — any named, pre-clothed character
works; the rigging-reference characters "Y Bot"/"X Bot" do not, they have no
clothing texture) plus 5 animation clips, all exported "With Skin" as FBX:

- `idle.fbx` — standing idle
- `walk.fbx` — walking, exported with **In Place** enabled (no baked root
  motion — translation is driven by code)
- `sit.fbx` — sitting idle (settling into a chair)
- `type.fbx` — seated typing loop
- `drink.fbx` — standing drinking loop

There is no Mixamo animation for "making coffee." The `brewingCoffee` state
reuses the idle clip while the character stands at the machine for a fixed
duration, then crosses into drinking — simpler than chasing a clip that
doesn't exist, and reads fine at isometric distance.

Files land in `character-source/` (gitignored — regenerable source, same
treatment as any build intermediate) and get converted to `public/character/
*.glb` (committed, same treatment as the office's textures/HDRI) via a
one-shot Node script using the `fbx2gltf` npm package (wraps Meta's official
FBX2glTF binary — no Blender install required). Each exported FBX carries a
full copy of the character mesh (since every clip was exported "With Skin"),
so every converted GLB is large (each source FBX is ~55MB) — acceptable for
now; stripping the redundant mesh out of the four non-base clips is a
possible later optimization, not part of this pass.

Mixamo FBX exports are typically in centimeters; three.js/R3F work in
meters. The conversion/loading step must be checked for a 100x scale
mismatch and corrected with a single scale constant if needed.

## Architecture

Three layers, most of it testable without touching WebGL:

1. **Navigation** (`src/character/navigation.ts`) — pure functions. Building
   on `ROOMS` from `src/scene/layout.ts`: `roomAt(point)` identifies which
   room a point falls in; `buildPath(from, to)` returns a list of waypoints.
   The office is a star topology (open space is the hub; all 6 rooms border
   it directly, one door each), so routing is simple: same room → straight
   line; different rooms → via that room's door, then (if the destination
   isn't open space) via its door, then the destination. Door world
   positions are derived from the same room-bounds math already in
   `layout.ts`, not re-entered as magic numbers.

2. **Character state machine** (`src/character/characterMachine.ts`) — a
   plain discriminated-union reducer, no library:
   `idle | walking | sitting | brewingCoffee | drinkingCoffee`. Events:
   click-floor, click-workstation, click-coffee-machine, arrived-waypoint,
   arrived-destination, brew-timer-elapsed. Clicking any new target while
   mid-action cancels the current one and starts walking to the new target
   (standard point-and-click behavior — no dedicated "stand up" transition
   clip is needed for this; `AnimationMixer` crossfades directly from
   sitting/typing into walking).

3. **Rendering** (`src/character/Character.tsx`) — loads the base GLB
   (mesh + skeleton, from `idle.glb`) plus the four other GLBs (each
   contributes one `AnimationClip` retargeted onto the shared skeleton,
   since all five exports share the same Mixamo rig). Subscribes to the
   character store; on state change, crossfades `AnimationMixer` actions;
   on every frame while `walking`, advances position toward the current
   waypoint at a fixed speed and slerps rotation to face the travel
   direction. This is the one piece that can't be driven through
   `@react-three/test-renderer` (real GLB loads, same class of problem as
   `OfficeMaterialsProvider`/`Lighting`) — its position/rotation math is
   factored into a plain testable function
   (`stepTowards(current, target, speed, delta)`), and the component itself
   is verified via `tsc`/`vite build`/manual run only.

A small `src/character/characterStore.ts` (zustand — already a transitive
dependency of `@react-three/fiber`/`drei`, so adding it directly is a light,
idiomatic choice for this ecosystem, not a new architectural layer) holds
the current `CharacterState` and exposes the dispatch used by both the
clickable furniture and `Character.tsx`.

## Interactions

`Workstation` and `CoffeeMachine` each gain one invisible clickable
`InteractionTrigger` (a reusable small component: an invisible box with an
`onClick` that calls `getWorldPosition`/`getWorldQuaternion` on the clicked
object — no hand-computed per-room coordinates, no duplicate registry of
furniture positions). All 18 workstations in the office are clickable
(matches "workstations" being asked for in the plural, not a curated
subset). One invisible floor-click plane spans the whole building for
plain "walk here" clicks; furniture triggers call `stopPropagation()` so a
desk/coffee-machine click doesn't also register as a floor click underneath
it. Hovering a clickable trigger switches the cursor to a pointer (cheap,
expected affordance); no click-marker VFX — out of scope for this pass.

Adding `InteractionTrigger` to `Workstation`/`CoffeeMachine` adds one mesh
to each, so their existing exact-mesh-count tests (26 and 5 respectively)
need a one-line update to match — expected, not a regression.

## Camera

Unchanged — stays fixed on the whole office (per the existing
`IsometricCamera`), the character just moves around inside that fixed view.
No camera-follow logic.

## Defaults settled without further questions (YAGNI, revisit only if wrong)

- Walk speed: 1.4 m/s (average human walking pace).
- Coffee "brewing" duration: 3.5 seconds of idle at the machine before
  crossfading into drinking.
- Spawn position: standing in the open space near the entrance signage,
  facing into the room.
- Sitting sequence: crossfade to `sit` (~1s settle) then to `type`
  (looping) — two stages for a "sits down, then starts working" feel.
