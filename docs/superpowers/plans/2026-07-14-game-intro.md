# Game Intro & First Dialogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scene backdrop, a three-step welcome sequence with player-name input, and the first scripted conversation with the waiting PM NPC — per `docs/superpowers/specs/2026-07-14-game-intro-design.md`.

**Architecture:** A small zustand game store holds story phase (`intro → meetPm → free`), player name and the active dialogue, persisted to localStorage. HTML overlays (intro card, bottom dialogue panel) render above the canvas; the gradient background and the PM indicator/meeting controller render inside it. NPC brains run only in phase `free`.

**Tech Stack:** React 19, @react-three/fiber v9, drei (Html), zustand v5 (curried `create<T>()()`), vitest + @react-three/test-renderer, new dev deps `@testing-library/react` + `@testing-library/dom`.

## Global Constraints

- localStorage key: `startup-office-progress`; `?intro` in the URL resets progress.
- Background gradient colors: top `#46586e`, bottom `#1d2733`.
- All game copy in Russian, exactly as written in the spec (intro steps, PM lines, button labels «Далее», «Приступить», «За работу»).
- PM persona: name «Анна Соколова», age 29, role «Product Manager».
- Meeting proximity: dialogue opens at ≤ 1.4 m between player and PM.
- No new runtime dependencies — only the two @testing-library dev deps.
- Zustand stores use the curried pattern: `create<T>()((set, get) => ...)`.
- Every task ends with the full suite green: `npx vitest run` and `npx tsc --noEmit`.

---

### Task 1: Game store with persistence

**Files:**
- Create: `src/game/gameStore.ts`
- Test: `src/game/gameStore.test.ts`

**Interfaces:**
- Produces: `useGameStore` (zustand) with `phase: 'intro'|'meetPm'|'free'`, `playerName: string`, `activeDialogue: { lines: DialogueLine[]; index: number } | null`, actions `completeIntro(name: string)`, `startDialogue(lines: DialogueLine[])`, `advanceDialogue()`. Type `DialogueLine = { speaker: string; speakerRole?: string; text: string }`. Helpers `loadProgress(storage, search)` / `saveProgress(storage, progress)` exported for tests.

- [ ] **Step 1: Write the failing tests**

```ts
// src/game/gameStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore, loadProgress, saveProgress, type DialogueLine } from './gameStore'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

const LINES: DialogueLine[] = [
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Первая' },
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Вторая' },
]

describe('loadProgress', () => {
  it('starts fresh when nothing is saved', () => {
    expect(loadProgress(fakeStorage(), '')).toEqual({ playerName: '', phase: 'intro' })
  })

  it('restores a saved phase and name', () => {
    const storage = fakeStorage({
      'startup-office-progress': JSON.stringify({ playerName: 'Иван', phase: 'free' }),
    })
    expect(loadProgress(storage, '')).toEqual({ playerName: 'Иван', phase: 'free' })
  })

  it('?intro wipes saved progress', () => {
    const storage = fakeStorage({
      'startup-office-progress': JSON.stringify({ playerName: 'Иван', phase: 'free' }),
    })
    expect(loadProgress(storage, '?intro')).toEqual({ playerName: '', phase: 'intro' })
    expect(storage.dump()).toEqual({})
  })

  it('ignores corrupted or invalid saved data', () => {
    expect(loadProgress(fakeStorage({ 'startup-office-progress': '{oops' }), '')).toEqual({
      playerName: '',
      phase: 'intro',
    })
    expect(
      loadProgress(fakeStorage({ 'startup-office-progress': JSON.stringify({ phase: 'intro' }) }), ''),
    ).toEqual({ playerName: '', phase: 'intro' })
  })

  it('works without storage (private mode)', () => {
    expect(loadProgress(null, '')).toEqual({ playerName: '', phase: 'intro' })
    expect(() => saveProgress(null, { playerName: 'x', phase: 'free' })).not.toThrow()
  })
})

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({ phase: 'intro', playerName: '', activeDialogue: null })
    window.localStorage.clear()
  })

  it('completeIntro stores the trimmed name and moves to meetPm', () => {
    useGameStore.getState().completeIntro('  Иван  ')
    expect(useGameStore.getState().playerName).toBe('Иван')
    expect(useGameStore.getState().phase).toBe('meetPm')
  })

  it('completeIntro rejects an empty name', () => {
    useGameStore.getState().completeIntro('   ')
    expect(useGameStore.getState().phase).toBe('intro')
  })

  it('advanceDialogue steps through the lines and closes at the end', () => {
    useGameStore.setState({ phase: 'meetPm' })
    useGameStore.getState().startDialogue(LINES)
    expect(useGameStore.getState().activeDialogue?.index).toBe(0)
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().activeDialogue?.index).toBe(1)
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().activeDialogue).toBeNull()
  })

  it('finishing the meetPm dialogue unlocks free play', () => {
    useGameStore.setState({ phase: 'meetPm', playerName: 'Иван' })
    useGameStore.getState().startDialogue([LINES[0]])
    useGameStore.getState().advanceDialogue()
    expect(useGameStore.getState().phase).toBe('free')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/gameStore.test.ts`
