import { useCyberStoryStore } from './cyberStoryStore'
import { getActiveBlockingCyberIncidentId, isBlockingCyberIncidentPending } from './cyberStoryRules'
import { getCyberStoryDefinition, type CyberStoryDefinition } from './cyberStoryCatalog'

// Derived reads over the cyber-story store for the Workday Flow, HUD
// objective and marker/DeepSeek integration - mirrors storyDecisionSelectors.
// Thin wrappers - the actual logic lives in cyberStoryRules.

export function getActiveBlockingCyberIncident(): CyberStoryDefinition | undefined {
  const id = getActiveBlockingCyberIncidentId(useCyberStoryStore.getState().incidents)
  return id ? getCyberStoryDefinition(id) : undefined
}

// A mandatory cyber incident awaits the player - the day must not
// auto-complete.
export function isCyberStoryBlockingNow(): boolean {
  return isBlockingCyberIncidentPending(useCyberStoryStore.getState().incidents)
}

// Whether the pending mandatory incident involves the given employee - hides
// that colleague's optional DeepSeek marker (the story marker takes priority).
export function isCyberStoryPendingFor(employeeId: string): boolean {
  const def = getActiveBlockingCyberIncident()
  return def !== undefined && def.participants.includes(employeeId)
}
