# Server Security Mini-Games — Design

Makes the server racks in the server room a live game mechanic. Racks can
"break" (start blinking red, outlined in white). The player walks to a broken
rack and is dropped into one of three security-themed mini-games to fix it.
Each mini-game is an interactive, educational scenario — not a quiz — that
teaches a real server-security topic through play: a firewall config puzzle,
a log-forensics hunt, and a two-phase SQL-injection attack-then-patch.

## Decisions (from brainstorm)

- **Trigger for now is manual.** A dev-only hook `window.__breakServer(role?)`
  breaks a rack (a specific role, or a random healthy one). Real periodic
  triggers (time-based, story-based) are future work and need no engine change
  — only a call into the new store from wherever the condition is detected.
- **Each rack is permanently bound to a role and its mini-game.** The four
  racks (left→right, seeds 0–3) are `gateway` (Firewall), `auth` (Logs),
  `database` (SQL-injection), and `backup` (does not break yet — reserved slot
  for a future fourth game). A rack's role never changes, so "the database
  server" is always the SQL rack. A small role plate is mounted on each rack.
- **Repair flow reuses the character state machine (brainstorm Approach A).**
  Clicking a broken rack walks the player to a point in front of it (exactly
  like clicking a workstation), and the mini-game overlay opens only once the
  player has arrived. This keeps seat-claim / input-lock / state-exit behavior
  consistent with sitting and coffee, and lets NPCs "repair" later for free.
