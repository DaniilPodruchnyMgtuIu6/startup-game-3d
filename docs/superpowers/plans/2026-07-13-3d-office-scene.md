# 3D Office Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React Three Fiber application that renders a highly detailed, realistic, fixed-isometric 3D render of a modern startup office (open space core + 6 surrounding rooms: meeting room, focus room, server room, CEO office, kitchen, game room), matching `docs/superpowers/specs/2026-07-13-3d-office-scene-design.md`.

**Architecture:** Procedural geometry (Three.js primitives composed as small React components) dressed in real CC0 PBR textures/HDRI (Poly Haven) for the surfaces that benefit most (floors, soft furnishings) and tuned procedural materials everywhere else. A shared `layout.ts` constants module is the single source of truth for the building's coordinate grid; a `MaterialsContext` loaded once at the scene root distributes ready-to-use material props to every furniture/room component, keeping leaf components free of texture-loading concerns (and therefore trivially unit-testable with a synchronous stub provider). Rooms are assembled from reusable furniture components positioned via the layout constants; the top-level `Office` scene composes `Building` + all rooms + `Lighting` + `IsometricCamera` + postprocessing.

**Tech Stack:** Vite 8, React 19.2, TypeScript 5.7, `@react-three/fiber` 9.6, `@react-three/drei` 10.7, `@react-three/postprocessing` 3.0 (+ `postprocessing` 6.39), `three` 0.185, `leva` 0.10 (dev-only tuning panel), `vitest` 4.1 + `@react-three/test-renderer` 9.1 (component smoke tests) + `jsdom` 27.

All package versions above were verified together in a throwaway spike during planning (`npm install` with zero peer-dependency conflicts; `tsc --noEmit`, `vite build`, and a `@react-three/test-renderer` smoke test all passed). Use these exact versions.

## Global Constraints

- 1 Three.js unit = 1 meter. Y-up. World origin is the building's floor center; floor top surface is `Y = 0`.
- Building footprint: X ∈ [-12, 12] (24m wide), Z ∈ [-8, 8] (16m deep). Exterior wall height 2.8m, thickness 0.2m. The two walls nearest the fixed isometric camera (South, `Z = 8`, and East, `X = 12`) are low 0.9m cutaway sills; North (`Z = -8`) and West (`X = -12`) are full-height glazed curtain walls.
- Room grid is defined once in `src/scene/layout.ts` — every room/building/furniture-placement task must import bounds from there, never hardcode a room's X/Z extents elsewhere.
- All furniture/room components are function components that accept `position`/`rotation` props (default `[0,0,0]`) so parents fully control placement — never hardcode a piece's world position inside the piece itself.
- All material access goes through `useMaterials()` (`src/materials/MaterialsContext.tsx`). No component outside `src/materials/` may call `useTexture` or construct a `THREE.Texture` directly.
- Every component task ships a smoke test using `@react-three/test-renderer`; tests for furniture/room components must wrap the tree in `StubMaterialsProvider` (from `src/materials/StubMaterialsProvider.tsx`) instead of the real (async, network-dependent) `OfficeMaterialsProvider`.
- `@react-three/test-renderer` cannot render (a) a component that itself mounts `@react-three/fiber`'s real `<Canvas>` (no `ResizeObserver`/WebGL in jsdom), or (b) a component that loads a real file/network asset via `useTexture`/`useEnvironment`/`useLoader` (`FileLoader` fails to resolve a relative URL with no real `window.location` in jsdom). Any component with either trait must split its asset-loading/Suspense-triggering part from its plain-synchronous part, export both, and test only the synchronous one — the same way `App`/`PlaceholderScene` (Task 1) and `Lighting`/`SceneLights` (Task 6) do. `OfficeMaterialsProvider` (Task 4) and `Office`'s default `LightingComponent` (Task 23) are the only places the real, untested, asset-loading versions are wired in for production.
- No code comments explaining *what* code does; only the rare comment for a non-obvious *why*.
- Real-world furniture proportions (in meters) given in each task must be followed exactly so scale reads correctly next to a 2.8m wall and a 0.75m-high desk.
- Verification the implementer CAN run: `npx tsc --noEmit`, `npx vite build`, `npx vitest run`. Verification the implementer CANNOT run: looking at the rendered output (no screenshot tool available in this environment). Never claim a task "looks right" — only claim it compiles, builds, and passes its tests. Visual review happens later, by the user, via `npm run dev`.

---

## Phase 0 — Project Scaffold

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App` component (default placeholder scene — Task 24 replaces its contents with the real `Office` scene; every other task imports nothing from this task).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "startup-office-scene",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "three": "^0.185.1",
    "@react-three/fiber": "^9.6.1",
    "@react-three/drei": "^10.7.7",
    "@react-three/postprocessing": "^3.0.4",
    "postprocessing": "^6.39.2",
    "leva": "^0.10.1"
  },
  "devDependencies": {
    "@react-three/test-renderer": "^9.1.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.185.1",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^27.2.0",
    "typescript": "^5.7.3",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Startup Office</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
.DS_Store
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 7: Create placeholder `src/App.tsx`**

`@react-three/test-renderer` provides its own mock renderer with no real DOM/WebGL — it cannot render a component that itself mounts `@react-three/fiber`'s real `<Canvas>` (`<Canvas>` measures its container via `ResizeObserver`, which jsdom doesn't implement, and then tries to acquire a real WebGL context, which jsdom also doesn't provide). So scene *content* is kept in a separate component that does not render `<Canvas>`, and only that content component is unit-tested — the same split every later room/furniture component already follows (they never render `<Canvas>` themselves either, since they're meant to be mounted inside one).

```tsx
import { Canvas } from '@react-three/fiber'

export function PlaceholderScene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </>
  )
}

export function App() {
  return (
    <Canvas camera={{ position: [4, 4, 4] }}>
      <PlaceholderScene />
    </Canvas>
  )
}
```

- [ ] **Step 8: Write the smoke test `src/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { PlaceholderScene } from './App'

describe('PlaceholderScene', () => {
  it('mounts and renders one mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(<PlaceholderScene />)
    const meshes = renderer.scene.findAllByType('Mesh')
    expect(meshes.length).toBe(1)
  })
})
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: completes with no `ERESOLVE` errors (this exact dependency set was already verified conflict-free during planning).

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0, no output.

- [ ] **Step 11: Run the test**

Run: `npx vitest run`
Expected: `Test Files  1 passed (1)`, `Tests  1 passed (1)`.

- [ ] **Step 12: Verify production build**

Run: `npx vite build`
Expected: `✓ built in ...ms`, creates `dist/index.html` and `dist/assets/*.js`.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html .gitignore src
git commit -m "chore: scaffold Vite + React + TypeScript + R3F project"
```

---

### Task 2: Download CC0 textures and HDRI from Poly Haven

All URLs below were verified to return HTTP 200 during planning.

**Files:**
- Create: `public/textures/wood-floor/diffuse.jpg`, `normal.jpg`, `roughness.jpg`
- Create: `public/textures/concrete-floor/diffuse.jpg`, `normal.jpg`, `roughness.jpg`
- Create: `public/textures/leather/diffuse.jpg`, `normal.jpg`, `roughness.jpg`
- Create: `public/textures/boucle/diffuse.jpg`, `normal.jpg`, `roughness.jpg`
- Create: `public/hdri/studio.hdr`
- Create: `public/CREDITS.md`

**Interfaces:**
- Produces: the file paths above, consumed exclusively by `src/materials/OfficeMaterialsProvider.tsx` (Task 4) and `src/scene/lighting/Lighting.tsx` (Task 6).

- [ ] **Step 1: Create the target directories**

```bash
mkdir -p public/textures/wood-floor public/textures/concrete-floor public/textures/leather public/textures/boucle public/hdri
```

- [ ] **Step 2: Download wood floor textures (Poly Haven "Wood Floor", CC0)**

```bash
curl -L -o public/textures/wood-floor/diffuse.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wood_floor/wood_floor_diff_2k.jpg"
curl -L -o public/textures/wood-floor/normal.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wood_floor/wood_floor_nor_gl_2k.jpg"
curl -L -o public/textures/wood-floor/roughness.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/wood_floor/wood_floor_rough_2k.jpg"
```

- [ ] **Step 3: Download concrete floor textures (Poly Haven "Concrete Floor Worn 001", CC0)**

```bash
curl -L -o public/textures/concrete-floor/diffuse.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_floor_worn_001/concrete_floor_worn_001_diff_2k.jpg"
curl -L -o public/textures/concrete-floor/normal.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl_2k.jpg"
curl -L -o public/textures/concrete-floor/roughness.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_floor_worn_001/concrete_floor_worn_001_rough_2k.jpg"
```

- [ ] **Step 4: Download leather upholstery textures (Poly Haven "Fabric Leather 02", CC0)**

```bash
curl -L -o public/textures/leather/diffuse.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_leather_02/fabric_leather_02_diff_1k.jpg"
curl -L -o public/textures/leather/normal.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_leather_02/fabric_leather_02_nor_gl_1k.jpg"
curl -L -o public/textures/leather/roughness.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_leather_02/fabric_leather_02_rough_1k.jpg"
```

- [ ] **Step 5: Download boucle upholstery textures (Poly Haven "Wool Boucle", CC0)**

```bash
curl -L -o public/textures/boucle/diffuse.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wool_boucle/wool_boucle_diff_1k.jpg"
curl -L -o public/textures/boucle/normal.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wool_boucle/wool_boucle_nor_gl_1k.jpg"
curl -L -o public/textures/boucle/roughness.jpg "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wool_boucle/wool_boucle_rough_1k.jpg"
```

- [ ] **Step 6: Download the environment HDRI (Poly Haven "Brown Photostudio 02", CC0)**

```bash
curl -L -o public/hdri/studio.hdr "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/brown_photostudio_02_1k.hdr"
```

- [ ] **Step 7: Verify every file downloaded and is non-trivially sized**

```bash
find public/textures public/hdri -type f -size +10k | wc -l
```

Expected: `13` (12 texture jpgs + 1 hdr).

- [ ] **Step 8: Record attribution**

```markdown
# Asset credits

All textures and the HDRI are CC0 (no attribution legally required) from Poly Haven (https://polyhaven.com):

- Wood Floor — https://polyhaven.com/a/wood_floor
- Concrete Floor Worn 001 — https://polyhaven.com/a/concrete_floor_worn_001
- Fabric Leather 02 — https://polyhaven.com/a/fabric_leather_02
- Wool Boucle — https://polyhaven.com/a/wool_boucle
- Brown Photostudio 02 (HDRI) — https://polyhaven.com/a/brown_photostudio_02
```

Write this to `public/CREDITS.md`.

- [ ] **Step 9: Commit**

```bash
git add public
git commit -m "chore: add CC0 PBR textures and HDRI from Poly Haven"
```

---

### Task 3: Building layout constants

**Files:**
- Create: `src/scene/layout.ts`
- Test: `src/scene/layout.test.ts`

**Interfaces:**
- Produces: `BUILDING` (building envelope constants), `RoomName` union type, `RoomBounds` interface, `ROOMS: Record<RoomName, RoomBounds>`, `roomCenter(bounds): [number, number, number]`, `roomSize(bounds): { width: number; depth: number }`. Every room/building task (Tasks 7, 19–23) imports from here.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { BUILDING, ROOMS, roomCenter, roomSize, type RoomName } from './layout'

describe('layout', () => {
  it('every room stays within the building envelope', () => {
    for (const name of Object.keys(ROOMS) as RoomName[]) {
      const b = ROOMS[name]
      expect(b.minX).toBeGreaterThanOrEqual(BUILDING.minX)
      expect(b.maxX).toBeLessThanOrEqual(BUILDING.maxX)
      expect(b.minZ).toBeGreaterThanOrEqual(BUILDING.minZ)
      expect(b.maxZ).toBeLessThanOrEqual(BUILDING.maxZ)
    }
  })

  it('no two rooms overlap', () => {
    const names = Object.keys(ROOMS) as RoomName[]
    const eps = 1e-6
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = ROOMS[names[i]]
        const b = ROOMS[names[j]]
        const overlaps =
          a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps
        expect(overlaps).toBe(false)
      }
    }
  })

  it('room areas sum to the full building footprint', () => {
    const names = Object.keys(ROOMS) as RoomName[]
    const totalArea = names.reduce((sum, name) => {
      const { width, depth } = roomSize(ROOMS[name])
      return sum + width * depth
    }, 0)
    const footprint = (BUILDING.maxX - BUILDING.minX) * (BUILDING.maxZ - BUILDING.minZ)
    expect(totalArea).toBeCloseTo(footprint, 6)
  })

  it('roomCenter returns the midpoint at floor level', () => {
    expect(roomCenter(ROOMS.openSpace)).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Implement `src/scene/layout.ts`**

```ts
export const BUILDING = {
  minX: -12,
  maxX: 12,
  minZ: -8,
  maxZ: 8,
  wallHeight: 2.8,
  wallThickness: 0.2,
  cutawayHeight: 0.9,
  floorThickness: 0.1,
} as const

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type RoomName =
  | 'openSpace'
  | 'meetingRoom'
  | 'focusRoom'
  | 'serverRoom'
  | 'ceoOffice'
  | 'kitchen'
  | 'gameRoom'

const SIDE_COLUMN_WIDTH = 6
const ROW_DEPTH = (BUILDING.maxZ - BUILDING.minZ) / 3

export const ROOMS: Record<RoomName, RoomBounds> = {
  meetingRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.minZ + ROW_DEPTH,
  },
  focusRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ + ROW_DEPTH,
    maxZ: BUILDING.minZ + 2 * ROW_DEPTH,
  },
  serverRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ + 2 * ROW_DEPTH,
    maxZ: BUILDING.maxZ,
  },
  ceoOffice: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.minZ + ROW_DEPTH,
  },
  kitchen: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ + ROW_DEPTH,
    maxZ: BUILDING.minZ + 2 * ROW_DEPTH,
  },
  gameRoom: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ + 2 * ROW_DEPTH,
    maxZ: BUILDING.maxZ,
  },
  openSpace: {
    minX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.maxZ,
  },
}

