# Startup Office — 3D Scene

A fixed-isometric, highly detailed React Three Fiber render of a modern startup
office: an open-space core surrounded by a meeting room, a focus room, a
server room, a CEO office, a kitchen, and a game room.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL. Drag to rotate within the clamped isometric range,
scroll to zoom. The "Render" panel (top-right) tunes exposure, ambient
occlusion intensity, and bloom intensity live.

## The game opening

The game starts with a board briefing: the previous department head failed,
and the player — after entering their name — takes over the department to
fix its processes and ship the product. Progress (name + story phase) is
saved to localStorage; add `?intro` to the URL to replay the opening. After
the briefing the product manager waits with a pulsing indicator — click her
to walk over; her introduction opens in the bottom dialogue panel, and once
it ends she starts her normal office life.

## The character

Click anywhere on the floor to walk there. Click any workstation to walk
over, sit, and start typing. Click the coffee machine to walk over, brew,
and drink. Click a meeting room chair, the CEO chair or any sofa to sit
there. Clicking a new target at any time interrupts whatever the character
is doing and walks to the new one.

## NPCs and adding characters

Every character (the player and all NPCs) is an entity in the shared
character store and goes through the same state machine, grid pathfinding
and obstacle avoidance — nobody walks through walls or furniture.

NPCs live their own office life: they mostly work at free desks, and between
work sessions grab a coffee, sit on a sofa, join the meeting room or stroll
around. Activities and durations are picked with seeded randomness (see
`src/character/npcBehavior.ts`), and characters never target a seat someone
else already claimed (`src/interaction/interactionRegistry.ts`).

Everything about one character lives in one place:

- `character-source/<name>/` — its Mixamo FBX files (and, in the future, its
  `persona.yaml` with name/age/role/traits for the AI brain).
- `public/character/<name>/` — its converted GLB clips.
- `src/character/characters/<name>.ts` — its definition: id, clip URLs,
  optional `persona`, and (for NPCs) spawn point and an optional
  `npc.planActivity` brain override. The default brain is the seeded random
  office-life planner; a DeepSeek-agent brain implements the same
  `ActivityPlanner` contract (it may be async) and is prompted with the
  character's persona — swapping brains touches only that character's file.

To add a character:

1. Drop its Mixamo FBX set into `character-source/<name>/` (an idle file with
   skin + whatever animations it has).
2. Add the files to `ALL_CLIPS` in `scripts/convert-character.mjs` and run
   `node scripts/convert-character.mjs <name>`.
3. Create `src/character/characters/<name>.ts` (missing clips fall back to
   the closest available pose automatically) and list it in
   `src/character/characters/index.ts`. Give it an `npc` section to bring it
   to life.

## Verify

```bash
npx tsc --noEmit   # type-check
npx vitest run     # component test suite
npx vite build     # production build
```

## Design

See `docs/superpowers/specs/2026-07-13-3d-office-scene-design.md` for the
full design rationale (layout, materials approach, camera, lighting) and
`docs/superpowers/plans/2026-07-13-3d-office-scene.md` for the implementation
plan this was built from.

## Assets

All textures and the HDRI are CC0 from Poly Haven — see `public/CREDITS.md`.

## Known limitations

The full `EffectComposer` stack (`N8AO` + `Bloom` + `Vignette` together)
renders a blank canvas under headless-Chromium/SwiftShader (software WebGL)
screenshot testing — each effect works individually, only the chained
combination fails, which points at a software-rasterizer render-target limit
rather than a code bug. It has not been confirmed on a real GPU-backed
browser. If `npm run dev` shows a blank canvas for you too on a real machine,
that's a real bug worth reporting; if it renders with the full bloom/AO/
vignette look (expected), this note is stale and can be deleted.

The character's walking direction was tuned from the Mixamo model's apparent
forward axis without a live render to confirm it (see
`src/character/movement.ts` — `Math.atan2(dx, dz)` assumes the model faces
+Z at identity rotation). If the character walks backward, that function is
the one place to flip.
