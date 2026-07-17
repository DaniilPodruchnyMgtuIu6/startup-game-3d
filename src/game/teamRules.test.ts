import { describe, it, expect } from 'vitest'
import { TEAM_CATALOG, getEmployee } from './teamCatalog'
import {
  canStartSprintWithTeam,
  getDailyExpenseBreakdown,
  getEmployeeSalaryExpenses,
  getHiredCharacterIds,
  getHiredEmployeeIds,
  getTeamDailySalary,
  hasInitialDevelopmentTeam,
  isEmployeeHired,
  normalizeHires,
  type HireRecord,
} from './teamRules'
import { BASE_DAILY_COST } from './economyRules'

const hire = (employeeId: string, sprint = 1, day = 1): HireRecord => ({ employeeId, hiredAtSprint: sprint, hiredAtDay: day })
const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'

describe('team catalog', () => {
  it('contains only Kirill and Alina, with unique ids and roles', () => {
    expect(TEAM_CATALOG.map((e) => e.id)).toEqual([KIRILL, ALINA])
    expect(new Set(TEAM_CATALOG.map((e) => e.id)).size).toBe(2)
    expect(new Set(TEAM_CATALOG.map((e) => e.role)).size).toBe(2)
  })

  it('has the fixed salaries 9 000 and 8 000', () => {
    expect(getEmployee(KIRILL)?.dailySalary).toBe(9_000)
    expect(getEmployee(ALINA)?.dailySalary).toBe(8_000)
  })
})

describe('hire selectors', () => {
  it('isEmployeeHired / getHiredEmployeeIds', () => {
    const hires = [hire(KIRILL)]
    expect(isEmployeeHired(hires, KIRILL)).toBe(true)
    expect(isEmployeeHired(hires, ALINA)).toBe(false)
    expect(getHiredEmployeeIds(hires)).toEqual([KIRILL])
  })

  it('deduplicates and ignores unknown ids', () => {
    const hires = [hire(KIRILL), hire(KIRILL), hire('ghost')]
    expect(getHiredEmployeeIds(hires)).toEqual([KIRILL])
  })

  it('hasInitialDevelopmentTeam requires both developers', () => {
    expect(hasInitialDevelopmentTeam([])).toBe(false)
    expect(hasInitialDevelopmentTeam([hire(KIRILL)])).toBe(false)
    expect(hasInitialDevelopmentTeam([hire(KIRILL), hire(ALINA)])).toBe(true)
  })

  it('active NPC roster is the hired developers character ids', () => {
    expect(getHiredCharacterIds([])).toEqual([])
    expect(getHiredCharacterIds([hire(KIRILL)])).toEqual(['npc-kirill-morozov'])
    expect(getHiredCharacterIds([hire(KIRILL), hire(ALINA), hire(KIRILL)])).toEqual([
      'npc-kirill-morozov',
      'npc-alina-belova',
    ])
  })
})

describe('canStartSprintWithTeam', () => {
  it('blocks the first sprint until both are hired', () => {
    expect(canStartSprintWithTeam(1, [])).toBe(false)
    expect(canStartSprintWithTeam(1, [hire(KIRILL)])).toBe(false)
    expect(canStartSprintWithTeam(1, [hire(KIRILL), hire(ALINA)])).toBe(true)
  })

  it('never blocks later sprints (keeps old active saves valid)', () => {
    expect(canStartSprintWithTeam(2, [])).toBe(true)
  })
})

describe('salary math', () => {
  it('getTeamDailySalary: none 0, Kirill 9 000, Alina 8 000, both 17 000', () => {
    expect(getTeamDailySalary([])).toBe(0)
    expect(getTeamDailySalary([hire(KIRILL)])).toBe(9_000)
    expect(getTeamDailySalary([hire(ALINA)])).toBe(8_000)
    expect(getTeamDailySalary([hire(KIRILL), hire(ALINA)])).toBe(17_000)
  })

  it('duplicate ids do not double salary; unknown ids are ignored', () => {
    expect(getEmployeeSalaryExpenses([KIRILL, KIRILL]).reduce((s, i) => s + i.amount, 0)).toBe(9_000)
    expect(getEmployeeSalaryExpenses(['ghost'])).toEqual([])
  })

  it('does not include the PM salary (already in base expenses)', () => {
    const items = getEmployeeSalaryExpenses([KIRILL, ALINA])
    expect(items.some((i) => i.code.includes('sonya') || i.title.includes('Соня'))).toBe(false)
  })

  it('getDailyExpenseBreakdown composes base + salaries in the documented shape', () => {
    const breakdown = getDailyExpenseBreakdown([KIRILL, ALINA])
    expect(breakdown).toEqual([
      { code: 'office-rent', title: 'Аренда офиса', amount: 8_000 },
      { code: 'infrastructure', title: 'Серверы и сервисы', amount: 4_000 },
      { code: 'project-manager', title: 'Проджект-менеджер', amount: 6_000 },
      { code: 'administration', title: 'Административные расходы', amount: 2_000 },
      { code: 'salary:kirill-morozov', title: 'Зарплата: Кирилл Морозов', amount: 9_000 },
      { code: 'salary:alina-belova', title: 'Зарплата: Алина Белова', amount: 8_000 },
    ])
    expect(breakdown.reduce((s, i) => s + i.amount, 0)).toBe(BASE_DAILY_COST + 17_000)
  })
})

describe('normalizeHires', () => {
  it('keeps valid records', () => {
    const hires = [hire(KIRILL, 1, 3)]
    expect(normalizeHires(hires)).toEqual(hires)
  })

  it('drops unknown ids, the PM as hireable, duplicates, and bad sprint/day', () => {
    const result = normalizeHires([
      hire(KIRILL, 1, 3),
      hire(KIRILL, 1, 4), // duplicate id
      hire('sonya-sokolova', 1, 1), // PM is not hireable
      hire('ghost', 1, 1),
      hire(ALINA, 0, 1), // bad sprint
      hire(ALINA, 1, 99), // bad day
      'garbage',
      null,
    ])
    expect(result).toEqual([hire(KIRILL, 1, 3)])
  })

  it('non-array falls back to empty', () => {
    expect(normalizeHires('nope')).toEqual([])
    expect(normalizeHires(undefined)).toEqual([])
  })
})
