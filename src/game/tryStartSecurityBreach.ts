import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { getSecurityBreachEligibility, type SecurityBreachTriggerContext } from './securityStoryRules'

// The single narrow operation that launches the security-breach scene when the
// game state allows it. The scene script itself drives the story lifecycle
// (running -> decision -> effects once -> completed), so this only re-checks
// eligibility and starts the existing scene from the registry. No StoryManager,
// no event engine.

export type TryStartSecurityBreachResult =
  | { started: true }
  | { started: false; reason: 'not-eligible' | 'already-running' | 'already-completed' }

export function tryStartSecurityBreach(context: SecurityBreachTriggerContext): TryStartSecurityBreachResult {
  const eligibility = getSecurityBreachEligibility(context)
  if (!eligibility.allowed) {
    if (context.securityBreachStatus === 'running') return { started: false, reason: 'already-running' }
    if (context.securityBreachStatus === 'completed') return { started: false, reason: 'already-completed' }
    return { started: false, reason: 'not-eligible' }
  }
  // startScene ignores the call if a scene is already active, so this can never
  // stack a second instance.
  useCutsceneStore.getState().startScene('security-breach')
  return { started: true }
}
