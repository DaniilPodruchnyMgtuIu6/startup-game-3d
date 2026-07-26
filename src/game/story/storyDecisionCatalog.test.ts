import { describe, it, expect } from 'vitest'
import { STORY_DECISION_CATALOG, catalogMatchesTimeline, getStoryDecision } from './storyDecisionCatalog'
import { LEVEL1_DECISION_PRIORITY } from './level1Timeline'

describe('story decision catalog (17A §4)', () => {
  it('contains exactly the eight unique timeline nodes', () => {
    expect(STORY_DECISION_CATALOG).toHaveLength(8)
    const ids = STORY_DECISION_CATALOG.map((d) => d.id)
    expect(new Set(ids).size).toBe(8)
    expect(catalogMatchesTimeline()).toBe(true)
    expect(LEVEL1_DECISION_PRIORITY).toHaveLength(8)
  })

  it('every node has unique, non-empty choice ids', () => {
    for (const def of STORY_DECISION_CATALOG) {
      expect(def.choiceIds.length).toBeGreaterThanOrEqual(2)
      expect(new Set(def.choiceIds).size).toBe(def.choiceIds.length)
      for (const id of def.choiceIds) expect(id.length).toBeGreaterThan(0)
    }
  })

  it('every node is blocking and carries objective texts and participants', () => {
    for (const def of STORY_DECISION_CATALOG) {
      expect(def.blocking).toBe(true)
      expect(def.title.length).toBeGreaterThan(0)
      expect(def.objectiveTitle.length).toBeGreaterThan(0)
      expect(def.objectiveDescription.length).toBeGreaterThan(0)
      expect(def.participants.length).toBeGreaterThan(0)
    }
  })

  it('getStoryDecision resolves known ids and rejects unknown ones', () => {
    expect(getStoryDecision('security-baseline-path')?.id).toBe('security-baseline-path')
    expect(getStoryDecision('made-up')).toBeUndefined()
  })
})
