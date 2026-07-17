// Pure, deterministic rules for the two-week sprint clock. Kept out of React
// and the store so the transitions can be unit-tested in isolation (same split
// the project uses for serverRackLights / characterMachine). Illegal
// transitions are no-ops (return the input unchanged), matching the codebase's
// established style in characterMachine.nextState and the gameStore actions.

export type SprintPhase = 'planning' | 'active' | 'review'

export interface SprintState {
  sprintNumber: number
  day: number
  phase: SprintPhase
}

// One sprint = ten notional working days.
export const SPRINT_DAYS = 10

export const INITIAL_SPRINT_STATE: SprintState = { sprintNumber: 1, day: 1, phase: 'planning' }

const PHASES: SprintPhase[] = ['planning', 'active', 'review']

// planning -> active. Day stays 1, sprint number unchanged. No-op otherwise.
export function startSprint(state: SprintState): SprintState {
  if (state.phase !== 'planning') return state
  return { ...state, phase: 'active', day: 1 }
}

// The confirmed "end of day" transition, valid only while active:
//   days 1..9 -> day + 1, still active
//   day 10    -> phase becomes review, day stays 10
// No-op outside active. Day never leaves [1, SPRINT_DAYS].
export function advanceSprintDay(state: SprintState): SprintState {
  if (state.phase !== 'active') return state
  if (state.day >= SPRINT_DAYS) return { ...state, day: SPRINT_DAYS, phase: 'review' }
  return { ...state, day: state.day + 1 }
}

// review -> the next sprint's planning. No-op outside review.
export function completeSprintReview(state: SprintState): SprintState {
  if (state.phase !== 'review') return state
  return { sprintNumber: state.sprintNumber + 1, day: 1, phase: 'planning' }
}

// Coerce an unknown (loaded or corrupted) value into a safe SprintState.
// Anything malformed or out of range falls back to the initial state.
export function normalizeSprintState(raw: unknown): SprintState {
  if (!raw || typeof raw !== 'object') return { ...INITIAL_SPRINT_STATE }
  const { sprintNumber, day, phase } = raw as Record<string, unknown>
  if (!PHASES.includes(phase as SprintPhase)) return { ...INITIAL_SPRINT_STATE }
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) {
    return { ...INITIAL_SPRINT_STATE }
  }
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > SPRINT_DAYS) {
    return { ...INITIAL_SPRINT_STATE }
  }
  // planning always sits on day 1; a save claiming otherwise is inconsistent
  const normalizedDay = phase === 'planning' ? 1 : day
  return { sprintNumber, day: normalizedDay, phase: phase as SprintPhase }
}
