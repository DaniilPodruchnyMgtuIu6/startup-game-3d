import { composeDailyBreakdown, type ExpenseBreakdownItem } from './economyRules'
import { SPRINT_DAYS } from './sprintRules'
import { TEAM_CATALOG, DEVELOPER_CATALOG, SECURITY_SPECIALIST_ID, getEmployee } from './teamCatalog'

// Pure, deterministic team rules. Kept out of React and the store so hiring,
// salary math and the first-sprint gate can be unit-tested in isolation.

export interface HireRecord {
  employeeId: string
  hiredAtSprint: number
  hiredAtDay: number
}

export function isEmployeeHired(hires: HireRecord[], employeeId: string): boolean {
  return hires.some((h) => h.employeeId === employeeId)
}

// Unique, valid (in-catalog) employee ids from the hire records - drops unknown
// ids and duplicates so downstream salary math never doubles or invents cost.
export function getHiredEmployeeIds(hires: HireRecord[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const h of hires) {
    if (!getEmployee(h.employeeId) || seen.has(h.employeeId)) continue
    seen.add(h.employeeId)
    ids.push(h.employeeId)
  }
  return ids
}

// True once both first developers are hired. Only the developers count - the
// security specialist (Feature 07) is never required to form the dev team.
export function hasInitialDevelopmentTeam(hires: HireRecord[]): boolean {
  const ids = new Set(getHiredEmployeeIds(hires))
  return DEVELOPER_CATALOG.every((e) => ids.has(e.id))
}

// True once the fixed security specialist (Ilya) has been hired (Feature 07).
export function hasSecuritySpecialist(hires: HireRecord[]): boolean {
  return isEmployeeHired(hires, SECURITY_SPECIALIST_ID)
}

// The first sprint cannot start until both developers are hired; later sprints
// are unrestricted (also keeps old Feature-02 saves already in `active` valid).
export function canStartSprintWithTeam(sprintNumber: number, hires: HireRecord[]): boolean {
  if (sprintNumber > 1) return true
  return hasInitialDevelopmentTeam(hires)
}

// Salary breakdown items for the given hired ids, in catalog order. A Set makes
// duplicate ids count once and unknown ids contribute nothing.
export function getEmployeeSalaryExpenses(hiredEmployeeIds: string[]): ExpenseBreakdownItem[] {
  const hired = new Set(hiredEmployeeIds)
  return TEAM_CATALOG.filter((e) => hired.has(e.id)).map((e) => ({
    code: `salary:${e.id}`,
    title: `Зарплата: ${e.name}`,
    amount: e.dailySalary,
  }))
}

export function getTeamDailySalary(hires: HireRecord[]): number {
  return getEmployeeSalaryExpenses(getHiredEmployeeIds(hires)).reduce((sum, item) => sum + item.amount, 0)
}

// The security specialist's salary line if (and only if) he is hired, else null.
// The daily breakdown already includes it via getEmployeeSalaryExpenses; this is
// the isolated selector Feature 07 exposes for the finance/team UI and tests.
export function getSecuritySpecialistSalaryExpense(hires: HireRecord[]): ExpenseBreakdownItem | null {
  if (!hasSecuritySpecialist(hires)) return null
  return getEmployeeSalaryExpenses([SECURITY_SPECIALIST_ID])[0] ?? null
}

// Character-definition ids of the hired developers - the active NPC roster to
// spawn on the map. Unique and valid, so no duplicate or ghost NPC.
export function getHiredCharacterIds(hires: HireRecord[]): string[] {
  return getHiredEmployeeIds(hires).map((id) => getEmployee(id)!.characterId)
}

// Hired employees with a developer role only (Kirill/Alina) - the employees that
// receive OfficeFlow product progress. The security specialist never does.
export function getHiredDeveloperIds(hires: HireRecord[]): string[] {
  return getHiredEmployeeIds(hires).filter((id) => {
    const role = getEmployee(id)?.role
    return role === 'backend-developer' || role === 'frontend-developer'
  })
}

// The full daily breakdown (base expenses + active salaries) for the given hired
// ids - used by the finance UI and to build the day's expense transaction.
export function getDailyExpenseBreakdown(hiredEmployeeIds: string[]): ExpenseBreakdownItem[] {
  return composeDailyBreakdown(getEmployeeSalaryExpenses(hiredEmployeeIds))
}

// Coerce loaded/corrupt hire data into safe records: drop unknown ids (incl. the
// PM recorded as a hireable), duplicates, and invalid sprint/day values.
export function normalizeHires(raw: unknown): HireRecord[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: HireRecord[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const { employeeId, hiredAtSprint, hiredAtDay } = entry as Record<string, unknown>
    if (typeof employeeId !== 'string' || !getEmployee(employeeId)) continue
    if (seen.has(employeeId)) continue
    if (typeof hiredAtSprint !== 'number' || !Number.isInteger(hiredAtSprint) || hiredAtSprint < 1) continue
    if (typeof hiredAtDay !== 'number' || !Number.isInteger(hiredAtDay) || hiredAtDay < 1 || hiredAtDay > SPRINT_DAYS) continue
    seen.add(employeeId)
    out.push({ employeeId, hiredAtSprint, hiredAtDay })
  }
  return out
}
