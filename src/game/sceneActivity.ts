import type { GamePhase } from './gameStore'
import type { GameOutcomeStatus } from './gameOutcomeRules'

// Feature 15 polish: whether the 3D office can stop rendering every frame. The
// full-screen intro / fired / game-over / campaign-success screens sit over an
// opaque or heavily-blurred backdrop and can stay open indefinitely, so the
// scene behind them needs no per-frame simulation or post-processing. App feeds
// this into the R3F `frameloop` prop ('demand' when idle, 'always' otherwise) —
// a real CPU/GPU saving on idle menus, and it keeps the main thread free for the
// UI on those screens.
export function isSceneIdle(phase: GamePhase, outcomeStatus: GameOutcomeStatus): boolean {
  return phase === 'intro' || phase === 'fired' || outcomeStatus === 'failed' || outcomeStatus === 'succeeded'
}
