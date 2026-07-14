# Game Intro & First Dialogue — Design

Turns the office scene into the opening of the game: a scene backdrop instead
of the white void, a welcome sequence that sets up the story (the player is
the newly appointed department head who must ship the product), and the first
scripted conversation with the product manager NPC.

## Story premise

Upper management (the board) informs the player: the previous department head
failed — deadlines slipped, the product is stuck, the team fell apart. The
player now personally answers for the department: fix the processes, build a
strong team, ship the product to release. Initially the department has exactly
one employee — the product manager (the existing `femalePm` NPC). She
introduces herself in the first conversation and hints that hiring comes next.

## Decisions (from brainstorm)

- Player enters a name during the intro; it is used in dialogue and saved.
- The intro shows once; progress persists in `localStorage`. `?intro` in the
  URL resets progress for replay.
- NPC dialogue uses a bottom dialogue panel (extensible later for DeepSeek
  dialogues and a reply input).
- Before the first conversation the PM waits in place with an indicator over
  her head; her autonomous office life starts only afterwards.
- Background: deep blue-grey vertical gradient (studio-render look).
- Approach A: HTML overlay above the canvas + a small game store; the scene
  background is set inside the canvas (procedural gradient texture).

## Architecture

New top-level pieces, kept separate from the character simulation:

```
src/game/gameStore.ts     — story state (zustand)
src/game/dialogues.ts     — scripted dialogue content
src/ui/IntroOverlay.tsx   — welcome sequence (HTML overlay)
src/ui/DialoguePanel.tsx  — bottom dialogue panel (HTML overlay)
src/ui/ui.css             — overlay styling
src/scene/SceneBackground.tsx — gradient background inside the canvas
```

### Game store (`src/game/gameStore.ts`)

Zustand store, separate from `characterStore` (story progression vs body
simulation):

- `phase: 'intro' | 'meetPm' | 'free'`
- `playerName: string`
- `activeDialogue: { lines: DialogueLine[]; index: number } | null`
- Actions: `completeIntro(name)` (→ `meetPm`), `startDialogue(lines)`,
  `advanceDialogue()` (last line closes the dialogue; when it was the PM
  intro dialogue → `completePmIntro()` → `free`).
- Persistence: `{ playerName, phase }` under localStorage key
  `startup-office-progress`. On load, saved phase is restored (an unfinished
  PM meeting restores to `meetPm`). `?intro` in the URL clears saved progress
  before the store initializes.

Phase gating of NPC behavior: `useNpcBrain` runs only in phase `free`. This
also gives future hires a natural "not active until the story says so" rule.

### Scene background (`src/scene/SceneBackground.tsx`)

A component inside the canvas that builds a small offscreen-canvas vertical
gradient (top `#46586e` → bottom `#1d2733`), wraps it in a `CanvasTexture`
and assigns it to `scene.background`. Chosen over CSS-behind-transparent-
canvas because it is guaranteed to compose correctly with the EffectComposer
stack.

### Intro overlay (`src/ui/IntroOverlay.tsx`)

Rendered (outside the canvas, above it) while `phase === 'intro'`: darkened
blurred backdrop, centered card in the scene's palette (dark graphite, blue
accent), progress dots, CSS fade/slide between steps.

Step copy (Russian, final):

1. Совет директоров: «Совет директоров собрал вас не для поздравлений.
   Прежний руководитель отдела разработки не справился: сроки сорваны,
   продукт застрял в бесконечной доработке, команда разбежалась.»
2. Задача: «Теперь отдел — ваша ответственность. Наладьте процессы, соберите
   сильную команду и доведите продукт до релиза. Учитывать придётся всё:
   разработку, качество, людей и сроки. Результат спросим с вас лично.»
3. Ввод имени: заголовок «Как к вам обращаться?», текстовое поле, кнопка
   «Приступить» (Enter подтверждает; пустое/пробельное имя не пропускается).
   Подсказка под полем: «Найдите продакт-менеджера — она введёт вас в курс
   дела.»

Completing step 3 calls `completeIntro(name)`.

### PM waiting state and indicator

- `femalePm` definition gets its persona filled: name «Анна Соколова», age
  29, role «Product Manager», traits (организованная, прямолинейная,
  болеет за продукт). This is the first real use of the `Persona` shape the
  future YAML files will populate.
- In phase `meetPm` the PM stands at her spawn point facing the player spawn
  (brain gated off). Above her head — a pulsing «💬» indicator: a drei
  `<Html>` element inside the canvas, positioned ~2.1m above her entity
  position (follows it via `useFrame`), visible only in phase `meetPm`.
- Clicking the PM's body or the indicator starts the approach: the player is
  sent (existing pathfinding) to a point in front of her; a proximity hook
  opens the dialogue when the player is within 1.4m. When the dialogue opens
  the PM turns to face the player (`setTransform` rotation toward him).
- The clickable body: `CharacterModel` gets an optional `onClick` prop — an
  invisible capsule around the character, active for the PM only in phase
  `meetPm`.

### Dialogue panel (`src/ui/DialoguePanel.tsx`) and content

Bottom-centered panel while `activeDialogue` is set: speaker label
(«Анна Соколова · Product Manager»), line text, button «Далее» (last line:
«За работу»). `src/game/dialogues.ts` exports
`pmIntroDialogue(playerName): DialogueLine[]` (speaker + text), built from
the PM persona. The five lines (final copy):

1. Приветствие по имени: «{name}, наконец-то! Я уже боялась, что нам вообще
   никого не назначат.»
2. Представление: «Анна Соколова, продакт-менеджер. Формально — единственный
   оставшийся человек в отделе.»
3. Статус: «Скажу честно: до релиза далеко. Процессы в хаосе, бэклог
   разросся, а прошлый руководитель просто перестал приходить.»
4. Поддержка: «Я знаю продукт вдоль и поперёк — спрашивайте, помогу
   разобраться.»
5. Намёк вперёд: «Но в одиночку мы не вытянем. Первым делом нам нужны люди —
   готовьтесь собирать команду.» (кнопка «За работу»)

Closing the last line → phase `free`: indicator disappears, PM starts her
normal office life.

Repeat conversations are out of scope for this iteration — after the intro
the PM lives her life; repeatable (AI-driven) dialogues arrive later and will
reuse this panel (a reply input slots into it).

## Error handling

- localStorage unavailable (private mode): store works in-memory; intro just
  shows every launch.
- Corrupted saved JSON: ignored, fresh start.
- Name input: trimmed; empty rejected with a gentle shake/hint, no alert.

## Testing

- `gameStore` unit tests: phase transitions, dialogue advance/close,
  persistence round-trip, corrupted JSON, `?intro` reset.
- `dialogues` unit tests: name interpolation, non-empty lines, speaker set.
- DOM component tests with `@testing-library/react` (new dev dependency):
  intro step navigation, name validation, dialogue panel advance/finish.
- Existing character/NPC tests unaffected; `useNpcBrain` gating covered by a
  store-driven test (brain idle outside `free`).
- Visual verification via Playwright: gradient background, intro cards,
  indicator over the PM, dialogue panel, PM life starting after the talk.