Expected: FAIL — cannot resolve `./gameStore`.

- [ ] **Step 3: Implement the store**

```ts
// src/game/gameStore.ts
import { create } from 'zustand'

export type GamePhase = 'intro' | 'meetPm' | 'free'

export interface DialogueLine {
  speaker: string
  speakerRole?: string
  text: string
}

interface ActiveDialogue {
  lines: DialogueLine[]
  index: number
}

const STORAGE_KEY = 'startup-office-progress'

interface SavedProgress {
  playerName: string
  phase: GamePhase
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
  const fresh: SavedProgress = { playerName: '', phase: 'intro' }
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
    return { playerName: parsed.playerName, phase: parsed.phase }
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
  completeIntro: (name: string) => void
  startDialogue: (lines: DialogueLine[]) => void
  advanceDialogue: () => void
}

const initial = loadProgress(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameStore = create<GameStore>()((set, get) => ({
  phase: initial.phase,
  playerName: initial.playerName,
  activeDialogue: null,
  completeIntro: (name) => {
    const playerName = name.trim()
    if (!playerName) return
    set({ playerName, phase: 'meetPm' })
    saveProgress(safeStorage(), { playerName, phase: 'meetPm' })
  },
  startDialogue: (lines) => {
    if (lines.length === 0) return
    set({ activeDialogue: { lines, index: 0 } })
  },
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
      saveProgress(safeStorage(), { playerName: get().playerName, phase: 'free' })
      return
    }
    set({ activeDialogue: null })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/gameStore.test.ts` — PASS. Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/game/gameStore.ts src/game/gameStore.test.ts
git commit -m "feat: game story store with phases and persisted progress"
```

---

### Task 2: PM persona and intro dialogue content

**Files:**
- Modify: `src/character/characters/femalePm.ts` (add `persona`)
- Create: `src/game/dialogues.ts`
- Test: `src/game/dialogues.test.ts`

**Interfaces:**
- Consumes: `DialogueLine` from `src/game/gameStore.ts`; `femalePm` definition (has optional `persona` of shape `{ name, age?, role?, traits?, backstory? }`).
- Produces: `pmIntroDialogue(playerName: string): DialogueLine[]` — exactly 5 lines; `femalePm.persona` filled.

- [ ] **Step 1: Write the failing test**

```ts
// src/game/dialogues.test.ts
import { describe, it, expect } from 'vitest'
import { pmIntroDialogue } from './dialogues'
import { femalePm } from '../character/characters/femalePm'