- **No penalties yet, but the data to drive them is recorded from day one.**
  A broken rack just blinks until fixed; failing a mini-game just lets you
  retry. Every incident records when it broke, when it was fixed, and how many
  attempts failed — so a future "consequences" module (reprimands for long
  downtime or repeated failures affecting the game's outcome) can subscribe to
  this history without touching the mechanic. See Extension Points.
- **Mini-games are hand-authored scenario pools.** Each game has a small pool
  of distinct, hand-written scenarios (not procedurally generated) chosen at
  random per break, so replays stay fresh while the teaching content stays
  deliberate.
- **Per `AGENTS.md` ("NO TESTS") and the cutscene-system precedent**, this
  feature is verified by running the app and driving it (dev server / headless
  browser), not by adding automated tests. Pure game-logic modules are kept
  separate from React so they *remain* unit-testable, matching the existing
  `serverRackLights.ts` split, but no new test files are added.

## Architecture

### New store: `src/game/serverIncidentsStore.ts` (zustand, in-memory)

The single source of truth for rack health and the mini-game overlay.

```
type ServerRole = 'gateway' | 'auth' | 'database' | 'backup'
type RackStatus = 'ok' | 'broken' | 'repairing'
type MinigameKind = 'firewall' | 'logs' | 'sqli'

interface RackState {
  role: ServerRole
  status: RackStatus
  brokenAt: number | null      // performance.now() when it broke
  failures: number             // failed attempts on the current incident
}

interface IncidentRecord {
  role: ServerRole
  brokenAt: number
  fixedAt: number
  failures: number
}

interface ServerIncidentsStore {
  racks: Record<ServerRole, RackState>
  // Which rack's mini-game overlay is currently open (null = none). Set only
  // once the player has physically arrived at the rack.
  activeMinigame: { role: ServerRole; kind: MinigameKind } | null
  history: IncidentRecord[]

  breakServer: (role?: ServerRole) => void   // no arg → random healthy, non-backup rack
  beginRepair: (role: ServerRole) => void     // player arrived → open overlay
  failAttempt: (role: ServerRole) => void     // mini-game lost → failures++
  completeRepair: (role: ServerRole) => void  // mini-game won → ok + push history
  closeMinigame: () => void                    // exit without fixing → overlay closes, rack stays broken
}
```

- `ROLE_BY_SEED: [gateway, auth, database, backup]` — index = rack seed, so
  `ServerRoom` maps seeds to roles deterministically.
- `MINIGAME_BY_ROLE: { gateway: 'firewall', auth: 'logs', database: 'sqli' }`
  — `backup` has none (cannot break yet).
- Time is read via an injectable `now()` (default `performance.now()`) so the
  module has no hidden global and stays testable, matching the codebase's
  pure-logic style. (`Date.now()`/`performance.now()` are only called from
  store actions, never at module top level.)

### Dev trigger (in `App.tsx`, dev builds only)

Alongside the existing `window.__startCutscene`:
```
window.__breakServer = (role?) => useServerIncidentsStore.getState().breakServer(role)
```

### Character state machine changes (`src/character/characterMachine.ts`)

Minimal, mirroring the existing seat/workstation handling:
- New event `CLICK_SERVER` with a `Target` (point in front of the rack +
  facing), carrying the `role`.
- New arrival goal `repair` and new state `{ kind: 'repairing'; target; role }`.
- On arrival at a `repair` goal → state `repairing`; an effect in the model
  layer calls `beginRepair(role)` to open the overlay.
- The player stands (does not sit) at the rack, so `repairing` is **not** added
  to the seated set — it needs no special exit-facing handling and leaves like
  any standing state. `CLICK_FLOOR` while `repairing` walks the player away and
  triggers `closeMinigame()` (see wiring).
- Animation: `repairing` maps to clip `look` (falls back to `idle` for the
  business_man who has no `look` clip — existing `resolveClip` chain).

### Character store changes (`src/character/characterStore.ts`)

- New action `clickServer(target, role)` following the `playerClick` pattern
  (respects `inputLocked`, claims the target via the interaction registry so
  two bodies can't target one rack, dispatches `CLICK_SERVER`).

### Wiring the overlay open/close to arrival (model layer)

`CharacterModel` already runs state-driven effects (sit settle, brew timer),
and it renders every body (player + NPCs), so the new effect is **guarded to
`characterId === PLAYER_ID`**. When the player enters `repairing`, call
`beginRepair(role)` once (the natural analogue of the existing
`SETTLE_ELAPSED`/`BREW_ELAPSED` effects). When the player leaves `repairing`
(walks away / finishes), call `closeMinigame()` if the overlay is still open
for that rack. NPCs entering `repairing` (future work) open no overlay.

### ServerRack changes (`src/furniture/ServerRack.tsx`)

- Reads its `role` + `status` from `useServerIncidentsStore`.
- **Broken visuals:** when `status !== 'ok'`, every LED uses the red material
  and an "alarm" blink waveform (new pure function in `serverRackLights.ts`);
  a persistent white outline is attached via the existing
  `attachHoverOutline(group.current)` (mounted while broken, removed on fix).
- **Clickable only while broken:** an `InteractionTrigger` (kind `server`) is
  rendered only when `status === 'broken'`, wired to `clickServer`. While `ok`
  the rack is inert (as today).
- **Role plate:** a small labeled plate mesh on the rack front showing the
  role (`ШЛЮЗ`/`AUTH`/`БД`/`РЕЗЕРВ`).

### serverRackLights.ts additions (pure)

- `alarmIntensityAt(unit, timeSeconds)` — synchronized urgent red flash for a
  broken rack (all units blink together, unlike the per-unit phased normal
  mix), reusing `BASE_INTENSITY`/`DIM`.
- Broken racks force status `error` (red material) for every unit regardless
  of the normal deterministic mix.

### Interaction registry (`src/interaction/interactionRegistry.ts`)

- Add `'server'` to `InteractionKind`.

## Mini-game overlay & the three games

### Shared overlay shell (`src/game/minigames/MinigameOverlay.tsx`)

A full-screen backdrop that swallows scene clicks (same pattern as the intro
overlay), rendered near `DialoguePanel` in `App.tsx`, shown when
`activeMinigame !== null`. Chrome:
- Header: rack role + game title.
- Brief: 1–2 lines describing the incident.
- Body: the active game component (`firewall` | `logs` | `sqli`).
- Result screen: verdict (win/lose) + 2–3 plain-language **takeaways** (the
  security lesson), plus buttons: **Готово** (win → `completeRepair`, close) /
  **Ещё раз** (retry a fresh scenario) / **Выйти** (`closeMinigame`, rack
  stays broken).
- On a losing result, `failAttempt(role)` is recorded before showing takeaways.

Each game exposes the same tiny contract so the shell stays generic:
```
interface MinigameModule<Scenario> {
  pickScenario: (rng) => Scenario         // random from the hand-written pool
  title: string
  brief: (s: Scenario) => string
  Component: React.FC<{ scenario; onWin(); onLose() }>
  takeaways: (s: Scenario, won: boolean) => string[]
}
```
Pure scenario data + win/lose evaluation live in a sibling `*.ts` file per
game (e.g. `firewall.ts`), the React piece in `*.tsx` — same split as
`serverRackLights`.

### ① Firewall — rack `gateway`

- **Screen:** ~8 server ports (22/SSH, 80/HTTP, 443/HTTPS, 3306/MySQL,
  21/FTP, …), each toggled open/closed by the player. A queue of request
  cards is shown (e.g. "HTTPS from customer", "port scan from unknown IP",
  "SSH from unknown IP", "FTP transfer").
- **Play:** player sets the open/closed config, hits "Запустить трафик";
  cards evaluate against the config. Legit request to a closed port → `uptime`
  drops. Attack to an open port → `breach` rises. **Win:** `breach === 0` and
  `uptime ≥ threshold`.
- **Lesson:** default-deny, open only what's needed; never expose 3306 to the
  internet; drop legacy/insecure FTP.
- **Pool:** 3 scenarios with different "needed" port sets and attack mixes.

### ② Logs — rack `auth`

- **Screen:** a scrollable monospaced auth log (~20–30 lines: time, IP, user,
  event) with attack evidence hidden among noise (a burst of `Failed
  password` from one IP, a success right *after* the burst, `sudo` by a web
  user, a 03:47 login).
- **Play:** player clicks to flag suspicious lines, then selects the
  attacker's IP and hits "Забанить". **Win:** the key evidence lines are
  flagged AND the correct IP is banned. Wrong IP / missed evidence → the
  result screen explains exactly what was missed.
- **Lesson:** what brute-force looks like in logs; why "success immediately
  after 200 failures" is the tell.
- **Pool:** 3 incidents (brute-force, session theft, insider with borrowed
  privileges) with different evidence.

### ③ SQL-injection — rack `database` (two phases)

- **Phase Attack:** the product's own login form. The player assembles
  `' OR '1'='1' --` from a set of offered tokens and submits; an animation
  shows the query `SELECT * FROM users WHERE login='' OR '1'='1' --'` bypass
  auth and "leak" the users table. The player *sees* the hole.
- **Phase Fix:** the same query, rebuilt safely — the player moves the user
  input out of the query body into a **parameter** (`... WHERE login = ?`,
  input bound separately). Re-running the same attack string is now treated as
  literal text and rejected. **Win:** parameterized form rejects the attack.
- **Lesson:** why string concatenation is dangerous; parameterization fixes it
  at the root.
- **Pool:** 2 forms (login / product search).

## File layout

```
src/game/serverIncidentsStore.ts          # rack health + overlay + history
src/game/minigames/
  MinigameOverlay.tsx                      # shared shell + result screen
  registry.ts                              # MinigameKind → MinigameModule
  firewall.ts / firewall.tsx               # logic / component
  logs.ts / logs.tsx
  sqli.ts / sqli.tsx
src/furniture/ServerRack.tsx               # + status visuals, plate, trigger
src/furniture/serverRackLights.ts          # + alarm waveform, forced-red
src/character/characterMachine.ts          # + CLICK_SERVER, repairing
src/character/characterStore.ts            # + clickServer
src/character/CharacterModel.tsx           # + beginRepair/closeMinigame effect
src/interaction/interactionRegistry.ts     # + 'server' kind
src/App.tsx                                 # + <MinigameOverlay/>, __breakServer
```

## Extension Points (future work, designed-for not built)

- **Consequences / penalties.** `history` + live `brokenAt`/`failures` already
  capture everything a penalty module needs. A future system subscribes to the
  store and, e.g., calls the existing `gameStore.addReprimand()` when downtime
  exceeds a threshold or failures pile up — no change to this mechanic.
- **Periodic breaking.** A trigger source (timer, story beat) calls
  `breakServer()`; nothing else changes.
- **Fourth mini-game.** The `backup` rack is a reserved role with no game yet;
  adding one is a new module + one `MINIGAME_BY_ROLE` entry.
- **NPC repairs.** Because repair goes through the shared state machine, an
  NPC brain could later target a broken rack the same way it targets a desk.

## Verification

Per `AGENTS.md` (NO TESTS) and the cutscene precedent, verify by running:
1. `npm run dev`; in the console `window.__breakServer('gateway')` → that rack
   blinks red, gains a white outline, becomes clickable; healthy racks unchanged.
2. Click the broken rack → player walks into the server room, stops in front of
   it, overlay opens; scene clicks are blocked while it's open.
3. Play each game to a win → rack turns green, outline clears, overlay closes,
   player returns to idle and is free to move.
4. Lose a game → retry offered, `failures` increments (inspect store), rack
   stays broken; **Выйти** closes the overlay leaving the rack broken.
5. `window.__breakServer()` with no arg breaks a random healthy non-backup rack;
   `backup` never breaks.
6. Drive the above headlessly (see the `headless-game-verification` notes:
   Playwright + `recordVideo`, import `/src/...` modules, seed `phase:'free'`)
   and screenshot the broken rack + each overlay.
