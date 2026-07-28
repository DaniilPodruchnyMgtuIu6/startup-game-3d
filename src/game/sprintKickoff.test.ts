import { describe, it, expect } from 'vitest'
import { buildSprintKickoffDialogue, type SprintKickoffContext } from './sprintKickoff'

// Feature 16 §2: the kickoff dialogue is built from the real plan and only
// includes Ilya when he is actually hired.

const base: SprintKickoffContext = {
  sprintNumber: 2,
  pm: { name: 'Соня Соколова', role: 'Проджект-менеджер' },
  developers: [
    { name: 'Кирилл Морозов', role: 'Backend-разработчик', firstTask: 'API авторизации', load: 6 },
    { name: 'Алина Белова', role: 'Frontend-разработчик', firstTask: 'Экран входа', load: 4 },
  ],
  overloaded: false,
}

describe('buildSprintKickoffDialogue', () => {
  it('opens with the PM and each developer states their first task + load', () => {
    const lines = buildSprintKickoffDialogue(base)
    expect(lines[0].speaker).toBe('Соня Соколова')
    expect(lines[0].text).toContain('спринта 2')
    const kirill = lines.find((l) => l.speaker === 'Кирилл Морозов')!
    expect(kirill.text).toContain('API авторизации')
    expect(kirill.text).toContain('6/10')
    expect(lines.find((l) => l.speaker === 'Алина Белова')!.text).toContain('Экран входа')
  })

  it('adds an overload warning only when the plan is overloaded', () => {
    expect(buildSprintKickoffDialogue(base).some((l) => l.text.includes('не уложиться'))).toBe(false)
    expect(buildSprintKickoffDialogue({ ...base, overloaded: true }).some((l) => l.text.includes('не уложиться'))).toBe(true)
  })

  it('includes Ilya only when the specialist is present', () => {
    expect(buildSprintKickoffDialogue(base).some((l) => l.speaker === 'Илья Власов')).toBe(false)
    const withIlya = buildSprintKickoffDialogue({
      ...base,
      specialist: { name: 'Илья Власов', role: 'Специалист по информационной безопасности', openFindings: 2 },
    })
    const ilya = withIlya.find((l) => l.speaker === 'Илья Власов')!
    expect(ilya.text).toContain('2')
  })

  it('handles a developer with no planned task', () => {
    const lines = buildSprintKickoffDialogue({
      ...base,
      developers: [{ name: 'Кирилл Морозов', role: 'Backend-разработчик', load: 0 }, base.developers[1]],
    })
    expect(lines.find((l) => l.speaker === 'Кирилл Морозов')!.text).toContain('задач не досталось')
  })

  // 18H: per-sprint variety must stay deterministic (reload-safe), and the
  // «Планёрка спринта N» anchor must survive every opener variant.
  it('rotates the opener/closer by sprint number, deterministically', () => {
    const s2a = buildSprintKickoffDialogue(base)
    const s2b = buildSprintKickoffDialogue(base)
    expect(s2a.map((l) => l.text)).toEqual(s2b.map((l) => l.text)) // same sprint → same words
    const s3 = buildSprintKickoffDialogue({ ...base, sprintNumber: 3 })
    expect(s3[0].text).not.toBe(s2a[0].text)
    expect(s3[s3.length - 1].text).not.toBe(s2a[s2a.length - 1].text)
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const lines = buildSprintKickoffDialogue({ ...base, sprintNumber: n })
      expect(lines[0].text).toContain(`Планёрка спринта ${n}.`)
    }
  })
})

// 18H §7: every line carries performance metadata matched to its own
// content - not a random pick. These pin the specific mapping so a future
// edit to the dialogue text can't silently drop or randomize it.
describe('buildSprintKickoffDialogue performance cues (18H §7)', () => {
  it('the opening line points the room at the whiteboard, not at Sonya', () => {
    const [opening] = buildSprintKickoffDialogue(base)
    expect(opening.cue?.focusTarget).toBe('whiteboard')
    expect(opening.cue?.speakerEmotion).toBeDefined()
  })

  it('a developer with a real task reads as confident; one with none reads as a beat of thinking', () => {
    const withTask = buildSprintKickoffDialogue(base).find((l) => l.speaker === 'Кирилл Морозов')!
    expect(withTask.cue?.speakerEmotion).toBe('confident')
    expect(withTask.cue?.listenerReaction).toBe('focused-listening')

    const noTask = buildSprintKickoffDialogue({
      ...base,
      developers: [{ name: 'Кирилл Морозов', role: 'Backend-разработчик', load: 0 }, base.developers[1]],
    }).find((l) => l.speaker === 'Кирилл Морозов')!
    expect(noTask.cue?.listenerReaction).toBe('thinking')
  })

  it('the overload warning reads as concerned, not neutral', () => {
    const overloadLine = buildSprintKickoffDialogue({ ...base, overloaded: true }).find((l) => l.text.includes('не уложиться'))!
    expect(overloadLine.cue?.speakerEmotion).toBe('concerned')
    expect(overloadLine.cue?.listenerReaction).toBe('concerned-listening')
  })

  it("Ilya's line reads relieved with zero findings, concerned-listening with open ones", () => {
    const clean = buildSprintKickoffDialogue({
      ...base,
      specialist: { name: 'Илья Власов', role: 'Специалист по информационной безопасности', openFindings: 0 },
    }).find((l) => l.speaker === 'Илья Власов')!
    expect(clean.cue?.speakerEmotion).toBe('relieved')
    expect(clean.cue?.listenerReaction).toBe('relieved-reaction')

    const findings = buildSprintKickoffDialogue({
      ...base,
      specialist: { name: 'Илья Власов', role: 'Специалист по информационной безопасности', openFindings: 3 },
    }).find((l) => l.speaker === 'Илья Власов')!
    expect(findings.cue?.listenerReaction).toBe('concerned-listening')
  })

  it('the closing "Погнали" line cues a nod, not a blank stare', () => {
    const lines = buildSprintKickoffDialogue(base)
    expect(lines[lines.length - 1].cue?.listenerReaction).toBe('nod')
  })
})