describe('pmIntroDialogue', () => {
  it('greets the player by name in the first line', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines[0].text).toContain('Иван')
  })

  it('has five non-empty lines spoken by the PM persona', () => {
    const lines = pmIntroDialogue('Иван')
    expect(lines.length).toBe(5)
    for (const line of lines) {
      expect(line.text.length).toBeGreaterThan(0)
      expect(line.speaker).toBe(femalePm.persona!.name)
      expect(line.speakerRole).toBe(femalePm.persona!.role)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/dialogues.test.ts` — FAIL (module not found).

- [ ] **Step 3: Fill the persona and write the dialogue**

In `src/character/characters/femalePm.ts`, add to the definition (after `displayName`):

```ts
  persona: {
    name: 'Анна Соколова',
    age: 29,
    role: 'Product Manager',
    traits: ['организованная', 'прямолинейная', 'болеет за продукт'],
  },
```

```ts
// src/game/dialogues.ts
import { femalePm } from '../character/characters/femalePm'
import type { DialogueLine } from './gameStore'

// The PM's scripted introduction - the first conversation of the game.
export function pmIntroDialogue(playerName: string): DialogueLine[] {
  const persona = femalePm.persona!
  const asPm = { speaker: persona.name, speakerRole: persona.role }
  return [
    { ...asPm, text: `${playerName}, наконец-то! Я уже боялась, что нам вообще никого не назначат.` },
    { ...asPm, text: 'Анна Соколова, продакт-менеджер. Формально — единственный оставшийся человек в отделе.' },
    {
      ...asPm,
      text: 'Скажу честно: до релиза далеко. Процессы в хаосе, бэклог разросся, а прошлый руководитель просто перестал приходить.',
    },
    { ...asPm, text: 'Я знаю продукт вдоль и поперёк — спрашивайте, помогу разобраться.' },
    { ...asPm, text: 'Но в одиночку мы не вытянем. Первым делом нам нужны люди — готовьтесь собирать команду.' },
  ]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/dialogues.test.ts` — PASS. Then the full suite + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/character/characters/femalePm.ts src/game/dialogues.ts src/game/dialogues.test.ts
git commit -m "feat: PM persona and scripted intro dialogue"
```

---

### Task 3: Scene background gradient

**Files:**
- Create: `src/scene/SceneBackground.tsx`
- Modify: `src/App.tsx` (render inside the Canvas, before `<Office />`)
- Test: `src/scene/SceneBackground.test.tsx`

**Interfaces:**
- Produces: `SceneBackground` — React component (no props) rendered inside the Canvas; sets `scene.background`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/scene/SceneBackground.test.tsx
import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneBackground } from './SceneBackground'

describe('SceneBackground', () => {
  it('sets a background on the scene (gradient texture, or solid fallback without 2D canvas)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneBackground />)
    expect(renderer.scene.instance.background).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scene/SceneBackground.test.tsx` — FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// src/scene/SceneBackground.tsx
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, Color, SRGBColorSpace } from 'three'

const TOP = '#46586e'
const BOTTOM = '#1d2733'

// Deep blue-grey studio backdrop behind the building. Implemented as a
// procedural gradient texture on scene.background (not CSS behind a
// transparent canvas) so it composes correctly with the EffectComposer stack.
export function SceneBackground() {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // test environments without a 2D canvas - solid tone fallback
      scene.background = new Color(BOTTOM)
      return () => {
        scene.background = null
      }
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, TOP)
    gradient.addColorStop(1, BOTTOM)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    scene.background = texture
    return () => {
      texture.dispose()
      scene.background = null
    }
  }, [scene])

  return null
}
```

In `src/App.tsx`: import it and render as the first child of `<Canvas>` (before `<Office />`):

```tsx
import { SceneBackground } from './scene/SceneBackground'
// ... inside <Canvas>:
<SceneBackground />
```

- [ ] **Step 4: Run tests, typecheck, build**

`npx vitest run src/scene/SceneBackground.test.tsx` — PASS; `npx tsc --noEmit`; `npx vite build`.

- [ ] **Step 5: Commit**

```bash
git add src/scene/SceneBackground.tsx src/scene/SceneBackground.test.tsx src/App.tsx
git commit -m "feat: blue-grey gradient scene backdrop"
```

---

### Task 4: Intro overlay

**Files:**
- Create: `src/ui/ui.css`, `src/ui/IntroOverlay.tsx`
- Modify: `package.json` (dev deps), `src/App.tsx` (render overlay above the canvas)
- Test: `src/ui/IntroOverlay.test.tsx`

**Interfaces:**
- Consumes: `useGameStore` (`phase`, `completeIntro`).
- Produces: `IntroOverlay` — no-props component; visible only in phase `intro`.

- [ ] **Step 1: Install the testing library**

```bash
npm install -D @testing-library/react @testing-library/dom
```

- [ ] **Step 2: Write the failing tests**

```tsx
// src/ui/IntroOverlay.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { IntroOverlay } from './IntroOverlay'
import { useGameStore } from '../game/gameStore'

afterEach(cleanup)
beforeEach(() => {
  useGameStore.setState({ phase: 'intro', playerName: '', activeDialogue: null })
})

describe('IntroOverlay', () => {
  it('walks through both story steps to the name step', () => {
    render(<IntroOverlay />)
    expect(screen.getByText(/Совет директоров собрал вас/)).toBeTruthy()
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText(/Теперь отдел — ваша ответственность/)).toBeTruthy()
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText('Как к вам обращаться?')).toBeTruthy()
  })

  it('rejects an empty name and stays in the intro', () => {
    render(<IntroOverlay />)
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Приступить'))
    expect(useGameStore.getState().phase).toBe('intro')
  })

  it('accepts a name (Enter works) and moves the game to meetPm', () => {
    render(<IntroOverlay />)
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.click(screen.getByText('Далее'))
    fireEvent.change(screen.getByPlaceholderText('Ваше имя'), { target: { value: 'Иван' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Ваше имя'), { key: 'Enter' })
    expect(useGameStore.getState().phase).toBe('meetPm')
    expect(useGameStore.getState().playerName).toBe('Иван')
  })

  it('renders nothing outside the intro phase', () => {
    useGameStore.setState({ phase: 'free' })
    const { container } = render(<IntroOverlay />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/ui/IntroOverlay.test.tsx` — FAIL (module not found).

- [ ] **Step 4: Implement styles and the overlay**

```css
/* src/ui/ui.css — game UI layer (intro, dialogue, indicator) */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 15, 22, 0.55);
  backdrop-filter: blur(6px);
  z-index: 100;
}

.intro-card {
  width: min(520px, calc(100vw - 48px));
  background: linear-gradient(160deg, #232f3e, #1a2430);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 32px 36px 24px;
  color: #e8edf4;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  animation: card-in 0.35s ease-out;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.intro-card h2 {
  margin: 0 0 12px;
  font: 600 22px/1.3 system-ui, sans-serif;
}

.intro-card p {
  margin: 0 0 20px;
  font: 400 15px/1.65 system-ui, sans-serif;
  color: #b9c4d1;
}

.intro-card input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16px;
  padding: 12px 14px;
  font: 400 15px system-ui, sans-serif;
  color: #e8edf4;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  outline: none;
}

.intro-card input:focus {
  border-color: #4f8ff0;
}

button.primary {
  padding: 11px 22px;
  font: 600 14px system-ui, sans-serif;
  color: #fff;
  background: #3573dd;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

button.primary:hover {
  background: #4f8ff0;
}

.intro-card .hint {
  margin-top: 16px;
  font-size: 13px;
  color: #7f8ea0;
}

.dots {
  display: flex;
  gap: 8px;
  margin-top: 22px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.dot.active {
  background: #4f8ff0;
}

.shake {
  animation: shake 0.35s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.dialogue-panel {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  width: min(680px, calc(100vw - 48px));
  background: linear-gradient(160deg, #232f3e, #1a2430);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 18px 22px;
  color: #e8edf4;
  box-shadow: 0 16px 60px rgba(0, 0, 0, 0.45);
  z-index: 90;
  animation: card-in 0.25s ease-out;
}

.dialogue-speaker {
  font: 600 14px system-ui, sans-serif;
  color: #4f8ff0;
  margin-bottom: 6px;
}

.dialogue-role {
  color: #7f8ea0;
  font-weight: 400;
}

.dialogue-text {
  margin: 0 0 14px;
  font: 400 15px/1.6 system-ui, sans-serif;
}

.npc-indicator {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #3573dd;
  color: #fff;
  font-size: 19px;
  line-height: 40px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  animation: indicator-pulse 1.6s ease-in-out infinite;
}

@keyframes indicator-pulse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.08); }
}
```

```tsx
// src/ui/IntroOverlay.tsx
import { useState } from 'react'
import { useGameStore } from '../game/gameStore'
import './ui.css'

const STORY_STEPS = [
  {
    title: 'Совет директоров',
    text: 'Совет директоров собрал вас не для поздравлений. Прежний руководитель отдела разработки не справился: сроки сорваны, продукт застрял в бесконечной доработке, команда разбежалась.',
  },
  {
    title: 'Ваша задача',
    text: 'Теперь отдел — ваша ответственность. Наладьте процессы, соберите сильную команду и доведите продукт до релиза. Учитывать придётся всё: разработку, качество, людей и сроки. Результат спросим с вас лично.',
  },
] as const

// The welcome sequence: two story cards from upper management, then the
// player-name step. Visible only in phase 'intro'.
export function IntroOverlay() {
  const phase = useGameStore((s) => s.phase)
  const completeIntro = useGameStore((s) => s.completeIntro)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [invalid, setInvalid] = useState(false)

  if (phase !== 'intro') return null

  const isNameStep = step === STORY_STEPS.length
  const submitName = () => {
    if (!name.trim()) {
      setInvalid(true)
      return
    }
    completeIntro(name)
  }

  return (
    <div className="overlay-backdrop">
      <div className={invalid ? 'intro-card shake' : 'intro-card'} onAnimationEnd={() => setInvalid(false)}>
        {isNameStep ? (
          <>
            <h2>Как к вам обращаться?</h2>
            <input
              autoFocus
              value={name}
              placeholder="Ваше имя"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitName()}
            />
            <button className="primary" onClick={submitName}>
              Приступить
            </button>
            <p className="hint">Найдите продакт-менеджера — она введёт вас в курс дела.</p>
          </>
        ) : (
          <>
            <h2>{STORY_STEPS[step].title}</h2>
            <p>{STORY_STEPS[step].text}</p>
            <button className="primary" onClick={() => setStep(step + 1)}>
              Далее
            </button>
          </>
        )}
        <div className="dots">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i === step ? 'dot active' : 'dot'} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

In `src/App.tsx`: wrap the existing content so the overlay sits above the canvas:

```tsx
import { IntroOverlay } from './ui/IntroOverlay'
// The App component returns:
// <>
//   <Canvas ...>...</Canvas>
//   <IntroOverlay />
// </>
```

- [ ] **Step 5: Run tests, typecheck**

`npx vitest run src/ui/IntroOverlay.test.tsx` — PASS; full suite; `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/ui.css src/ui/IntroOverlay.tsx src/ui/IntroOverlay.test.tsx src/App.tsx
git commit -m "feat: welcome intro overlay with player name input"
```

---

### Task 5: Dialogue panel

**Files:**
- Create: `src/ui/DialoguePanel.tsx`
- Modify: `src/App.tsx` (render next to IntroOverlay)
- Test: `src/ui/DialoguePanel.test.tsx`

**Interfaces:**
- Consumes: `useGameStore` (`activeDialogue`, `advanceDialogue`).
- Produces: `DialoguePanel` — no-props component; visible while a dialogue is active.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/ui/DialoguePanel.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DialoguePanel } from './DialoguePanel'
import { useGameStore, type DialogueLine } from '../game/gameStore'

afterEach(cleanup)

const LINES: DialogueLine[] = [
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Первая реплика' },
  { speaker: 'Анна Соколова', speakerRole: 'Product Manager', text: 'Последняя реплика' },
]

beforeEach(() => {
  useGameStore.setState({ phase: 'meetPm', playerName: 'Иван', activeDialogue: { lines: LINES, index: 0 } })
})

describe('DialoguePanel', () => {
  it('shows the speaker, role and current line', () => {
    render(<DialoguePanel />)
    expect(screen.getByText('Анна Соколова')).toBeTruthy()
    expect(screen.getByText(/Product Manager/)).toBeTruthy()
    expect(screen.getByText('Первая реплика')).toBeTruthy()
  })

  it('advances lines; the last line closes the dialogue via «За работу»', () => {
    render(<DialoguePanel />)
    fireEvent.click(screen.getByText('Далее'))
    expect(screen.getByText('Последняя реплика')).toBeTruthy()
    fireEvent.click(screen.getByText('За работу'))
    expect(useGameStore.getState().activeDialogue).toBeNull()
    expect(useGameStore.getState().phase).toBe('free')
  })

  it('renders nothing without an active dialogue', () => {
    useGameStore.setState({ activeDialogue: null })
    const { container } = render(<DialoguePanel />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/DialoguePanel.test.tsx` — FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// src/ui/DialoguePanel.tsx
import { useGameStore } from '../game/gameStore'
import './ui.css'

// Bottom dialogue panel: one line at a time with the speaker's name and
// role. Later AI-driven dialogues reuse this panel (a reply input slots in).
export function DialoguePanel() {
  const dialogue = useGameStore((s) => s.activeDialogue)
  const advance = useGameStore((s) => s.advanceDialogue)
  if (!dialogue) return null

  const line = dialogue.lines[dialogue.index]
  const isLast = dialogue.index === dialogue.lines.length - 1

  return (
    <div className="dialogue-panel">
      <div className="dialogue-speaker">
        {line.speaker}
        {line.speakerRole ? <span className="dialogue-role"> · {line.speakerRole}</span> : null}
      </div>
      <p className="dialogue-text">{line.text}</p>
      <button className="primary" onClick={advance}>
        {isLast ? 'За работу' : 'Далее'}
      </button>
    </div>
  )
}
```

In `src/App.tsx`: render `<DialoguePanel />` next to `<IntroOverlay />`.

- [ ] **Step 4: Run tests, typecheck**

`npx vitest run src/ui/DialoguePanel.test.tsx` — PASS; full suite; `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/DialoguePanel.tsx src/ui/DialoguePanel.test.tsx src/App.tsx
git commit -m "feat: bottom dialogue panel"
```

---

### Task 6: NPC brains run only in free play

**Files:**
- Modify: `src/character/Npcs.tsx` (gate `useNpcBrain` on the game phase)

**Interfaces:**
- Consumes: `useGameStore` (`phase`).
- Produces: NPC decision timers run only when `phase === 'free'`.

- [ ] **Step 1: Gate the brain**

In `src/character/Npcs.tsx`, import the game store and add the phase to the
brain hook:

```tsx
import { useGameStore } from '../game/gameStore'

function useNpcBrain(id: string, planActivity: ActivityPlanner = planNextActivity) {
  const stateKind = useCharacterStore((s) => s.characters[id]?.state.kind)
  const gamePhase = useGameStore((s) => s.phase)
  // ... rngRef unchanged ...

  useEffect(() => {
    // story gating: NPCs live their office life only once the game reaches
    // free play (after the player has met the PM)
    if (gamePhase !== 'free') return
    if (!stateKind || !SETTLED_STATES.has(stateKind)) return
    // ... rest of the effect body unchanged ...
  }, [stateKind, id, planActivity, gamePhase])
}
```

There is no direct unit test for the hook (it needs GLTF rendering); the
phase transitions themselves are covered by the Task 1 store tests, and the
waiting PM is verified visually in Task 8.

- [ ] **Step 2: Full suite and typecheck**

`npx vitest run` — all green; `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/character/Npcs.tsx
git commit -m "feat: NPC brains start only in free play"
```

---

### Task 7: PM meeting controller (indicator, approach, dialogue open)

**Files:**
- Create: `src/game/meetingGeometry.ts`, `src/game/MeetPmController.tsx`
- Modify: `src/scene/Office.tsx` (injectable `StoryComponent`, default `MeetPmController`), `src/scene/Office.test.tsx` (stub the new prop)
- Test: `src/game/meetingGeometry.test.ts`

**Interfaces:**
- Consumes: `femalePm` (spawn/rotation/persona/id), `useCharacterStore` (`characters`, `clickFloor`, `setTransform`, `PLAYER_ID`), `useGameStore` (`phase`, `playerName`, `startDialogue`), `pmIntroDialogue`.
- Produces: `approachPoint(pmSpawn: Point, pmRotationY: number, distance?: number): Point`, `isWithinMeetDistance(a: Point, b: Point): boolean` (1.4 m), `facingBetween(from: Point, to: Point): number`; `MeetPmController` component (renders inside the Canvas).

- [ ] **Step 1: Write the failing geometry tests**

```ts
// src/game/meetingGeometry.test.ts
import { describe, it, expect } from 'vitest'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'

describe('meetingGeometry', () => {
  it('approachPoint lies one meter in front of the PM along her facing', () => {
    // facing PI means forward is -z
    const point = approachPoint([-2, 0, 6.3], Math.PI)
    expect(point[0]).toBeCloseTo(-2)
    expect(point[2]).toBeCloseTo(5.3)
  })

  it('isWithinMeetDistance uses the 1.4m threshold on the ground plane', () => {
    expect(isWithinMeetDistance([0, 0, 0], [1, 0, 0.9])).toBe(true)
    expect(isWithinMeetDistance([0, 0, 0], [1.4, 0, 0.9])).toBe(false)
  })

  it('facingBetween points from one character to the other', () => {
    expect(facingBetween([0, 0, 0], [0, 0, 5])).toBeCloseTo(0) // +z
    expect(Math.abs(facingBetween([0, 0, 5], [0, 0, 0]))).toBeCloseTo(Math.PI) // -z
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/meetingGeometry.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement the geometry helpers**

```ts
// src/game/meetingGeometry.ts
import type { Point } from '../character/navigation'

export const MEET_DISTANCE = 1.4

// A spot one step in front of the PM (along her facing) for the player to
// walk to. rotationY 0 faces +z, matching the character convention.
export function approachPoint(pmSpawn: Point, pmRotationY: number, distance = 1.0): Point {
  return [pmSpawn[0] + Math.sin(pmRotationY) * distance, 0, pmSpawn[2] + Math.cos(pmRotationY) * distance]
}

export function isWithinMeetDistance(a: Point, b: Point): boolean {
  return Math.hypot(a[0] - b[0], a[2] - b[2]) < MEET_DISTANCE
}

export function facingBetween(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}
```

- [ ] **Step 4: Run geometry tests to verify they pass**

Run: `npx vitest run src/game/meetingGeometry.test.ts` — PASS.

- [ ] **Step 5: Implement the controller**

```tsx
// src/game/MeetPmController.tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useGameStore } from './gameStore'
import { pmIntroDialogue } from './dialogues'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'
import { femalePm } from '../character/characters/femalePm'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import '../ui/ui.css'

// Story glue for phase 'meetPm': the PM waits at her spawn with a pulsing
// indicator; clicking her (or it) walks the player over, and coming within
// meeting distance opens her introduction dialogue. Once the dialogue ends
// the phase flips to 'free' and this controller unmounts.
export function MeetPmController() {
  const phase = useGameStore((s) => s.phase)
  if (phase !== 'meetPm') return null
  return <PmMeeting />
}

function PmMeeting() {
  const opened = useRef(false)
  const spawn = femalePm.npc!.spawn
  const rotationY = femalePm.npc!.spawnRotationY ?? 0

  const walkToPm = () => {
    useCharacterStore.getState().clickFloor(approachPoint(spawn, rotationY))
  }

  useFrame(() => {
    if (opened.current) return
    const characters = useCharacterStore.getState().characters
    const player = characters[PLAYER_ID]
    const pm = characters[femalePm.id]
    if (!player || !pm) return
    if (!isWithinMeetDistance(player.position, pm.position)) return
    opened.current = true
    // she turns to greet the new boss
    useCharacterStore.getState().setTransform(femalePm.id, pm.position, facingBetween(pm.position, player.position))
    const { playerName, startDialogue } = useGameStore.getState()
    startDialogue(pmIntroDialogue(playerName))
  })

  return (
    <group position={[spawn[0], 0, spawn[2]]}>
      <Html position={[0, 2.2, 0]} center zIndexRange={[10, 0]}>
        <button className="npc-indicator" aria-label="Поговорить" onClick={walkToPm}>
          💬
        </button>
      </Html>
      <mesh position={[0, 0.9, 0]} onClick={walkToPm}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
```

In `src/scene/Office.tsx`: add the injectable story slot —

```tsx
import { MeetPmController } from '../game/MeetPmController'
// props:  StoryComponent?: ComponentType
// destructure with default: StoryComponent = MeetPmController
// render <StoryComponent /> after <NpcsComponent />
```

In `src/scene/Office.test.tsx`: add `StoryComponent={() => null}` to the
existing `<Office ... />` render (drei `Html` does not render under the test
renderer, so the story controller must be stubbed like the character).

- [ ] **Step 6: Full suite and typecheck**

`npx vitest run` — all green; `npx tsc --noEmit`; `npx vite build`.

- [ ] **Step 7: Commit**

```bash
git add src/game/meetingGeometry.ts src/game/meetingGeometry.test.ts src/game/MeetPmController.tsx src/scene/Office.tsx src/scene/Office.test.tsx
git commit -m "feat: PM meeting - indicator, approach and first dialogue"
```

---

### Task 8: Visual verification and docs

**Files:**
- Modify: `README.md` (describe the intro and `?intro` reset)
- No production code changes expected; fix anything the verification finds.

- [ ] **Step 1: Full checks**

`npx vitest run` (all green), `npx tsc --noEmit`, `npx vite build`.

- [ ] **Step 2: Verify the DOM overlays against the production app**

The intro overlay and dialogue panel are DOM — they render even where the
canvas is blank in headless Chromium. With the dev server running
(`npm run dev`), use Playwright (installed on demand,
`npx playwright install chromium`) to: load `http://127.0.0.1:5173/?intro`,
screenshot the three intro steps, type a name, submit, and confirm
`localStorage['startup-office-progress']` now holds `phase: "meetPm"`.

- [ ] **Step 3: Verify the 3D pieces via the debug-app swap**

Headless production rendering is blank (EffectComposer limitation, see
README), so temporarily point `src/main.tsx` at a debug app without
postprocessing (the same pattern used throughout this project: a
`src/_debug/DebugApp.tsx` that renders `<Canvas>` + `<SceneBackground />` +
`<Office />` + the two overlays and exposes `window.__characterStore` /
`window.__r3f`). Verify with Playwright screenshots:

1. Gradient background visible around the building (no white void).
2. Phase `meetPm`: PM standing at spawn with the pulsing 💬 indicator; she
   stays put (no office life).
3. Click the PM → the player walks over → the dialogue panel opens, PM turns
   to face him; step through all five lines; after «За работу» the indicator
   disappears and the PM starts her office life.
4. Reload without `?intro` → no intro, game restores to the saved phase.

Then restore `src/main.tsx` to the production `App` and delete `src/_debug`.

- [ ] **Step 4: Update README**

Add to the character/NPC section: the game opens with a board briefing and a
player-name prompt (saved to localStorage; add `?intro` to the URL to replay
it), and the PM waits with an indicator for the first conversation before
starting her office life.

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: game intro flow and progress reset"
```