export function roomCenter(bounds: RoomBounds): [number, number, number] {
  return [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]
}

export function roomSize(bounds: RoomBounds): { width: number; depth: number } {
  return { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/layout.test.ts`
Expected: `Tests  4 passed (4)`.

- [ ] **Step 5: Commit**

```bash
git add src/scene/layout.ts src/scene/layout.test.ts
git commit -m "feat: add building/room layout constants"
```

---

### Task 4: Materials system (context, provider, stub, texture repeat helper)

**Files:**
- Create: `src/materials/types.ts`
- Create: `src/materials/cloneRepeated.ts`
- Create: `src/materials/MaterialsContext.tsx`
- Create: `src/materials/OfficeMaterialsProvider.tsx`
- Create: `src/materials/StubMaterialsProvider.tsx`
- Test: `src/materials/cloneRepeated.test.ts`
- Test: `src/materials/MaterialsContext.test.tsx`

**Interfaces:**
- Consumes: texture files from Task 2 (`/textures/...`, `/hdri/studio.hdr` — referenced by URL string, not imported).
- Produces: `OfficeMaterials` type, `useMaterials()` hook, `OfficeMaterialsProvider` (real, Suspense-based, used once in `Office.tsx`), `StubMaterialsProvider` (synchronous, used in every other component's tests), `cloneRepeated(texture, repeatX, repeatY)`. Every furniture/room task (Tasks 7–23) consumes `useMaterials()` and wraps its tests in `StubMaterialsProvider`.

- [ ] **Step 1: Write the failing test for `cloneRepeated`**

```ts
import { describe, it, expect } from 'vitest'
import { Texture, RepeatWrapping } from 'three'
import { cloneRepeated } from './cloneRepeated'

describe('cloneRepeated', () => {
  it('returns a distinct texture with repeat wrapping and the requested repeat', () => {
    const source = new Texture()
    const result = cloneRepeated(source, 4, 6)
    expect(result).not.toBe(source)
    expect(result.wrapS).toBe(RepeatWrapping)
    expect(result.wrapT).toBe(RepeatWrapping)
    expect(result.repeat.x).toBe(4)
    expect(result.repeat.y).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/materials/cloneRepeated.test.ts`
Expected: FAIL — `Cannot find module './cloneRepeated'`.

- [ ] **Step 3: Implement `src/materials/cloneRepeated.ts`**

```ts
import { Texture, RepeatWrapping } from 'three'

export function cloneRepeated(texture: Texture, repeatX: number, repeatY: number): Texture {
  const clone = texture.clone()
  clone.wrapS = RepeatWrapping
  clone.wrapT = RepeatWrapping
  clone.repeat.set(repeatX, repeatY)
  clone.needsUpdate = true
  return clone
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/materials/cloneRepeated.test.ts`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Create `src/materials/types.ts`**

```ts
import type { ThreeElements } from '@react-three/fiber'
import type { Texture } from 'three'

export type StandardMaterialProps = ThreeElements['meshStandardMaterial']
export type PhysicalMaterialProps = ThreeElements['meshPhysicalMaterial']

export interface TiledTextureSet {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
}

export interface OfficeMaterials {
  floorWoodTextures: TiledTextureSet
  floorConcreteTextures: TiledTextureSet
  wallPaint: StandardMaterialProps
  wallAccentBlue: StandardMaterialProps
  wallAccentGreen: StandardMaterialProps
  glass: PhysicalMaterialProps
  metalFrame: StandardMaterialProps
  metalChrome: StandardMaterialProps
  plasticBlack: StandardMaterialProps
  woodDesktop: StandardMaterialProps
  leather: StandardMaterialProps
  fabricLounge: StandardMaterialProps
  screenEmissive: StandardMaterialProps
  ledGreen: StandardMaterialProps
  ledAmber: StandardMaterialProps
  chairFabric: (color: string) => StandardMaterialProps
}
```

- [ ] **Step 6: Create `src/materials/MaterialsContext.tsx`**

```tsx
import { createContext, useContext } from 'react'
import type { OfficeMaterials } from './types'

export const MaterialsContext = createContext<OfficeMaterials | null>(null)

export function useMaterials(): OfficeMaterials {
  const ctx = useContext(MaterialsContext)
  if (!ctx) {
    throw new Error('useMaterials must be used within a MaterialsContext provider')
  }
  return ctx
}
```

- [ ] **Step 7: Create the shared procedural material props factory `src/materials/proceduralMaterials.ts`**

```ts
import type { StandardMaterialProps, PhysicalMaterialProps } from './types'

export const wallPaint: StandardMaterialProps = { color: '#f2efe7', roughness: 0.9, metalness: 0 }
export const wallAccentBlue: StandardMaterialProps = { color: '#3457a6', roughness: 0.85, metalness: 0 }
export const wallAccentGreen: StandardMaterialProps = { color: '#2f5d4f', roughness: 0.85, metalness: 0 }
export const glass: PhysicalMaterialProps = {
  color: '#ffffff',
  transmission: 0.92,
  roughness: 0.04,
  thickness: 0.08,
  ior: 1.5,
  metalness: 0,
}
export const metalFrame: StandardMaterialProps = { color: '#33363c', metalness: 0.85, roughness: 0.35 }
export const metalChrome: StandardMaterialProps = { color: '#c9cdd2', metalness: 1, roughness: 0.15 }
export const plasticBlack: StandardMaterialProps = { color: '#17181a', roughness: 0.45, metalness: 0.05 }
export const woodDesktop: StandardMaterialProps = { color: '#b98a5a', roughness: 0.55, metalness: 0 }
export const screenEmissive: StandardMaterialProps = {
  color: '#0a1a2a',
  emissive: '#4fb8ff',
  emissiveIntensity: 1.4,
  roughness: 0.3,
  metalness: 0.1,
}
export const ledGreen: StandardMaterialProps = {
  color: '#062b0d',
  emissive: '#37ff6b',
  emissiveIntensity: 3,
  roughness: 0.4,
}
export const ledAmber: StandardMaterialProps = {
  color: '#2b1c02',
  emissive: '#ffb020',
  emissiveIntensity: 3,
  roughness: 0.4,
}
export function chairFabric(color: string): StandardMaterialProps {
  return { color, roughness: 0.85, metalness: 0 }
}
```

- [ ] **Step 8: Create `src/materials/OfficeMaterialsProvider.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import { MaterialsContext } from './MaterialsContext'
import type { OfficeMaterials } from './types'
import * as procedural from './proceduralMaterials'

export function OfficeMaterialsProvider({ children }: { children: ReactNode }) {
  const wood = useTexture({
    map: '/textures/wood-floor/diffuse.jpg',
    normalMap: '/textures/wood-floor/normal.jpg',
    roughnessMap: '/textures/wood-floor/roughness.jpg',
  })
  const concrete = useTexture({
    map: '/textures/concrete-floor/diffuse.jpg',
    normalMap: '/textures/concrete-floor/normal.jpg',
    roughnessMap: '/textures/concrete-floor/roughness.jpg',
  })
  const leatherTex = useTexture({
    map: '/textures/leather/diffuse.jpg',
    normalMap: '/textures/leather/normal.jpg',
    roughnessMap: '/textures/leather/roughness.jpg',
  })
  const boucleTex = useTexture({
    map: '/textures/boucle/diffuse.jpg',
    normalMap: '/textures/boucle/normal.jpg',
    roughnessMap: '/textures/boucle/roughness.jpg',
  })

  const value = useMemo<OfficeMaterials>(() => {
    wood.map.colorSpace = SRGBColorSpace
    concrete.map.colorSpace = SRGBColorSpace
    leatherTex.map.colorSpace = SRGBColorSpace
    boucleTex.map.colorSpace = SRGBColorSpace

    return {
      floorWoodTextures: wood,
      floorConcreteTextures: concrete,
      wallPaint: procedural.wallPaint,
      wallAccentBlue: procedural.wallAccentBlue,
      wallAccentGreen: procedural.wallAccentGreen,
      glass: procedural.glass,
      metalFrame: procedural.metalFrame,
      metalChrome: procedural.metalChrome,
      plasticBlack: procedural.plasticBlack,
      woodDesktop: procedural.woodDesktop,
      leather: { map: leatherTex.map, normalMap: leatherTex.normalMap, roughnessMap: leatherTex.roughnessMap, roughness: 1, metalness: 0 },
      fabricLounge: { map: boucleTex.map, normalMap: boucleTex.normalMap, roughnessMap: boucleTex.roughnessMap, roughness: 1, metalness: 0 },
      screenEmissive: procedural.screenEmissive,
      ledGreen: procedural.ledGreen,
      ledAmber: procedural.ledAmber,
      chairFabric: procedural.chairFabric,
    }
  }, [wood, concrete, leatherTex, boucleTex])

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>
}
```

- [ ] **Step 9: Create `src/materials/StubMaterialsProvider.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Texture } from 'three'
import { MaterialsContext } from './MaterialsContext'
import type { OfficeMaterials } from './types'
import * as procedural from './proceduralMaterials'

function stubTextureSet() {
  return { map: new Texture(), normalMap: new Texture(), roughnessMap: new Texture() }
}

export const STUB_MATERIALS: OfficeMaterials = {
  floorWoodTextures: stubTextureSet(),
  floorConcreteTextures: stubTextureSet(),
  wallPaint: procedural.wallPaint,
  wallAccentBlue: procedural.wallAccentBlue,
  wallAccentGreen: procedural.wallAccentGreen,
  glass: procedural.glass,
  metalFrame: procedural.metalFrame,
  metalChrome: procedural.metalChrome,
  plasticBlack: procedural.plasticBlack,
  woodDesktop: procedural.woodDesktop,
  leather: { color: '#5b4230', roughness: 1, metalness: 0 },
  fabricLounge: { color: '#cfc9bd', roughness: 1, metalness: 0 },
  screenEmissive: procedural.screenEmissive,
  ledGreen: procedural.ledGreen,
  ledAmber: procedural.ledAmber,
  chairFabric: procedural.chairFabric,
}

export function StubMaterialsProvider({ children }: { children: ReactNode }) {
  return <MaterialsContext.Provider value={STUB_MATERIALS}>{children}</MaterialsContext.Provider>
}
```

- [ ] **Step 10: Write the failing test for the context**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useMaterials } from './MaterialsContext'
import { StubMaterialsProvider } from './StubMaterialsProvider'

function Probe() {
  const materials = useMaterials()
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial {...materials.wallPaint} />
    </mesh>
  )
}

describe('MaterialsContext', () => {
  it('throws when used outside a provider', async () => {
    await expect(ReactThreeTestRenderer.create(<Probe />)).rejects.toThrow(
      'useMaterials must be used within a MaterialsContext provider',
    )
  })

  it('provides materials via StubMaterialsProvider', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Probe />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
```

- [ ] **Step 11: Run test to verify it fails**

Run: `npx vitest run src/materials/MaterialsContext.test.tsx`
Expected: FAIL — `Cannot find module './StubMaterialsProvider'` (files from steps 5–9 not yet saved) or assertion failures if only step 10 is missing pieces. Since steps 5–9 are implementation steps performed before this point, in practice this step's real purpose is regression coverage — run it now to confirm current state passes.

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/materials/MaterialsContext.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 13: Type-check and build**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 14: Commit**

```bash
git add src/materials
git commit -m "feat: add materials context, real provider, stub provider, cloneRepeated helper"
```

---

### Task 5: Isometric camera

**Files:**
- Create: `src/scene/camera/IsometricCamera.tsx`
- Test: `src/scene/camera/IsometricCamera.test.tsx`

**Interfaces:**
- Produces: `IsometricCamera` component (no props — fixed configuration per spec). Consumed by `Office.tsx` (Task 23).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { IsometricCamera } from './IsometricCamera'

describe('IsometricCamera', () => {
  it('mounts exactly one orthographic camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />)
    const cameras = renderer.scene.findAllByType('OrthographicCamera')
    expect(cameras.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/camera/IsometricCamera.test.tsx`
Expected: FAIL — `Cannot find module './IsometricCamera'`.

- [ ] **Step 3: Implement `src/scene/camera/IsometricCamera.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'

const CAMERA_POSITION: [number, number, number] = [22, 26, 22]
const CAMERA_TARGET: [number, number, number] = [0, 0.8, 0]
const BASE_AZIMUTH = Math.PI / 4
const AZIMUTH_SWING = 0.45

export function IsometricCamera() {
  const controlsRef = useRef<CameraControlsImpl>(null)

  useEffect(() => {
    controlsRef.current?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false)
  }, [])

  return (
    <>
      <OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={28} near={0.1} far={100} />
      <CameraControls
        ref={controlsRef}
        makeDefault
        minZoom={18}
        maxZoom={45}
        minPolarAngle={0.75}
        maxPolarAngle={1.05}
        minAzimuthAngle={BASE_AZIMUTH - AZIMUTH_SWING}
        maxAzimuthAngle={BASE_AZIMUTH + AZIMUTH_SWING}
        minDistance={25}
        maxDistance={60}
      />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/camera/IsometricCamera.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. (`camera-controls` ships its own types and is a transitive dependency of `@react-three/drei`; if TypeScript cannot resolve `camera-controls` directly, run `npm install camera-controls@^3.1.2` to hoist it as a direct devDependency, then re-run.)

- [ ] **Step 6: Commit**

```bash
git add src/scene/camera
git commit -m "feat: add fixed isometric camera with clamped orbit"
```

---

### Task 6: Lighting

**Files:**
- Create: `src/scene/lighting/Lighting.tsx`
- Test: `src/scene/lighting/Lighting.test.tsx`

**Interfaces:**
- Produces: `SceneLights` (ambient + key + fill directional lights, no props, no asset loading — the testable part) and `Lighting` (`SceneLights` + the HDRI `Environment`, no props — the production component). `Office.tsx` (Task 23) uses `Lighting` by default and accepts `SceneLights` as its test substitute, mirroring how it substitutes `StubMaterialsProvider` for `OfficeMaterialsProvider`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneLights } from './Lighting'

describe('SceneLights', () => {
  it('mounts an ambient light and 2 directional lights (key + fill)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneLights />)
    expect(renderer.scene.findAllByType('DirectionalLight').length).toBe(2)
    expect(renderer.scene.findAllByType('AmbientLight').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/lighting/Lighting.test.tsx`
Expected: FAIL — `Cannot find module './Lighting'`.

- [ ] **Step 3: Implement `src/scene/lighting/Lighting.tsx`**

```tsx
import { Environment } from '@react-three/drei'

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-14, 16, -10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[10, 8, 12]} intensity={0.3} />
    </>
  )
}

export function Lighting() {
  return (
    <>
      <SceneLights />
      <Environment files="/hdri/studio.hdr" background={false} environmentIntensity={0.6} />
    </>
  )
}
```

`Environment`'s `useEnvironment` call fails outright in the jsdom test environment (`FileLoader` cannot resolve a relative URL without a real `window.location`), so it — and anything that composes it — cannot go through `@react-three/test-renderer`. `SceneLights` carries no such dependency and is fully testable; `Lighting` is only exercised via `tsc`/`vite build`/manual `npm run dev`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/lighting/Lighting.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Commit**

```bash
git add src/scene/lighting
git commit -m "feat: add HDRI environment + key/fill lighting"
```

---

### Task 7: Wall primitive and building shell

**Files:**
- Create: `src/scene/Wall.tsx`
- Create: `src/scene/Building.tsx`
- Test: `src/scene/Wall.test.tsx`
- Test: `src/scene/Building.test.tsx`

**Interfaces:**
- Produces: `Wall` component — props `{ axis: 'x' | 'z'; length: number; center: [number, number, number]; height: number; thickness: number; material: 'paint' | 'concrete'; doorway?: { offset: number; width: number } }`. `Building` component (no props). Consumed by `Office.tsx` (Task 23) and by room tasks in Phase 3 (interior partitions reuse `Wall`).

- [ ] **Step 1: Write the failing test for `Wall`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Wall } from './Wall'

describe('Wall', () => {
  it('renders a single solid slab when there is no doorway', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Wall axis="x" length={6} center={[0, 1.4, -8]} height={2.8} thickness={0.2} material="paint" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })

  it('renders three segments (left pier, lintel, right pier) when a doorway is given', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Wall
          axis="x"
          length={6}
          center={[0, 1.4, -2.667]}
          height={2.8}
          thickness={0.2}
          material="paint"
          doorway={{ offset: 1, width: 0.9 }}
        />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/Wall.test.tsx`
Expected: FAIL — `Cannot find module './Wall'`.

- [ ] **Step 3: Implement `src/scene/Wall.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface WallDoorway {
  offset: number
  width: number
}

export interface WallProps {
  axis: 'x' | 'z'
  length: number
  center: [number, number, number]
  height: number
  thickness: number
  material: 'paint' | 'accentBlue' | 'accentGreen'
  doorway?: WallDoorway
}

const DOOR_HEIGHT = 2.1

const WALL_MATERIAL_KEY = {
  paint: 'wallPaint',
  accentBlue: 'wallAccentBlue',
  accentGreen: 'wallAccentGreen',
} as const

export function Wall({ axis, length, center, height, thickness, material, doorway }: WallProps) {
  const materials = useMaterials()
  const matProps = materials[WALL_MATERIAL_KEY[material]]
  const size = (span: number): [number, number, number] =>
    axis === 'x' ? [span, height, thickness] : [thickness, height, span]

  if (!doorway) {
    return (
      <mesh position={center} castShadow receiveShadow>
        <boxGeometry args={size(length)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    )
  }

  const halfLength = length / 2
  const doorCenterOffset = doorway.offset - halfLength
  const leftLength = doorway.offset - doorway.width / 2
  const rightLength = length - doorway.offset - doorway.width / 2
  const lintelHeight = height - DOOR_HEIGHT

  const offsetVec = (span: number): [number, number, number] =>
    axis === 'x' ? [center[0] + span, center[1], center[2]] : [center[0], center[1], center[2] + span]

  const leftCenter = offsetVec(-halfLength + leftLength / 2)
  const rightCenter = offsetVec(halfLength - rightLength / 2)
  const lintelCenter: [number, number, number] = [
    axis === 'x' ? center[0] + doorCenterOffset : center[0],
    center[1] + height / 2 - lintelHeight / 2,
    axis === 'z' ? center[2] + doorCenterOffset : center[2],
  ]

  return (
    <group>
      <mesh position={leftCenter} castShadow receiveShadow>
        <boxGeometry args={size(leftLength)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={rightCenter} castShadow receiveShadow>
        <boxGeometry args={size(rightLength)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={lintelCenter} castShadow receiveShadow>
        <boxGeometry args={size(doorway.width)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/Wall.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Write the failing test for `Building`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Building } from './Building'

describe('Building', () => {
  it('renders a floor and the four exterior walls', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Building />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(4)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/scene/Building.test.tsx`
Expected: FAIL — `Cannot find module './Building'`.

- [ ] **Step 7: Implement `src/scene/Building.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'
import { cloneRepeated } from '../materials/cloneRepeated'
import { BUILDING } from './layout'

const MULLION_SPACING = 1.5
const MULLION_WIDTH = 0.08

function CurtainWall({ axis, length, center }: { axis: 'x' | 'z'; length: number; center: [number, number, number] }) {
  const materials = useMaterials()
  const sillHeight = BUILDING.cutawayHeight
  const headerHeight = 0.1
  const glassHeight = BUILDING.wallHeight - sillHeight - headerHeight
  const size = (span: number, h: number): [number, number, number] =>
    axis === 'x' ? [span, h, BUILDING.wallThickness] : [BUILDING.wallThickness, h, span]

  const mullionCount = Math.max(2, Math.floor(length / MULLION_SPACING))
  const mullions = Array.from({ length: mullionCount + 1 }, (_, i) => {
    const t = i / mullionCount - 0.5
    const offset = t * length
    return axis === 'x'
      ? ([center[0] + offset, center[1] + sillHeight + glassHeight / 2, center[2]] as [number, number, number])
      : ([center[0], center[1] + sillHeight + glassHeight / 2, center[2] + offset] as [number, number, number])
  })

  return (
    <group>
      <mesh position={[center[0], sillHeight / 2, center[2]]} castShadow receiveShadow>
        <boxGeometry args={size(length, sillHeight)} />
        <meshStandardMaterial {...materials.wallPaint} />
      </mesh>
      <mesh position={[center[0], sillHeight + glassHeight / 2, center[2]]}>
        <boxGeometry args={size(length - MULLION_WIDTH, glassHeight)} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      {mullions.map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={size(MULLION_WIDTH, glassHeight)} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      <mesh position={[center[0], BUILDING.wallHeight - headerHeight / 2, center[2]]} castShadow>
        <boxGeometry args={size(length, headerHeight)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}

function CutawaySill({ axis, length, center }: { axis: 'x' | 'z'; length: number; center: [number, number, number] }) {
  const materials = useMaterials()
  const size: [number, number, number] =
    axis === 'x'
      ? [length, BUILDING.cutawayHeight, BUILDING.wallThickness]
      : [BUILDING.wallThickness, BUILDING.cutawayHeight, length]
  return (
    <mesh position={[center[0], BUILDING.cutawayHeight / 2, center[2]]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...materials.wallPaint} />
    </mesh>
  )
}

export function Building() {
  const materials = useMaterials()
  const width = BUILDING.maxX - BUILDING.minX
  const depth = BUILDING.maxZ - BUILDING.minZ
  const floorTexture = {
    map: cloneRepeated(materials.floorWoodTextures.map, width / 2, depth / 2),
    normalMap: cloneRepeated(materials.floorWoodTextures.normalMap, width / 2, depth / 2),
    roughnessMap: cloneRepeated(materials.floorWoodTextures.roughnessMap, width / 2, depth / 2),
  }

  return (
    <group>
      <mesh position={[0, -BUILDING.floorThickness / 2, 0]} receiveShadow>
        <boxGeometry args={[width, BUILDING.floorThickness, depth]} />
        <meshStandardMaterial {...floorTexture} roughness={1} metalness={0} />
      </mesh>

      <CurtainWall axis="x" length={width} center={[0, 0, BUILDING.minZ]} />
      <CurtainWall axis="z" length={depth} center={[BUILDING.minX, 0, 0]} />
      <CutawaySill axis="x" length={width} center={[0, 0, BUILDING.maxZ]} />
      <CutawaySill axis="z" length={depth} center={[BUILDING.maxX, 0, 0]} />
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/scene/Building.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check and full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; all tests so far pass.

- [ ] **Step 10: Commit**

```bash
git add src/scene/Wall.tsx src/scene/Building.tsx src/scene/Wall.test.tsx src/scene/Building.test.tsx
git commit -m "feat: add Wall primitive and Building shell (floor + curtain walls + cutaway sills)"
```

---

## Phase 2 — Furniture Primitives

Every component in this phase lives in `src/furniture/`, imports `useMaterials` from `../materials/MaterialsContext`, accepts `position`/`rotation` props (default `[0,0,0]`), and is tested against `StubMaterialsProvider`. Dimensions are in meters and are real-world-accurate — do not round them further.

### Task 8: Desk + Chair

**Files:**
- Create: `src/furniture/Desk.tsx`
- Create: `src/furniture/Chair.tsx`
- Test: `src/furniture/Desk.test.tsx`
- Test: `src/furniture/Chair.test.tsx`

**Interfaces:**
- Produces: `Desk({ position?, rotation? })` — 1.4m × 0.7m top at 0.75m height on 4 legs. `Chair({ position?, rotation?, color? })` — 0.46m task chair, 5-star base, `color` picks the seat/back fabric tint via `materials.chairFabric(color)`. Both consumed by every room task in Phase 3.

- [ ] **Step 1: Write the failing test for `Desk`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Desk } from './Desk'

describe('Desk', () => {
  it('renders a top and 4 legs (5 meshes) at the given position', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Desk position={[2, 0, -1]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
    const group = renderer.scene.children[0]
    expect(group.instance.position.x).toBeCloseTo(2)
    expect(group.instance.position.z).toBeCloseTo(-1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Desk.test.tsx`
Expected: FAIL — `Cannot find module './Desk'`.

- [ ] **Step 3: Implement `src/furniture/Desk.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface DeskProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const TOP_WIDTH = 1.4
const TOP_DEPTH = 0.7
const TOP_THICKNESS = 0.04
const DESK_HEIGHT = 0.75
const LEG_SIZE = 0.05
const LEG_INSET = 0.08

export function Desk({ position = [0, 0, 0], rotation = [0, 0, 0] }: DeskProps) {
  const materials = useMaterials()
  const legHeight = DESK_HEIGHT - TOP_THICKNESS
  const legX = TOP_WIDTH / 2 - LEG_INSET
  const legZ = TOP_DEPTH / 2 - LEG_INSET
  const legPositions: [number, number, number][] = [
    [-legX, legHeight / 2, -legZ],
    [legX, legHeight / 2, -legZ],
    [-legX, legHeight / 2, legZ],
    [legX, legHeight / 2, legZ],
  ]

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, DESK_HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOP_WIDTH, TOP_THICKNESS, TOP_DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {legPositions.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[LEG_SIZE, legHeight, LEG_SIZE]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Desk.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `Chair`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Chair } from './Chair'

describe('Chair', () => {
  it('renders seat + back + gas cylinder + 5-star base (2 meshes per arm) = 13 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Chair position={[0, 0, 0]} color="#c0392b" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(13)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/Chair.test.tsx`
Expected: FAIL — `Cannot find module './Chair'`.

- [ ] **Step 7: Implement `src/furniture/Chair.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface ChairProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  color?: string
}

const SEAT_SIZE = 0.46
const SEAT_HEIGHT = 0.46
const SEAT_THICKNESS = 0.06
const BACK_HEIGHT = 0.5
const BACK_THICKNESS = 0.06
const BASE_ARM_LENGTH = 0.28

export function Chair({ position = [0, 0, 0], rotation = [0, 0, 0], color = '#3b3f46' }: ChairProps) {
  const materials = useMaterials()
  const fabric = materials.chairFabric(color)
  const cylinderHeight = SEAT_HEIGHT - 0.1
  const baseArmAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5)

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_SIZE, SEAT_THICKNESS, SEAT_SIZE]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT / 2, -SEAT_SIZE / 2 + BACK_THICKNESS / 2]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.85, BACK_HEIGHT, BACK_THICKNESS]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT - cylinderHeight / 2 - 0.05, 0]}>
        <cylinderGeometry args={[0.025, 0.025, cylinderHeight, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {baseArmAngles.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[BASE_ARM_LENGTH / 2, 0.03, 0]} castShadow>
            <boxGeometry args={[BASE_ARM_LENGTH, 0.03, 0.04]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <mesh position={[BASE_ARM_LENGTH, 0.015, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial {...materials.plasticBlack} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/Chair.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Desk.tsx src/furniture/Chair.tsx src/furniture/Desk.test.tsx src/furniture/Chair.test.tsx
git commit -m "feat: add Desk and Chair furniture components"
```

---

### Task 9: Desk accessories — Monitor, Keyboard, Mouse, Mug

**Files:**
- Create: `src/furniture/Monitor.tsx`
- Create: `src/furniture/DeskAccessories.tsx`
- Test: `src/furniture/Monitor.test.tsx`
- Test: `src/furniture/DeskAccessories.test.tsx`

**Interfaces:**
- Produces: `Monitor({ position?, rotation? })` (4 meshes: body, glowing screen, neck, base). `Keyboard({ position?, rotation? })` (1 mesh), `Mouse({ position?, rotation? })` (1 mesh), `Mug({ position?, rotation?, color? })` (2 meshes: body + handle) — all three exported from `DeskAccessories.tsx`. Consumed by `OpenSpace`, `MeetingRoom`, `FocusRoom`, `CeoOffice` room tasks.

- [ ] **Step 1: Write the failing test for `Monitor`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Monitor } from './Monitor'

describe('Monitor', () => {
  it('renders body + screen + neck + base (4 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Monitor />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Monitor.test.tsx`
Expected: FAIL — `Cannot find module './Monitor'`.

- [ ] **Step 3: Implement `src/furniture/Monitor.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface MonitorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const SCREEN_WIDTH = 0.6
const SCREEN_HEIGHT = 0.35
const BODY_THICKNESS = 0.025
const NECK_HEIGHT = 0.16
const BASE_RADIUS = 0.12

export function Monitor({ position = [0, 0, 0], rotation = [0, 0, 0] }: MonitorProps) {
  const materials = useMaterials()
  const baseY = 0.01
  const neckY = baseY + 0.01 + NECK_HEIGHT / 2
  const screenY = neckY + NECK_HEIGHT / 2 + SCREEN_HEIGHT / 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, baseY, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS, 0.02, 24]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, neckY, 0]}>
        <cylinderGeometry args={[0.02, 0.02, NECK_HEIGHT, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, screenY, 0]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT, BODY_THICKNESS]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, screenY, BODY_THICKNESS / 2 + 0.002]}>
        <boxGeometry args={[SCREEN_WIDTH - 0.03, SCREEN_HEIGHT - 0.03, 0.002]} />
        <meshStandardMaterial {...materials.screenEmissive} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Monitor.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `Keyboard`, `Mouse`, `Mug`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Keyboard, Mouse, Mug } from './DeskAccessories'

describe('DeskAccessories', () => {
  it('Keyboard renders 1 mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Keyboard />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })

  it('Mouse renders 1 mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Mouse />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })

  it('Mug renders body + handle (2 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Mug color="#d94f4f" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(2)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/DeskAccessories.test.tsx`
Expected: FAIL — `Cannot find module './DeskAccessories'`.

- [ ] **Step 7: Implement `src/furniture/DeskAccessories.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface AccessoryProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function Keyboard({ position = [0, 0, 0], rotation = [0, 0, 0] }: AccessoryProps) {
  const materials = useMaterials()
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.44, 0.02, 0.14]} />
      <meshStandardMaterial {...materials.plasticBlack} />
    </mesh>
  )
}

export function Mouse({ position = [0, 0, 0], rotation = [0, 0, 0] }: AccessoryProps) {
  const materials = useMaterials()
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.06, 0.03, 0.1]} />
      <meshStandardMaterial {...materials.plasticBlack} />
    </mesh>
  )
}

export interface MugProps extends AccessoryProps {
  color?: string
}

export function Mug({ position = [0, 0, 0], rotation = [0, 0, 0], color = '#e8e2d5' }: MugProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.09, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
      </mesh>
      <mesh position={[0.045, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.007, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/DeskAccessories.test.tsx`
Expected: `Tests  3 passed (3)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Monitor.tsx src/furniture/DeskAccessories.tsx src/furniture/Monitor.test.tsx src/furniture/DeskAccessories.test.tsx
git commit -m "feat: add Monitor, Keyboard, Mouse, Mug desk accessory components"
```

---

### Task 10: Plant + Bookshelf

**Files:**
- Create: `src/furniture/Plant.tsx`
- Create: `src/furniture/Bookshelf.tsx`
- Test: `src/furniture/Plant.test.tsx`
- Test: `src/furniture/Bookshelf.test.tsx`

**Interfaces:**
- Produces: `Plant({ position?, rotation?, scale? })` (7 meshes: pot + 6 foliage clusters). `Bookshelf({ position?, rotation? })` (18 meshes: 2 sides + 4 shelf boards + 12 books). Consumed by `OpenSpace`, `CeoOffice`, `GameRoom` room tasks.

- [ ] **Step 1: Write the failing test for `Plant`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Plant } from './Plant'

describe('Plant', () => {
  it('renders a pot and 6 foliage clusters (7 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Plant />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Plant.test.tsx`
Expected: FAIL — `Cannot find module './Plant'`.

- [ ] **Step 3: Implement `src/furniture/Plant.tsx`**

```tsx
export interface PlantProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

const POT_HEIGHT = 0.3
const POT_TOP_RADIUS = 0.2
const POT_BOTTOM_RADIUS = 0.15

const FOLIAGE_CLUSTERS: { position: [number, number, number]; radius: number }[] = [
  { position: [0, 0.75, 0], radius: 0.28 },
  { position: [0.15, 0.6, 0.1], radius: 0.2 },
  { position: [-0.18, 0.55, -0.08], radius: 0.22 },
  { position: [0.05, 0.95, -0.15], radius: 0.18 },
  { position: [-0.1, 0.9, 0.16], radius: 0.17 },
  { position: [0.02, 1.1, 0.02], radius: 0.14 },
]

export function Plant({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: PlantProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, POT_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[POT_TOP_RADIUS, POT_BOTTOM_RADIUS, POT_HEIGHT, 16]} />
        <meshStandardMaterial color="#5c4a3a" roughness={0.85} metalness={0} />
      </mesh>
      {FOLIAGE_CLUSTERS.map((cluster, i) => (
        <mesh key={i} position={cluster.position} castShadow>
          <sphereGeometry args={[cluster.radius, 10, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#2f6b3a' : '#3c8248'} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Plant.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `Bookshelf`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Bookshelf } from './Bookshelf'

describe('Bookshelf', () => {
  it('renders 2 sides + 4 shelves + 12 books (18 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Bookshelf />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(18)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/Bookshelf.test.tsx`
Expected: FAIL — `Cannot find module './Bookshelf'`.

- [ ] **Step 7: Implement `src/furniture/Bookshelf.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface BookshelfProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.8
const DEPTH = 0.3
const HEIGHT = 2.0
const BOARD_THICKNESS = 0.025
const SHELF_YS = [0.02, 0.55, 1.1, 1.65]

const BOOK_COLORS = ['#8a3b3b', '#3b5d8a', '#3b8a5d', '#8a7a3b', '#5d3b8a', '#3b8a7a']

interface Book {
  x: number
  width: number
  height: number
  color: string
}

function booksFor(shelfIndex: number): Book[] {
  const startX = -WIDTH / 2 + 0.1
  let x = startX
  const books: Book[] = []
  for (let i = 0; i < 6; i++) {
    const width = 0.03 + ((i + shelfIndex) % 3) * 0.008
    const height = 0.22 + ((i + shelfIndex) % 4) * 0.02
    books.push({ x: x + width / 2, width, height, color: BOOK_COLORS[(i + shelfIndex * 2) % BOOK_COLORS.length] })
    x += width + 0.006
  }
  return books
}

export function Bookshelf({ position = [0, 0, 0], rotation = [0, 0, 0] }: BookshelfProps) {
  const materials = useMaterials()
  const sideX = WIDTH / 2 - BOARD_THICKNESS / 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-sideX, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_THICKNESS, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      <mesh position={[sideX, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_THICKNESS, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {SHELF_YS.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH - BOARD_THICKNESS * 2, BOARD_THICKNESS, DEPTH]} />
          <meshStandardMaterial {...materials.woodDesktop} />
        </mesh>
      ))}
      {[1, 2].flatMap((shelfIndex) =>
        booksFor(shelfIndex).map((book, i) => (
          <mesh key={`${shelfIndex}-${i}`} position={[book.x, SHELF_YS[shelfIndex] + book.height / 2 + BOARD_THICKNESS / 2, 0]} castShadow>
            <boxGeometry args={[book.width, book.height, DEPTH - 0.06]} />
            <meshStandardMaterial color={book.color} roughness={0.7} metalness={0} />
          </mesh>
        )),
      )}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/Bookshelf.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Plant.tsx src/furniture/Bookshelf.tsx src/furniture/Plant.test.tsx src/furniture/Bookshelf.test.tsx
git commit -m "feat: add Plant and Bookshelf furniture components"
```

---

### Task 11: Sofa + CoffeeTable

**Files:**
- Create: `src/furniture/Sofa.tsx`
- Create: `src/furniture/CoffeeTable.tsx`
- Test: `src/furniture/Sofa.test.tsx`
- Test: `src/furniture/CoffeeTable.test.tsx`

**Interfaces:**
- Produces: `Sofa({ position?, rotation? })` (8 meshes: seat + back + 2 arms + 4 legs). `CoffeeTable({ position?, rotation? })` (5 meshes: top + 4 legs). Consumed by `OpenSpace` and `GameRoom` room tasks.

- [ ] **Step 1: Write the failing test for `Sofa`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Sofa } from './Sofa'

describe('Sofa', () => {
  it('renders seat + back + 2 arms + 4 legs (8 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Sofa />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(8)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Sofa.test.tsx`
Expected: FAIL — `Cannot find module './Sofa'`.

- [ ] **Step 3: Implement `src/furniture/Sofa.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface SofaProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.6
const DEPTH = 0.75
const SEAT_HEIGHT = 0.42
const BACK_HEIGHT = 0.55
const ARM_WIDTH = 0.15
const LEG_HEIGHT = 0.12

export function Sofa({ position = [0, 0, 0], rotation = [0, 0, 0] }: SofaProps) {
  const materials = useMaterials()
  const legX = WIDTH / 2 - 0.08
  const legZ = DEPTH / 2 - 0.08

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, LEG_HEIGHT + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, 0.36, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[0, LEG_HEIGHT + SEAT_HEIGHT + BACK_HEIGHT / 2, -DEPTH / 2 + 0.08]} castShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, BACK_HEIGHT, 0.16]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[-WIDTH / 2 + ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[WIDTH / 2 - ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, LEG_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, LEG_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Sofa.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `CoffeeTable`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CoffeeTable } from './CoffeeTable'

describe('CoffeeTable', () => {
  it('renders a top and 4 legs (5 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeTable />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/CoffeeTable.test.tsx`
Expected: FAIL — `Cannot find module './CoffeeTable'`.

- [ ] **Step 7: Implement `src/furniture/CoffeeTable.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface CoffeeTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.9
const DEPTH = 0.5
const HEIGHT = 0.4
const TOP_THICKNESS = 0.03

export function CoffeeTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: CoffeeTableProps) {
  const materials = useMaterials()
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = WIDTH / 2 - 0.06
  const legZ = DEPTH / 2 - 0.06

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, legHeight, 8]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/CoffeeTable.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Sofa.tsx src/furniture/CoffeeTable.tsx src/furniture/Sofa.test.tsx src/furniture/CoffeeTable.test.tsx
git commit -m "feat: add Sofa and CoffeeTable furniture components"
```

---

### Task 12: GlassPartition + GlassDoor

**Files:**
- Create: `src/furniture/GlassPartition.tsx`
- Create: `src/furniture/GlassDoor.tsx`
- Test: `src/furniture/GlassPartition.test.tsx`
- Test: `src/furniture/GlassDoor.test.tsx`

**Interfaces:**
- Produces: `GlassPartition({ axis, length, position, rotation? })` — floor-to-ceiling glazed partition (kickplate + glass + header + mullions spaced every 1.2m). Mesh count = `3 + (Math.max(1, Math.floor(length / 1.2)) + 1)`. `GlassDoor({ position?, rotation? })` — 0.9m × 2.1m glass door (6 meshes: glass + 4 frame members + handle). Consumed by `MeetingRoom`, `FocusRoom`, `CeoOffice` room tasks to wall off open space (two `GlassPartition` runs flanking one `GlassDoor`).

- [ ] **Step 1: Write the failing test for `GlassPartition`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassPartition } from './GlassPartition'

describe('GlassPartition', () => {
  it('renders kickplate + glass + header + mullions for a 6m run (9 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartition axis="x" length={6} position={[0, 0, -2.667]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/GlassPartition.test.tsx`
Expected: FAIL — `Cannot find module './GlassPartition'`.

- [ ] **Step 3: Implement `src/furniture/GlassPartition.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'
import { BUILDING } from '../scene/layout'

export interface GlassPartitionProps {
  axis: 'x' | 'z'
  length: number
  position: [number, number, number]
  rotation?: [number, number, number]
}

const KICK_HEIGHT = 0.1
const HEADER_HEIGHT = 0.05
const MULLION_WIDTH = 0.06
const MULLION_SPACING = 1.2
const THICKNESS = 0.05

export function GlassPartition({ axis, length, position, rotation = [0, 0, 0] }: GlassPartitionProps) {
  const materials = useMaterials()
  const glassHeight = BUILDING.wallHeight - KICK_HEIGHT - HEADER_HEIGHT
  const size = (span: number, h: number): [number, number, number] =>
    axis === 'x' ? [span, h, THICKNESS] : [THICKNESS, h, span]

  const mullionCount = Math.max(1, Math.floor(length / MULLION_SPACING))
  const mullionOffsets = Array.from({ length: mullionCount + 1 }, (_, i) => (i / mullionCount - 0.5) * length)

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, KICK_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size(length, KICK_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[0, KICK_HEIGHT + glassHeight / 2, 0]}>
        <boxGeometry args={size(length - MULLION_WIDTH, glassHeight)} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      <mesh position={[0, BUILDING.wallHeight - HEADER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={size(length, HEADER_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {mullionOffsets.map((offset, i) => (
        <mesh
          key={i}
          position={axis === 'x' ? [offset, KICK_HEIGHT + glassHeight / 2, 0] : [0, KICK_HEIGHT + glassHeight / 2, offset]}
          castShadow
        >
          <boxGeometry args={size(MULLION_WIDTH, glassHeight)} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/GlassPartition.test.tsx`
Expected: `Tests  1 passed (1)` (for `length=6`: `mullionCount = floor(6/1.2) = 5`, so `5+1=6` mullions, `3 + 6 = 9` meshes).

- [ ] **Step 5: Write the failing test for `GlassDoor`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassDoor } from './GlassDoor'

describe('GlassDoor', () => {
  it('renders glass + 4 frame members + handle (6 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassDoor />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(6)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/GlassDoor.test.tsx`
Expected: FAIL — `Cannot find module './GlassDoor'`.

- [ ] **Step 7: Implement `src/furniture/GlassDoor.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface GlassDoorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1
const FRAME_WIDTH = 0.05
const THICKNESS = 0.04

export function GlassDoor({ position = [0, 0, 0], rotation = [0, 0, 0] }: GlassDoorProps) {
  const materials = useMaterials()
  const innerWidth = DOOR_WIDTH - FRAME_WIDTH * 2
  const innerHeight = DOOR_HEIGHT - FRAME_WIDTH * 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, DOOR_HEIGHT / 2, 0]}>
        <boxGeometry args={[innerWidth, innerHeight, THICKNESS]} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      <mesh position={[0, FRAME_WIDTH / 2, 0]} castShadow>
        <boxGeometry args={[DOOR_WIDTH, FRAME_WIDTH, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT - FRAME_WIDTH / 2, 0]} castShadow>
        <boxGeometry args={[DOOR_WIDTH, FRAME_WIDTH, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[-DOOR_WIDTH / 2 + FRAME_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, DOOR_HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 - FRAME_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, DOOR_HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 - 0.12, DOOR_HEIGHT / 2, THICKNESS / 2 + 0.01]}>
        <cylinderGeometry args={[0.012, 0.012, 0.25, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/GlassDoor.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/GlassPartition.tsx src/furniture/GlassDoor.tsx src/furniture/GlassPartition.test.tsx src/furniture/GlassDoor.test.tsx
git commit -m "feat: add GlassPartition and GlassDoor components"
```

---

### Task 13: PingPongTable + PullUpBar

**Files:**
- Create: `src/furniture/PingPongTable.tsx`
- Create: `src/furniture/PullUpBar.tsx`
- Test: `src/furniture/PingPongTable.test.tsx`
- Test: `src/furniture/PullUpBar.test.tsx`

**Interfaces:**
- Produces: `PingPongTable({ position?, rotation? })` — regulation 2.74m × 1.525m table (9 meshes: top + centerline + net + 2 net posts + 4 legs). `PullUpBar({ position?, rotation? })` — free-standing power tower (7 meshes: 2 uprights + top bar + 2 base feet + 2 diagonal braces). Both consumed by the `GameRoom` room task.

- [ ] **Step 1: Write the failing test for `PingPongTable`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { PingPongTable } from './PingPongTable'

describe('PingPongTable', () => {
  it('renders top + line + net + 2 posts + 4 legs (9 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <PingPongTable />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(9)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/PingPongTable.test.tsx`
Expected: FAIL — `Cannot find module './PingPongTable'`.

- [ ] **Step 3: Implement `src/furniture/PingPongTable.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface PingPongTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const LENGTH = 2.74
const WIDTH = 1.525
const HEIGHT = 0.76
const TOP_THICKNESS = 0.03
const NET_HEIGHT = 0.15

export function PingPongTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: PingPongTableProps) {
  const materials = useMaterials()
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = LENGTH / 2 - 0.1
  const legZ = WIDTH / 2 - 0.1

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, TOP_THICKNESS, WIDTH]} />
        <meshStandardMaterial color="#1d5f8a" roughness={0.5} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.001, WIDTH]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + NET_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.01, NET_HEIGHT, WIDTH + 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} transparent opacity={0.75} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, HEIGHT + NET_HEIGHT / 2, (side * (WIDTH + 0.1)) / 2]}>
          <cylinderGeometry args={[0.012, 0.012, NET_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <boxGeometry args={[0.06, legHeight, 0.06]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/PingPongTable.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `PullUpBar`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { PullUpBar } from './PullUpBar'

describe('PullUpBar', () => {
  it('renders 2 uprights + top bar + 2 feet + 2 braces (7 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <PullUpBar />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(7)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/PullUpBar.test.tsx`
Expected: FAIL — `Cannot find module './PullUpBar'`.

- [ ] **Step 7: Implement `src/furniture/PullUpBar.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface PullUpBarProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.2
const HEIGHT = 2.2
const BAR_Y = 2.0
const POST_RADIUS = 0.035

export function PullUpBar({ position = [0, 0, 0], rotation = [0, 0, 0] }: PullUpBarProps) {
  const materials = useMaterials()
  const postX = WIDTH / 2

  return (
    <group position={position} rotation={rotation}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * postX, HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, HEIGHT, 12]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      <mesh position={[0, BAR_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, WIDTH, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`foot-${side}`} position={[side * postX, 0.02, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.04, 0.7]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`brace-${side}`}
          position={[side * postX * 0.6, HEIGHT * 0.35, 0.2]}
          rotation={[Math.PI / 5, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/PullUpBar.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/PingPongTable.tsx src/furniture/PullUpBar.tsx src/furniture/PingPongTable.test.tsx src/furniture/PullUpBar.test.tsx
git commit -m "feat: add PingPongTable and PullUpBar furniture components"
```

---

### Task 14: ServerRack

**Files:**
- Create: `src/furniture/ServerRack.tsx`
- Test: `src/furniture/ServerRack.test.tsx`

**Interfaces:**
- Produces: `ServerRack({ position?, rotation? })` — one 19" rack, 0.6m × 1.0m × 2.0m (19 meshes: body + 2 side panels + 8 unit slots + 8 LED indicators). Consumed by the `ServerRoom` room task (placed 3–4 times).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { ServerRack } from './ServerRack'

describe('ServerRack', () => {
  it('renders body + 2 side panels + 8 unit slots + 8 LEDs (19 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRack />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(19)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/ServerRack.test.tsx`
Expected: FAIL — `Cannot find module './ServerRack'`.

- [ ] **Step 3: Implement `src/furniture/ServerRack.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface ServerRackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.6
const DEPTH = 1.0
const HEIGHT = 2.0
const UNIT_COUNT = 8
const UNIT_HEIGHT = 0.18
const UNIT_GAP = 0.02
const LED_COLORS = ['ledGreen', 'ledAmber'] as const

export function ServerRack({ position = [0, 0, 0], rotation = [0, 0, 0] }: ServerRackProps) {
  const materials = useMaterials()
  const stackHeight = UNIT_COUNT * (UNIT_HEIGHT + UNIT_GAP)
  const startY = HEIGHT - 0.15 - stackHeight

  return (
    <group position={position} rotation={rotation}>
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
      {Array.from({ length: UNIT_COUNT }, (_, i) => {
        const y = startY + i * (UNIT_HEIGHT + UNIT_GAP)
        const ledKey = LED_COLORS[i % 2]
        return (
          <group key={i}>
            <mesh position={[0, y, DEPTH / 2 + 0.005]} castShadow>
              <boxGeometry args={[WIDTH - 0.04, UNIT_HEIGHT, 0.01]} />
              <meshStandardMaterial {...materials.metalFrame} />
            </mesh>
            <mesh position={[WIDTH / 2 - 0.06, y, DEPTH / 2 + 0.012]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial {...materials[ledKey]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/ServerRack.test.tsx`
Expected: `Tests  1 passed (1)` (1 body + 2 side panels + 8 × (unit + LED) = 3 + 16 = 19).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/furniture/ServerRack.tsx src/furniture/ServerRack.test.tsx
git commit -m "feat: add ServerRack furniture component"
```

---

### Task 15: Kitchen furniture — CoffeeMachine, KitchenIsland, BarStool, Fridge

**Files:**
- Create: `src/furniture/CoffeeMachine.tsx`
- Create: `src/furniture/KitchenIsland.tsx`
- Create: `src/furniture/BarStool.tsx`
- Create: `src/furniture/Fridge.tsx`
- Test: `src/furniture/CoffeeMachine.test.tsx`
- Test: `src/furniture/KitchenIsland.test.tsx`
- Test: `src/furniture/BarStool.test.tsx`
- Test: `src/furniture/Fridge.test.tsx`

**Interfaces:**
- Produces: `CoffeeMachine` (5 meshes), `KitchenIsland` (7 meshes), `BarStool` (4 meshes), `Fridge` (3 meshes) — each `({ position?, rotation? })`. All consumed by the `Kitchen` room task.

- [ ] **Step 1: Write the failing test for `CoffeeMachine`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CoffeeMachine } from './CoffeeMachine'

describe('CoffeeMachine', () => {
  it('renders body + tank + tray + display + spout (5 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeMachine />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/CoffeeMachine.test.tsx`
Expected: FAIL — `Cannot find module './CoffeeMachine'`.

- [ ] **Step 3: Implement `src/furniture/CoffeeMachine.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface CoffeeMachineProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function CoffeeMachine({ position = [0, 0, 0], rotation = [0, 0, 0] }: CoffeeMachineProps) {
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
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/CoffeeMachine.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `KitchenIsland`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { KitchenIsland } from './KitchenIsland'

describe('KitchenIsland', () => {
  it('renders top + 3 cabinet doors + sink + 2-piece faucet (7 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <KitchenIsland />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(7)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/KitchenIsland.test.tsx`
Expected: FAIL — `Cannot find module './KitchenIsland'`.

- [ ] **Step 7: Implement `src/furniture/KitchenIsland.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface KitchenIslandProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 2.0
const DEPTH = 1.0
const HEIGHT = 0.9
const TOP_THICKNESS = 0.04

export function KitchenIsland({ position = [0, 0, 0], rotation = [0, 0, 0] }: KitchenIslandProps) {
  const materials = useMaterials()
  const doorWidth = WIDTH / 3 - 0.03

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * (WIDTH / 3), (HEIGHT - TOP_THICKNESS) / 2, DEPTH / 2 - 0.01]} castShadow>
          <boxGeometry args={[doorWidth, HEIGHT - TOP_THICKNESS - 0.05, 0.02]} />
          <meshStandardMaterial {...materials.wallAccentBlue} />
        </mesh>
      ))}
      <mesh position={[0.5, HEIGHT - TOP_THICKNESS - 0.03, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.5, HEIGHT + 0.15, -0.1]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.5, HEIGHT + 0.28, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.16, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/KitchenIsland.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Write the failing test for `BarStool`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { BarStool } from './BarStool'

describe('BarStool', () => {
  it('renders seat + pole + foot ring + base (4 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <BarStool />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(4)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/furniture/BarStool.test.tsx`
Expected: FAIL — `Cannot find module './BarStool'`.

- [ ] **Step 11: Implement `src/furniture/BarStool.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface BarStoolProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const SEAT_HEIGHT = 0.75
const SEAT_RADIUS = 0.16

export function BarStool({ position = [0, 0, 0], rotation = [0, 0, 0] }: BarStoolProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[SEAT_RADIUS, SEAT_RADIUS, 0.05, 20]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, SEAT_HEIGHT, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT * 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.012, 8, 20]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 20]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/furniture/BarStool.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 13: Write the failing test for `Fridge`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Fridge } from './Fridge'

describe('Fridge', () => {
  it('renders body + seam + handle (3 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Fridge />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
```

- [ ] **Step 14: Run test to verify it fails**

Run: `npx vitest run src/furniture/Fridge.test.tsx`
Expected: FAIL — `Cannot find module './Fridge'`.

- [ ] **Step 15: Implement `src/furniture/Fridge.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface FridgeProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.7
const DEPTH = 0.7
const HEIGHT = 1.8

export function Fridge({ position = [0, 0, 0], rotation = [0, 0, 0] }: FridgeProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, HEIGHT * 0.72, DEPTH / 2 + 0.002]}>
        <boxGeometry args={[WIDTH, 0.015, 0.004]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[WIDTH / 2 - 0.05, HEIGHT * 0.55, DEPTH / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.03, 0.35, 0.03]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npx vitest run src/furniture/Fridge.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 17: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 18: Commit**

```bash
git add src/furniture/CoffeeMachine.tsx src/furniture/KitchenIsland.tsx src/furniture/BarStool.tsx src/furniture/Fridge.tsx src/furniture/CoffeeMachine.test.tsx src/furniture/KitchenIsland.test.tsx src/furniture/BarStool.test.tsx src/furniture/Fridge.test.tsx
git commit -m "feat: add kitchen furniture (CoffeeMachine, KitchenIsland, BarStool, Fridge)"
```

---

### Task 16: MeetingTable + TVPanel + Whiteboard

**Files:**
- Create: `src/furniture/MeetingTable.tsx`
- Create: `src/furniture/TVPanel.tsx`
- Create: `src/furniture/Whiteboard.tsx`
- Test: `src/furniture/MeetingTable.test.tsx`
- Test: `src/furniture/TVPanel.test.tsx`
- Test: `src/furniture/Whiteboard.test.tsx`

**Interfaces:**
- Produces: `MeetingTable({ position?, rotation? })` (5 meshes: top + 4 legs, 3.2m × 1.2m). `TVPanel({ position?, rotation? })` (3 meshes: body + emissive screen + wall mount). `Whiteboard({ position?, rotation? })` (5 meshes: board + tray + 3 markers). All consumed by the `MeetingRoom` room task.

- [ ] **Step 1: Write the failing test for `MeetingTable`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { MeetingTable } from './MeetingTable'

describe('MeetingTable', () => {
  it('renders a top and 4 legs (5 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <MeetingTable />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/MeetingTable.test.tsx`
Expected: FAIL — `Cannot find module './MeetingTable'`.

- [ ] **Step 3: Implement `src/furniture/MeetingTable.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface MeetingTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const LENGTH = 3.2
const WIDTH = 1.2
const HEIGHT = 0.75
const TOP_THICKNESS = 0.04

export function MeetingTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: MeetingTableProps) {
  const materials = useMaterials()
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = LENGTH / 2 - 0.15
  const legZ = WIDTH / 2 - 0.15

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, TOP_THICKNESS, WIDTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <boxGeometry args={[0.08, legHeight, 0.08]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/MeetingTable.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `TVPanel`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { TVPanel } from './TVPanel'

describe('TVPanel', () => {
  it('renders body + screen + mount (3 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <TVPanel />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/TVPanel.test.tsx`
Expected: FAIL — `Cannot find module './TVPanel'`.

- [ ] **Step 7: Implement `src/furniture/TVPanel.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface TVPanelProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.4
const HEIGHT = 0.8
const THICKNESS = 0.04

export function TVPanel({ position = [0, 0, 0], rotation = [0, 0, 0] }: TVPanelProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0, THICKNESS / 2 + 0.002]}>
        <boxGeometry args={[WIDTH - 0.04, HEIGHT - 0.04, 0.002]} />
        <meshStandardMaterial {...materials.screenEmissive} />
      </mesh>
      <mesh position={[0, 0, -THICKNESS / 2 - 0.03]}>
        <boxGeometry args={[0.3, 0.2, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/TVPanel.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Write the failing test for `Whiteboard`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Whiteboard } from './Whiteboard'

describe('Whiteboard', () => {
  it('renders board + tray + 3 markers (5 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Whiteboard />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/furniture/Whiteboard.test.tsx`
Expected: FAIL — `Cannot find module './Whiteboard'`.

- [ ] **Step 11: Implement `src/furniture/Whiteboard.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface WhiteboardProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.5
const HEIGHT = 1.0
const MARKER_COLORS = ['#1a1a1a', '#c0392b', '#2166c9']

export function Whiteboard({ position = [0, 0, 0], rotation = [0, 0, 0] }: WhiteboardProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, 0.02]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.3} metalness={0} />
      </mesh>
      <mesh position={[0, -HEIGHT / 2 - 0.03, 0.03]} castShadow>
        <boxGeometry args={[WIDTH * 0.6, 0.04, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {MARKER_COLORS.map((color, i) => (
        <mesh
          key={color}
          position={[-0.15 + i * 0.12, -HEIGHT / 2 + 0.01, 0.05]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/furniture/Whiteboard.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 13: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 14: Commit**

```bash
git add src/furniture/MeetingTable.tsx src/furniture/TVPanel.tsx src/furniture/Whiteboard.tsx src/furniture/MeetingTable.test.tsx src/furniture/TVPanel.test.tsx src/furniture/Whiteboard.test.tsx
git commit -m "feat: add MeetingTable, TVPanel, Whiteboard furniture components"
```

---

### Task 17: CeoDesk + CaptainChair + WindowSkyline

**Files:**
- Create: `src/furniture/CeoDesk.tsx`
- Create: `src/furniture/CaptainChair.tsx`
- Create: `src/furniture/WindowSkyline.tsx`
- Test: `src/furniture/CeoDesk.test.tsx`
- Test: `src/furniture/CaptainChair.test.tsx`
- Test: `src/furniture/WindowSkyline.test.tsx`

**Interfaces:**
- Produces: `CeoDesk({ position?, rotation? })` (4 meshes: top + modesty panel + 2 pedestal cabinets, 2.0m × 1.0m executive desk). `CaptainChair({ position?, rotation? })` (14 meshes: seat + back + headrest + gas cylinder + 5-star base with 2 meshes per arm). `WindowSkyline({ position?, rotation? })` (7 meshes: backdrop + 6 building silhouettes). All consumed by the `CeoOffice` room task.

- [ ] **Step 1: Write the failing test for `CeoDesk`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CeoDesk } from './CeoDesk'

describe('CeoDesk', () => {
  it('renders top + modesty panel + 2 pedestals (4 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CeoDesk />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/CeoDesk.test.tsx`
Expected: FAIL — `Cannot find module './CeoDesk'`.

- [ ] **Step 3: Implement `src/furniture/CeoDesk.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface CeoDeskProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 2.0
const DEPTH = 1.0
const HEIGHT = 0.75
const TOP_THICKNESS = 0.05

export function CeoDesk({ position = [0, 0, 0], rotation = [0, 0, 0] }: CeoDeskProps) {
  const materials = useMaterials()
  const pedestalWidth = 0.5
  const pedestalHeight = HEIGHT - TOP_THICKNESS
  const pedestalX = WIDTH / 2 - pedestalWidth / 2 - 0.05

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.4} metalness={0} />
      </mesh>
      <mesh position={[0, pedestalHeight / 2, -DEPTH / 2 + 0.05]} castShadow>
        <boxGeometry args={[WIDTH - 1.1, pedestalHeight - 0.1, 0.03]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.4} metalness={0} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * pedestalX, pedestalHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[pedestalWidth, pedestalHeight, DEPTH - 0.1]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/CeoDesk.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `CaptainChair`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CaptainChair } from './CaptainChair'

describe('CaptainChair', () => {
  it('renders seat + back + headrest + cylinder + 5-star base (2 meshes per arm) = 14 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CaptainChair />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(14)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/CaptainChair.test.tsx`
Expected: FAIL — `Cannot find module './CaptainChair'`.

- [ ] **Step 7: Implement `src/furniture/CaptainChair.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface CaptainChairProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const SEAT_SIZE = 0.5
const SEAT_HEIGHT = 0.48
const BACK_HEIGHT = 0.75
const BASE_ARM_LENGTH = 0.3

export function CaptainChair({ position = [0, 0, 0], rotation = [0, 0, 0] }: CaptainChairProps) {
  const materials = useMaterials()
  const cylinderHeight = SEAT_HEIGHT - 0.1
  const baseArmAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5)

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_SIZE, 0.08, SEAT_SIZE]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT / 2, -SEAT_SIZE / 2 + 0.04]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.9, BACK_HEIGHT, 0.08]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT + 0.08, -SEAT_SIZE / 2 + 0.04]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.5, 0.16, 0.08]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT - cylinderHeight / 2 - 0.05, 0]}>
        <cylinderGeometry args={[0.03, 0.03, cylinderHeight, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {baseArmAngles.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[BASE_ARM_LENGTH / 2, 0.03, 0]} castShadow>
            <boxGeometry args={[BASE_ARM_LENGTH, 0.03, 0.045]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <mesh position={[BASE_ARM_LENGTH, 0.015, 0]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial {...materials.plasticBlack} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/CaptainChair.test.tsx`
Expected: `Tests  1 passed (1)` (seat + back + headrest + cylinder = 4, plus 5 × 2 = 10, total 14).

- [ ] **Step 9: Write the failing test for `WindowSkyline`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { WindowSkyline } from './WindowSkyline'

describe('WindowSkyline', () => {
  it('renders a backdrop and 6 building silhouettes (7 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <WindowSkyline />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(7)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/furniture/WindowSkyline.test.tsx`
Expected: FAIL — `Cannot find module './WindowSkyline'`.

- [ ] **Step 11: Implement `src/furniture/WindowSkyline.tsx`**

```tsx
export interface WindowSkylineProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const BUILDINGS: { x: number; width: number; height: number }[] = [
  { x: -3.5, width: 1.2, height: 3.5 },
  { x: -2.1, width: 0.9, height: 5.2 },
  { x: -0.9, width: 1.4, height: 4.0 },
  { x: 0.6, width: 1.0, height: 6.0 },
  { x: 1.9, width: 1.3, height: 4.6 },
  { x: 3.3, width: 1.0, height: 3.2 },
]

export function WindowSkyline({ position = [0, 0, 0], rotation = [0, 0, 0] }: WindowSkylineProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color="#9fc4e0" roughness={1} metalness={0} emissive="#7fa8c9" emissiveIntensity={0.15} />
      </mesh>
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.height / 2 - 2, -0.05]}>
          <boxGeometry args={[b.width, b.height, 0.4]} />
          <meshStandardMaterial color="#5c6b78" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/furniture/WindowSkyline.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 13: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 14: Commit**

```bash
git add src/furniture/CeoDesk.tsx src/furniture/CaptainChair.tsx src/furniture/WindowSkyline.tsx src/furniture/CeoDesk.test.tsx src/furniture/CaptainChair.test.tsx src/furniture/WindowSkyline.test.tsx
git commit -m "feat: add CeoDesk, CaptainChair, WindowSkyline furniture components"
```

---

### Task 18: Architectural details — Signage, AcousticCeilingPanel, TrackLight

**Files:**
- Create: `src/furniture/Signage.tsx`
- Create: `src/furniture/AcousticCeilingPanel.tsx`
- Create: `src/furniture/TrackLight.tsx`
- Test: `src/furniture/Signage.test.tsx`
- Test: `src/furniture/AcousticCeilingPanel.test.tsx`
- Test: `src/furniture/TrackLight.test.tsx`

**Interfaces:**
- Produces: `Signage({ position?, rotation? })` (3 meshes: plaque + ring + dot — an abstract "orbit" logo mark, no external font dependency). `AcousticCeilingPanel({ position?, rotation? })` (3 meshes: panel + 2 suspension cables). `TrackLight({ position?, rotation?, withSpot? })` (4 meshes: rail + 3 fixture heads; when `withSpot` is true, also adds a real non-mesh `spotLight`). `Signage` and `AcousticCeilingPanel` are consumed by the `OpenSpace` room task (Task 19); `TrackLight` is consumed by `OpenSpace` (Task 19) and `MeetingRoom` (Task 20).

- [ ] **Step 1: Write the failing test for `Signage`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Signage } from './Signage'

describe('Signage', () => {
  it('renders plaque + ring + dot (3 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Signage />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/Signage.test.tsx`
Expected: FAIL — `Cannot find module './Signage'`.

- [ ] **Step 3: Implement `src/furniture/Signage.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface SignageProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function Signage({ position = [0, 0, 0], rotation = [0, 0, 0] }: SignageProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 0.9, 0.04]} />
        <meshStandardMaterial {...materials.wallAccentBlue} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <torusGeometry args={[0.22, 0.03, 12, 32]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.28, 0.1, 0.06]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={1.5} roughness={0.4} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Signage.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `AcousticCeilingPanel`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { AcousticCeilingPanel } from './AcousticCeilingPanel'

describe('AcousticCeilingPanel', () => {
  it('renders a panel and 2 suspension cables (3 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <AcousticCeilingPanel />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/furniture/AcousticCeilingPanel.test.tsx`
Expected: FAIL — `Cannot find module './AcousticCeilingPanel'`.

- [ ] **Step 7: Implement `src/furniture/AcousticCeilingPanel.tsx`**

```tsx
export interface AcousticCeilingPanelProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  color?: string
}

export function AcousticCeilingPanel({ position = [0, 0, 0], rotation = [0, 0, 0], color = '#8a9a8f' }: AcousticCeilingPanelProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.03, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.5, 0.15, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.3, 6]} />
          <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/furniture/AcousticCeilingPanel.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Write the failing test for `TrackLight`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { TrackLight } from './TrackLight'

describe('TrackLight', () => {
  it('renders a rail and 3 fixture heads (4 meshes) with no real light by default', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <TrackLight />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(4)
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(0)
  })

  it('adds a real spot light when withSpot is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <TrackLight withSpot />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/furniture/TrackLight.test.tsx`
Expected: FAIL — `Cannot find module './TrackLight'`.

- [ ] **Step 11: Implement `src/furniture/TrackLight.tsx`**

```tsx
import { useMaterials } from '../materials/MaterialsContext'

export interface TrackLightProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  withSpot?: boolean
}

const RAIL_LENGTH = 1.6
const FIXTURE_OFFSETS = [-0.55, 0, 0.55]

export function TrackLight({ position = [0, 0, 0], rotation = [0, 0, 0], withSpot = false }: TrackLightProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[RAIL_LENGTH, 0.04, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {FIXTURE_OFFSETS.map((x, i) => (
        <mesh key={i} position={[x, -0.06, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.08, 12]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
      {withSpot && (
        <spotLight
          position={[0, -0.1, 0]}
          angle={0.5}
          penumbra={0.6}
          intensity={8}
          distance={6}
          castShadow
        />
      )}
    </group>
  )
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/furniture/TrackLight.test.tsx`
Expected: `Tests  2 passed (2)`.

- [ ] **Step 13: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; every test from Tasks 1–18 passes.

- [ ] **Step 14: Commit**

```bash
git add src/furniture/Signage.tsx src/furniture/AcousticCeilingPanel.tsx src/furniture/TrackLight.tsx src/furniture/Signage.test.tsx src/furniture/AcousticCeilingPanel.test.tsx src/furniture/TrackLight.test.tsx
git commit -m "feat: add Signage, AcousticCeilingPanel, TrackLight architectural detail components"
```

---

## Phase 3 — Room Assembly

Room components live in `src/rooms/`, each exporting one no-props component that positions itself via `roomCenter(ROOMS.<name>)` from `src/scene/layout.ts` and is responsible for its own interior walls **except** the wall shared with the room immediately to its south in the same column, which is drawn by that northern room (i.e. `meetingRoom` draws the wall it shares with `focusRoom`; `focusRoom` draws the wall it shares with `serverRoom`; `ceoOffice` draws the wall it shares with `kitchen`; `kitchen` draws the wall it shares with `gameRoom`). This avoids doubled-up geometry at shared boundaries. Exterior walls (Building's curtain walls / cutaway sills) are never redrawn by room components.

Two anchor conventions are in play and do **not** match — use each exactly as its own task defined it: `Wall` (Task 7) takes `center` at **half the wall's height** (e.g. `[x, 1.4, z]` for a 2.8m wall). `GlassPartition`/`CurtainWall`/`GlassDoor` (Tasks 7, 12) take `position` at **floor level** (`y = 0`) and compute their own vertical offsets internally.

Because room components compose many furniture pieces, their smoke tests assert a **minimum** mesh count (a threshold, not an exact number) plus any structurally-important element (e.g. a light count) — computing an exact total by hand across a dozen nested components is error-prone and adds no regression value over a threshold. Furniture-level tests (Phase 2) keep exact counts because those component trees are small and fully hand-verifiable.

### Task 19: Workstation (shared) + OpenSpace room

**Files:**
- Create: `src/furniture/Workstation.tsx`
- Create: `src/rooms/OpenSpace.tsx`
- Test: `src/furniture/Workstation.test.tsx`
- Test: `src/rooms/OpenSpace.test.tsx`

**Interfaces:**
- Produces: `Workstation({ position?, rotation?, chairColor? })` (26 meshes: Desk 5 + Chair 13 + Monitor 4 + Keyboard 1 + Mouse 1 + Mug 2) — a desk fully dressed with chair and accessories. Consumed by `OpenSpace` (this task) and `FocusRoom` (Task 20). `OpenSpace()` — no props, self-positions via `ROOMS.openSpace`. Consumed by `Office.tsx` (Task 23).

- [ ] **Step 1: Write the failing test for `Workstation`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Workstation } from './Workstation'

describe('Workstation', () => {
  it('renders desk + chair + monitor + keyboard + mouse + mug (26 meshes)', async () => {
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
Expected: FAIL — `Cannot find module './Workstation'`.

- [ ] **Step 3: Implement `src/furniture/Workstation.tsx`**

```tsx
import { Desk } from './Desk'
import { Chair } from './Chair'
import { Monitor } from './Monitor'
import { Keyboard, Mouse, Mug } from './DeskAccessories'

export interface WorkstationProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  chairColor?: string
}

export function Workstation({ position = [0, 0, 0], rotation = [0, 0, 0], chairColor = '#3b3f46' }: WorkstationProps) {
  return (
    <group position={position} rotation={rotation}>
      <Desk />
      <Chair position={[0, 0, -0.55]} color={chairColor} />
      <Monitor position={[0, 0.75, 0.2]} rotation={[0, Math.PI, 0]} />
      <Keyboard position={[0, 0.76, -0.1]} />
      <Mouse position={[0.28, 0.765, -0.1]} />
      <Mug position={[-0.25, 0.75, -0.15]} />
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/Workstation.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `OpenSpace`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { OpenSpace } from './OpenSpace'

describe('OpenSpace', () => {
  it('renders 4 desk clusters, a lounge, plants, signage, and ceiling fixtures', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <OpenSpace />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(100)
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/rooms/OpenSpace.test.tsx`
Expected: FAIL — `Cannot find module './OpenSpace'`.

- [ ] **Step 7: Implement `src/rooms/OpenSpace.tsx`**

```tsx
import { Workstation } from '../furniture/Workstation'
import { Plant } from '../furniture/Plant'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Signage } from '../furniture/Signage'
import { TrackLight } from '../furniture/TrackLight'
import { AcousticCeilingPanel } from '../furniture/AcousticCeilingPanel'
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
        <Workstation key={i} position={[dx, 0, dz]} chairColor={CHAIR_COLORS[i % CHAIR_COLORS.length]} />
      ))}
    </group>
  )
}

const PLANT_POSITIONS: [number, number][] = [
  [-5.4, -6.5],
  [5.4, -6.5],
  [-5.4, 6.5],
  [5.4, 6.5],
  [0, -7],
]

export function OpenSpace() {
  const center = roomCenter(ROOMS.openSpace)
  return (
    <group position={center}>
      {CLUSTER_CENTERS.map((c, i) => (
        <WorkstationCluster key={i} center={c} />
      ))}
      <Sofa position={[-1, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <CoffeeTable position={[0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      {PLANT_POSITIONS.map(([x, z], i) => (
        <Plant key={i} position={[x, 0, z]} />
      ))}
      <Signage position={[2, 0.9, 7.8]} rotation={[0, Math.PI, 0]} />
      <TrackLight position={[-3, 2.7, -4]} withSpot />
      <TrackLight position={[3, 2.7, -4]} />
      <TrackLight position={[-3, 2.7, 4]} />
      <TrackLight position={[3, 2.7, 4]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, -1.5]} />
      <AcousticCeilingPanel position={[1.5, 2.65, 1.5]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, 1.5]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/rooms/OpenSpace.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/furniture/Workstation.tsx src/furniture/Workstation.test.tsx src/rooms/OpenSpace.tsx src/rooms/OpenSpace.test.tsx
git commit -m "feat: add Workstation component and assemble the OpenSpace room"
```

---

### Task 20: GlassPartitionWithDoor (shared) + MeetingRoom + FocusRoom

**Files:**
- Create: `src/furniture/GlassPartitionWithDoor.tsx`
- Create: `src/rooms/MeetingRoom.tsx`
- Create: `src/rooms/FocusRoom.tsx`
- Test: `src/furniture/GlassPartitionWithDoor.test.tsx`
- Test: `src/rooms/MeetingRoom.test.tsx`
- Test: `src/rooms/FocusRoom.test.tsx`

**Interfaces:**
- Produces: `GlassPartitionWithDoor({ axis, length, position })` — two `GlassPartition` runs flanking a centered `GlassDoor`. Consumed by `MeetingRoom`, `FocusRoom` (this task), and `CeoOffice`, `Kitchen`, `GameRoom` (Tasks 21–22). `MeetingRoom()` and `FocusRoom()` — no props, self-position via `ROOMS`. Both consumed by `Office.tsx` (Task 23).

- [ ] **Step 1: Write the failing test for `GlassPartitionWithDoor`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassPartitionWithDoor } from './GlassPartitionWithDoor'

describe('GlassPartitionWithDoor', () => {
  it('renders two glass segments (6 meshes each for a 6m run split by a 0.9m door) plus a 6-mesh door = 18 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartitionWithDoor axis="z" length={6} position={[0, 0, 0]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(18)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/furniture/GlassPartitionWithDoor.test.tsx`
Expected: FAIL — `Cannot find module './GlassPartitionWithDoor'`.

- [ ] **Step 3: Implement `src/furniture/GlassPartitionWithDoor.tsx`**

```tsx
import { GlassPartition } from './GlassPartition'
import { GlassDoor } from './GlassDoor'

export interface GlassPartitionWithDoorProps {
  axis: 'x' | 'z'
  length: number
  position: [number, number, number]
}

const DOOR_WIDTH = 0.9

export function GlassPartitionWithDoor({ axis, length, position }: GlassPartitionWithDoorProps) {
  const segmentLength = (length - DOOR_WIDTH) / 2
  const offset = segmentLength / 2 + DOOR_WIDTH / 2
  const segA: [number, number, number] =
    axis === 'x' ? [position[0] - offset, position[1], position[2]] : [position[0], position[1], position[2] - offset]
  const segB: [number, number, number] =
    axis === 'x' ? [position[0] + offset, position[1], position[2]] : [position[0], position[1], position[2] + offset]
  const doorRotationY = axis === 'x' ? 0 : Math.PI / 2

  return (
    <group>
      <GlassPartition axis={axis} length={segmentLength} position={segA} />
      <GlassPartition axis={axis} length={segmentLength} position={segB} />
      <GlassDoor position={position} rotation={[0, doorRotationY, 0]} />
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/furniture/GlassPartitionWithDoor.test.tsx`
Expected: `Tests  1 passed (1)` (`segmentLength = (6-0.9)/2 = 2.55`; `mullionCount = floor(2.55/1.2) = 2`, so `2+1=3` mullions, `3+3=6` meshes per segment, `6×2=12`, plus `GlassDoor`'s 6 meshes = 18).

- [ ] **Step 5: Write the failing test for `MeetingRoom`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { MeetingRoom } from './MeetingRoom'

describe('MeetingRoom', () => {
  it('renders the glazed entrance, a solid south wall, a table, 8 chairs, a TV and a whiteboard', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <MeetingRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/rooms/MeetingRoom.test.tsx`
Expected: FAIL — `Cannot find module './MeetingRoom'`.

- [ ] **Step 7: Implement `src/rooms/MeetingRoom.tsx`**

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { MeetingTable } from '../furniture/MeetingTable'
import { Chair } from '../furniture/Chair'
import { TVPanel } from '../furniture/TVPanel'
import { Whiteboard } from '../furniture/Whiteboard'
import { TrackLight } from '../furniture/TrackLight'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const CHAIR_X = [-1.1, -0.4, 0.4, 1.1]

export function MeetingRoom() {
  const bounds = ROOMS.meetingRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

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
      <MeetingTable />
      {CHAIR_X.map((x) => (
        <Chair key={`n-${x}`} position={[x, 0, -1.1]} color="#2c3e50" />
      ))}
      {CHAIR_X.map((x) => (
        <Chair key={`s-${x}`} position={[x, 0, 1.1]} rotation={[0, Math.PI, 0]} color="#2c3e50" />
      ))}
      <TVPanel position={[0, 1.6, depth / 2 - 0.15]} rotation={[0, Math.PI, 0]} />
      <Whiteboard position={[-2, 1.4, depth / 2 - 0.15]} rotation={[0, Math.PI, 0]} />
      <TrackLight position={[0, 2.7, -1]} withSpot />
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/rooms/MeetingRoom.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Write the failing test for `FocusRoom`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { FocusRoom } from './FocusRoom'

describe('FocusRoom', () => {
  it('renders the glazed entrance, a solid south wall, and 2 workstations', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <FocusRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npx vitest run src/rooms/FocusRoom.test.tsx`
Expected: FAIL — `Cannot find module './FocusRoom'`.

- [ ] **Step 11: Implement `src/rooms/FocusRoom.tsx`**

Note: `FocusRoom` does **not** draw the wall shared with `MeetingRoom` to its north — `MeetingRoom` already draws it (see the Phase 3 ownership convention above).

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { Workstation } from '../furniture/Workstation'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function FocusRoom() {
  const bounds = ROOMS.focusRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

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
      <Workstation position={[-1.5, 0, 0]} chairColor="#5c6b78" />
      <Workstation position={[1.5, 0, 0]} rotation={[0, Math.PI, 0]} chairColor="#5c6b78" />
    </group>
  )
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npx vitest run src/rooms/FocusRoom.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 13: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; all tests from Tasks 1–20 pass.

- [ ] **Step 14: Commit**

```bash
git add src/furniture/GlassPartitionWithDoor.tsx src/furniture/GlassPartitionWithDoor.test.tsx src/rooms/MeetingRoom.tsx src/rooms/MeetingRoom.test.tsx src/rooms/FocusRoom.tsx src/rooms/FocusRoom.test.tsx
git commit -m "feat: add GlassPartitionWithDoor and assemble MeetingRoom and FocusRoom"
```

---

### Task 21: CeoOffice + Kitchen

**Files:**
- Create: `src/rooms/CeoOffice.tsx`
- Create: `src/rooms/Kitchen.tsx`
- Test: `src/rooms/CeoOffice.test.tsx`
- Test: `src/rooms/Kitchen.test.tsx`

**Interfaces:**
- Produces: `CeoOffice()` and `Kitchen()` — no props, self-position via `ROOMS`. Both consumed by `Office.tsx` (Task 23). `Kitchen` draws the wall shared with `GameRoom` (Task 22 does not redraw it).

- [ ] **Step 1: Write the failing test for `CeoOffice`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CeoOffice } from './CeoOffice'

describe('CeoOffice', () => {
  it('renders the glazed entrance, desk, chair, skyline, bookshelf, and visitor seating', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CeoOffice />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rooms/CeoOffice.test.tsx`
Expected: FAIL — `Cannot find module './CeoOffice'`.

- [ ] **Step 3: Implement `src/rooms/CeoOffice.tsx`**

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { CeoDesk } from '../furniture/CeoDesk'
import { CaptainChair } from '../furniture/CaptainChair'
import { WindowSkyline } from '../furniture/WindowSkyline'
import { Bookshelf } from '../furniture/Bookshelf'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Plant } from '../furniture/Plant'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function CeoOffice() {
  const bounds = ROOMS.ceoOffice
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
      <WindowSkyline position={[0, 2.5, -depth / 2 - 0.5]} />
      <CeoDesk position={[0, 0, -1.6]} />
      <CaptainChair position={[0, 0, -2.2]} />
      <Bookshelf position={[width / 2 - 0.4, 0, -1.8]} rotation={[0, -Math.PI / 2, 0]} />
      <Sofa position={[-1.6, 0, 1.6]} rotation={[0, Math.PI / 4, 0]} />
      <CoffeeTable position={[-0.6, 0, 1.9]} />
      <Plant position={[width / 2 - 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/rooms/CeoOffice.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `Kitchen`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Kitchen } from './Kitchen'

describe('Kitchen', () => {
  it('renders the glazed entrance, island, coffee machine, 3 stools, and a fridge', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Kitchen />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(40)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/rooms/Kitchen.test.tsx`
Expected: FAIL — `Cannot find module './Kitchen'`.

- [ ] **Step 7: Implement `src/rooms/Kitchen.tsx`**

```tsx
import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { KitchenIsland } from '../furniture/KitchenIsland'
import { CoffeeMachine } from '../furniture/CoffeeMachine'
import { BarStool } from '../furniture/BarStool'
import { Fridge } from '../furniture/Fridge'
import { Plant } from '../furniture/Plant'
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
      <CoffeeMachine position={[0.7, 0.9, -0.6]} />
      {STOOL_X.map((x) => (
        <BarStool key={x} position={[x, 0, 0.3]} />
      ))}
      <Fridge position={[width / 2 - 0.5, 0, depth / 2 - 0.5]} />
      <Plant position={[-width / 2 + 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/rooms/Kitchen.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; all tests from Tasks 1–21 pass.

- [ ] **Step 10: Commit**

```bash
git add src/rooms/CeoOffice.tsx src/rooms/CeoOffice.test.tsx src/rooms/Kitchen.tsx src/rooms/Kitchen.test.tsx
git commit -m "feat: assemble CeoOffice and Kitchen rooms"
```

---

### Task 22: GameRoom + ServerRoom

**Files:**
- Create: `src/rooms/GameRoom.tsx`
- Create: `src/rooms/ServerRoom.tsx`
- Test: `src/rooms/GameRoom.test.tsx`
- Test: `src/rooms/ServerRoom.test.tsx`

**Interfaces:**
- Produces: `GameRoom()` and `ServerRoom()` — no props, self-position via `ROOMS`. Both consumed by `Office.tsx` (Task 23). Neither draws the wall shared with its northern neighbor (`Kitchen` already drew the `Kitchen`/`GameRoom` wall in Task 21; `FocusRoom` already drew the `FocusRoom`/`ServerRoom` wall in Task 20). `ServerRoom` uses solid `Wall` (not `GlassPartitionWithDoor`) on its open-space-facing edge, per spec — the only room with opaque walls throughout.

- [ ] **Step 1: Write the failing test for `GameRoom`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GameRoom } from './GameRoom'

describe('GameRoom', () => {
  it('renders the glazed entrance, a ping pong table, a pull-up bar, and lounge seating', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GameRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(40)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/rooms/GameRoom.test.tsx`
Expected: FAIL — `Cannot find module './GameRoom'`.

- [ ] **Step 3: Implement `src/rooms/GameRoom.tsx`**

```tsx
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { PingPongTable } from '../furniture/PingPongTable'
import { PullUpBar } from '../furniture/PullUpBar'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Bookshelf } from '../furniture/Bookshelf'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function GameRoom() {
  const bounds = ROOMS.gameRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <PingPongTable position={[0, 0, -1]} />
      <PullUpBar position={[width / 2 - 0.5, 0, 1.6]} rotation={[0, Math.PI / 2, 0]} />
      <Sofa position={[-1.8, 0, 2]} />
      <CoffeeTable position={[-1.8, 0, 1.2]} />
      <Bookshelf position={[-width / 2 + 0.4, 0, -1.8]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/rooms/GameRoom.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Write the failing test for `ServerRoom`**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { ServerRoom } from './ServerRoom'

describe('ServerRoom', () => {
  it('renders a solid access wall and 4 server racks', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(60)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/rooms/ServerRoom.test.tsx`
Expected: FAIL — `Cannot find module './ServerRoom'`.

- [ ] **Step 7: Implement `src/rooms/ServerRoom.tsx`**

```tsx
import { Wall } from '../scene/Wall'
import { ServerRack } from '../furniture/ServerRack'
import { useMaterials } from '../materials/MaterialsContext'
import { cloneRepeated } from '../materials/cloneRepeated'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const RACK_X = [-1.8, -0.6, 0.6, 1.8]

function ConcreteFloorPatch({ width, depth }: { width: number; depth: number }) {
  const materials = useMaterials()
  const map = cloneRepeated(materials.floorConcreteTextures.map, width / 2, depth / 2)
  const normalMap = cloneRepeated(materials.floorConcreteTextures.normalMap, width / 2, depth / 2)
  const roughnessMap = cloneRepeated(materials.floorConcreteTextures.roughnessMap, width / 2, depth / 2)

  return (
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={map} normalMap={normalMap} roughnessMap={roughnessMap} roughness={1} metalness={0} />
    </mesh>
  )
}

export function ServerRoom() {
  const bounds = ROOMS.serverRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <ConcreteFloorPatch width={width} depth={depth} />
      <Wall
        axis="z"
        length={depth}
        center={[width / 2, 1.4, 0]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: depth / 2, width: 0.9 }}
      />
      {RACK_X.map((x) => (
        <ServerRack key={x} position={[x, 0, 0]} />
      ))}
    </group>
  )
}
```

`ConcreteFloorPatch` lays the concrete texture (downloaded in Task 2, wired into `OfficeMaterials.floorConcreteTextures` in Task 4) over `Building`'s wood floor at this room's footprint — this is the only room whose flooring departs from the shared wood floor, matching the spec's "server room reads as a distinct utility space" intent.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/rooms/ServerRoom.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 9: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; all tests from Tasks 1–22 pass.

- [ ] **Step 10: Commit**

```bash
git add src/rooms/GameRoom.tsx src/rooms/GameRoom.test.tsx src/rooms/ServerRoom.tsx src/rooms/ServerRoom.test.tsx
git commit -m "feat: assemble GameRoom and ServerRoom"
```

---

## Phase 4 — Final Composition

### Task 23: Office scene composition

**Files:**
- Create: `src/scene/Office.tsx`
- Test: `src/scene/Office.test.tsx`

**Interfaces:**
- Consumes: `OfficeMaterialsProvider` (Task 4), `IsometricCamera` (Task 5), `Lighting`/`SceneLights` (Task 6), `Building` (Task 7), `OpenSpace`/`MeetingRoom`/`FocusRoom`/`ServerRoom`/`CeoOffice`/`Kitchen`/`GameRoom` (Tasks 19–22).
- Produces: `Office({ MaterialsProvider?, LightingComponent? })` — both default to the real, asset-loading production components (`OfficeMaterialsProvider`, `Lighting`) and exist solely so tests can substitute the synchronous doubles (`StubMaterialsProvider`, `SceneLights`), avoiding real network texture/HDRI loads in the test environment (see the Global Constraints note on this pattern). Consumed by `src/App.tsx` (Task 24).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { SceneLights } from './lighting/Lighting'
import { Office } from './Office'

describe('Office', () => {
  it('mounts the full building with all 7 rooms and the camera without throwing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Office MaterialsProvider={StubMaterialsProvider} LightingComponent={SceneLights} />,
    )
    await renderer.advanceFrames(2, 16)
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(400)
    expect(renderer.scene.findAllByType('OrthographicCamera').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/Office.test.tsx`
Expected: FAIL — `Cannot find module './Office'`.

- [ ] **Step 3: Implement `src/scene/Office.tsx`**

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

export interface OfficeProps {
  MaterialsProvider?: ComponentType<{ children: ReactNode }>
  LightingComponent?: ComponentType
}

export function Office({ MaterialsProvider = OfficeMaterialsProvider, LightingComponent = Lighting }: OfficeProps) {
  return (
    <Suspense fallback={null}>
      <MaterialsProvider>
        <IsometricCamera />
        <LightingComponent />
        <Building />
        <OpenSpace />
        <MeetingRoom />
        <FocusRoom />
        <ServerRoom />
        <CeoOffice />
        <Kitchen />
        <GameRoom />
      </MaterialsProvider>
    </Suspense>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scene/Office.test.tsx`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both exit 0; every test from Tasks 1–23 passes.

- [ ] **Step 6: Commit**

```bash
git add src/scene/Office.tsx src/scene/Office.test.tsx
git commit -m "feat: compose the full Office scene from building, rooms, camera, and lighting"
```

---

### Task 24: Postprocessing, App wiring, Leva controls, README

**Files:**
- Modify: `src/App.tsx` (Task 1's placeholder — replace entirely)
- Delete: `src/App.test.tsx` (tested the placeholder; see rationale in Step 1)
- Create: `README.md`

**Interfaces:**
- Consumes: `Office` (Task 23).
- Produces: the final runnable application.

- [ ] **Step 1: Delete the placeholder test**

`src/App.test.tsx` asserted the Task 1 placeholder's single orange cube (via the non-`Canvas` `PlaceholderScene` component — see the Task 1 note on why `@react-three/test-renderer` can't render a component that itself mounts `<Canvas>`). `App` no longer has an equivalent extractable scene component to test in isolation: it renders `<Canvas>` directly wrapping `Office`, and `Office` goes through the real, network-dependent `OfficeMaterialsProvider` by default (by design — `App` is the production entry point and is not meant to accept a test double the way `Office` does). Testing it would require real texture/HDRI fetches to resolve inside the jsdom test environment, which is unreliable. `App`'s correctness is instead verified by `npx tsc --noEmit`, `npx vite build`, and manually via `npm run dev` (see Step 5). Delete the file:

```bash
rm src/App.test.tsx
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { useControls } from 'leva'
import { Office } from './scene/Office'

function ExposureControl({ exposure }: { exposure: number }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  return null
}

export function App() {
  const { exposure, aoIntensity, bloomIntensity } = useControls('Render', {
    exposure: { value: 1.1, min: 0.5, max: 2, step: 0.05 },
    aoIntensity: { value: 2, min: 0, max: 6, step: 0.1 },
    bloomIntensity: { value: 0.4, min: 0, max: 2, step: 0.05 },
  })

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}>
      <ExposureControl exposure={exposure} />
      <Office />
      <EffectComposer>
        <N8AO aoRadius={1.2} intensity={aoIntensity} />
        <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: every test from Tasks 1–24 (minus the deleted placeholder) passes, 0 failures.

- [ ] **Step 5: Verify production build**

Run: `npx vite build`
Expected: `✓ built in ...ms`, no errors. A ~1000-mesh scene with no GPU instancing produces a sizeable but unremarkable JS bundle and a normal (uninstanced) draw-call count for a scene of this complexity — acceptable for the "quality over performance" priority set for this milestone; if `npm run dev` later turns out sluggish on the reviewer's machine, the first optimization to reach for is instancing the repeated desk/chair/server-unit geometry with drei's `<Instances>`, not reworking the models themselves.

- [ ] **Step 6: Write `README.md`**

```markdown
# Startup Office — 3D Scene

A fixed-isometric, highly detailed React Three Fiber render of a modern startup
office: an open-space core surrounded by a meeting room, a focus room, a
server room, a CEO office, a kitchen, and a game room.

## Run it

\`\`\`bash
npm install
npm run dev
\`\`\`

Open the printed local URL. Drag to rotate within the clamped isometric range,
scroll to zoom. The "Render" panel (top-right) tunes exposure, ambient
occlusion intensity, and bloom intensity live.

## Verify

\`\`\`bash
npx tsc --noEmit   # type-check
npx vitest run     # component test suite
npx vite build     # production build
\`\`\`

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
```

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx README.md
git rm src/App.test.tsx
git commit -m "feat: wire up postprocessing, live-tunable exposure/AO/bloom via Leva, and project README"
```

- [ ] **Step 8: Final full verification**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: all three succeed. This is the last task in the plan — the project is now ready for a human visual pass via `npm run dev`.

---

## Deliberately trimmed from the design spec

The design spec's per-room furniture lists were intentionally generous ("what else would you add"). Everything structurally important made it into a task; a handful of small decorative props did not, to keep this plan's scope finishable. None of these require new architecture — each is a small addition to an existing room task file, following the same pattern as everything already in it:

- Open space: no laptop prop (monitor + keyboard/mouse reads as a complete desk), no per-cluster carpet-tile zoning (floor is the single shared wood slab from `Building`).
- Meeting room: no video-conference camera/speakerphone prop on the table.
- Focus room: no desk lamps, no acoustic wall panels, no headphones prop.
- Kitchen: no wall-mounted upper cabinets (only the island), no fruit bowl, no standing snack tables.
- Game room: no arcade machine or dartboard (spec offered these as an "or" accent; the ping pong table, pull-up bar, sofa, and games shelf already carry the room).
- Server room: no visible cable trays, no precision-AC unit, no raised floor, no door placard.
- Whole building: no wall outlets/switches as geometry.

If any of these turn out to matter after the visual pass, add them the same way Task 22 added `ConcreteFloorPatch` to `ServerRoom` — a small local component inside the relevant room file, not a new architectural layer.
