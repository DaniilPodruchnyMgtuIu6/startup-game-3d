// Fixed roster of the two hireable first developers. No candidate market, no
// random generation, no alternatives (Feature 03). Pure data - only the fact
// of a hire is persisted (see teamStore), never this catalog.

export type EmployeeRole = 'backend-developer' | 'frontend-developer'

export interface EmployeeDefinition {
  id: string
  name: string
  role: EmployeeRole
  roleLabel: string
  dailySalary: number
  shortDescription: string
  persona: string
  // Character definition id used to spawn this employee as an NPC once hired.
  characterId: string
}

export const TEAM_CATALOG: EmployeeDefinition[] = [
  {
    id: 'kirill-morozov',
    name: 'Кирилл Морозов',
    role: 'backend-developer',
    roleLabel: 'Backend-разработчик',
    dailySalary: 9_000,
    shortDescription: 'Сильный backend-разработчик. Быстро находит практичные решения и не любит лишнюю бюрократию.',
    persona: 'Уверенный, технически сильный и прямолинейный. Любит быстрые решения и спорит с процессами, которые считает избыточными.',
    characterId: 'npc-kirill-morozov',
  },
  {
    id: 'alina-belova',
    name: 'Алина Белова',
    role: 'frontend-developer',
    roleLabel: 'Frontend-разработчик',
    dailySalary: 8_000,
    shortDescription: 'Быстро создаёт понятные интерфейсы и внимательно относится к пользовательскому опыту.',
    persona: 'Общительная и ответственная. Не любит постоянную смену требований и бессмысленные переделки.',
    characterId: 'npc-alina-belova',
  },
]

export function getEmployee(id: string): EmployeeDefinition | undefined {
  return TEAM_CATALOG.find((e) => e.id === id)
}

// The project manager is already on the team after the prologue. She is shown
// in the team panel but is NOT a hireable employee - her salary is part of the
// base daily expenses from Feature 02, so it must never be added again.
export const PROJECT_MANAGER = {
  id: 'sonya-sokolova',
  name: 'Соня Соколова',
  roleLabel: 'Проджект-менеджер',
} as const
