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

## The character

Click anywhere on the floor to walk there. Click any workstation to walk
over, sit, and start typing. Click the coffee machine to walk over, brew,
and drink. Clicking a new target at any time interrupts whatever the
character is doing and walks to the new one.

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
