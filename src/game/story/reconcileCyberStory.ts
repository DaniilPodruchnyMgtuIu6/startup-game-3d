import { evaluateCyberStoryUnlocks } from './evaluateCyberStoryUnlocks'

// Feature 19 migration entry point, called once at startup (App.tsx), after
// every other feature's own reconcile call - mirrors reconcileStoryDecisions.
//
// Unlike Feature 17A's decisions, the three cyber incidents have no legacy
// pre-Feature-19 save format to migrate FROM: an old save simply lacks the
// `startup-office-cyber-story` key, so cyberStoryStore's module-load hydration
// already starts every incident at 'locked' - no unsafe state to repair.
//
// "Не воспроизводить задним числом" (§ Migration и reset) is satisfied by the
// trigger predicates themselves being self-gating on CURRENT campaign facts
// (hires, live product progress, the resolved frontend-test-data decision, the
// active sprint's day window) rather than a one-time snapshot: a returning
// save only unlocks a scene if the live state genuinely still matches its
// trigger, exactly like every other reactive Feature 17 trigger.
export function reconcileCyberStoryAtStartup(): void {
  evaluateCyberStoryUnlocks()
}
