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

## Known limitation

This was built without a way to visually preview the render during
development (no screenshot/browser tool in that environment) — geometry was
authored from real-world furniture measurements and verified structurally
(build passes, tests pass, no runtime errors), but has not had a human visual
pass yet. Run `npm run dev` and look at it; if proportions, spacing, or
lighting need adjustment, that's the expected next step, not a sign
something was skipped.
