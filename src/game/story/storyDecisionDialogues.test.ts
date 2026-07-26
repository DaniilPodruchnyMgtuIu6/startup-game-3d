import { describe, it, expect } from 'vitest'
import { buildStorySceneScript } from './storyDecisionDialogues'
import { STORY_DECISION_CATALOG } from './storyDecisionCatalog'
import { LEVEL1_DECISION_PRIORITY } from './level1Timeline'

// 17B §10: every scene has lines, qualitative hints on every choice and a
// reaction for every choice; Ilya-only third options disappear without him.

describe('story scene scripts', () => {
  it.each(LEVEL1_DECISION_PRIORITY.map((id) => [id] as const))('%s: lines, hinted choices and reactions exist', (id) => {
    for (const ilyaHired of [false, true]) {
      const script = buildStorySceneScript(id, { ilyaHired })
      expect(script.lines.length).toBeGreaterThanOrEqual(3)
      expect(script.lines.every((l) => l.text.length > 0 && l.speaker.length > 0)).toBe(true)
      expect(script.choices.length).toBeGreaterThanOrEqual(2)
      expect(new Set(script.choices.map((c) => c.id)).size).toBe(script.choices.length)
      for (const choice of script.choices) {
        expect(choice.hint && choice.hint.length > 0, `${id}:${choice.id} has a hint`).toBe(true)
        // hints are qualitative - no raw numbers leak to the player
        expect(choice.hint).not.toMatch(/\d/)
        const reaction = script.reaction(choice.id)
        expect(reaction.length).toBeGreaterThan(0)
        expect(reaction[0].text.length).toBeGreaterThan(0)
      }
    }
  })

  it('the script choices match the catalog choice ids (with Ilya hired)', () => {
    for (const def of STORY_DECISION_CATALOG) {
      const script = buildStorySceneScript(def.id, { ilyaHired: true })
      expect(script.choices.map((c) => c.id).sort()).toEqual([...def.choiceIds].sort())
    }
  })

  it('Ilya-only options exist only when he is hired', () => {
    const adminWithout = buildStorySceneScript('developer-admin-access', { ilyaHired: false })
    expect(adminWithout.choices.map((c) => c.id)).not.toContain('configure-controlled-access')
    const adminWith = buildStorySceneScript('developer-admin-access', { ilyaHired: true })
    expect(adminWith.choices.map((c) => c.id)).toContain('configure-controlled-access')

    const dataWithout = buildStorySceneScript('frontend-test-data', { ilyaHired: false })
    expect(dataWithout.choices.map((c) => c.id)).not.toContain('mask-data-with-security')
    const dataWith = buildStorySceneScript('frontend-test-data', { ilyaHired: true })
    expect(dataWith.choices.map((c) => c.id)).toContain('mask-data-with-security')
  })

  it('scenes without Ilya replace his lines with a colleague, never dropping the point', () => {
    const backup = buildStorySceneScript('backup-and-restore-strategy', { ilyaHired: false })
    expect(backup.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
    const disclosure = buildStorySceneScript('suspicious-activity-disclosure', { ilyaHired: false })
    expect(disclosure.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
    expect(disclosure.lines[0].speaker).toBe('Кирилл Морозов')
  })
})
