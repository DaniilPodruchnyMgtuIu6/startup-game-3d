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
})
