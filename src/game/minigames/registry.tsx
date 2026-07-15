import type { FC } from 'react'
import type { MinigameKind } from '../serverIncidentsStore'

// Every mini-game exposes this tiny contract so the overlay shell stays
// generic. Pure scenario data + evaluation live in a sibling `.ts` file; the
// interactive part is `Component`.
export interface MinigameModule<S> {
  title: string
  // Pick a scenario from the hand-written pool. `rng` is 0..1 (Math.random by
  // default) — passed in so callers stay deterministic if needed.
  pickScenario: (rng: () => number) => S
  brief: (scenario: S) => string
  // Called on the result screen → 2-3 plain-language security takeaways.
  // `won` lets a game tailor the debrief for a loss.
  takeaways: (scenario: S, won: boolean) => string[]
  Component: FC<{ scenario: S; onWin: () => void; onLose: () => void }>
}

// Populated as each game lands (Tasks 5-7). Temporary stub keeps Task 4
// runnable end-to-end; replaced by the real modules.
const STUB: MinigameModule<{ id: string }> = {
  title: 'Заглушка',
  pickScenario: () => ({ id: 'stub' }),
  brief: () => 'Временная заглушка мини-игры.',
  takeaways: () => ['Заглушка заменяется реальной игрой.'],
  Component: ({ onWin, onLose }) => (
    <div className="minigame-stub">
      <button className="primary" onClick={onWin}>
        Победа
      </button>
      <button className="primary" onClick={onLose}>
        Проигрыш
      </button>
    </div>
  ),
}

export const MINIGAME_MODULES: Record<MinigameKind, MinigameModule<any>> = {
  firewall: STUB,
  logs: STUB,
  sqli: STUB,
}
