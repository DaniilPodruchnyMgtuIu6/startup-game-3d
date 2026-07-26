import { useStoryDecisionStore } from './storyDecisionStore'
import { getActiveBlockingDecisionId, isBlockingStoryDecisionPending } from './storyDecisionRules'
import { getStoryDecision, type StoryDecisionDefinition } from './storyDecisionCatalog'
import type { Level1StoryDecisionId } from './level1Timeline'

// Derived reads over the story-decision store for the Workday Flow, HUD
// objective and marker/DeepSeek integration (17A §7). Thin wrappers - the
// actual logic lives in storyDecisionRules.

export function getActiveBlockingDecision(): StoryDecisionDefinition | undefined {
  const id = getActiveBlockingDecisionId(useStoryDecisionStore.getState().decisions)
  return id ? getStoryDecision(id) : undefined
}

// A mandatory decision awaits the player - the day must not auto-complete.
export function isStoryDecisionBlockingNow(): boolean {
  return isBlockingStoryDecisionPending(useStoryDecisionStore.getState().decisions)
}

// Whether the pending mandatory decision involves the given employee - hides
// that colleague's optional DeepSeek marker (the story marker takes priority).
export function isStoryDecisionPendingFor(employeeId: string): boolean {
  const def = getActiveBlockingDecision()
  return def !== undefined && def.participants.includes(employeeId)
}

export function isDecisionResolved(id: Level1StoryDecisionId): boolean {
  return useStoryDecisionStore.getState().decisions[id].status === 'resolved'
}

export function getResolvedChoiceId(id: Level1StoryDecisionId): string | undefined {
  const record = useStoryDecisionStore.getState().decisions[id]
  return record.status === 'resolved' ? record.selectedChoiceId : undefined
}
