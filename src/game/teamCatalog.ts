// Fixed roster of hireable story employees. No candidate market, no random
// generation, no alternatives (Feature 03 / Feature 07). Pure data - only the
// fact of a hire is persisted (see teamStore), never this catalog.

export type EmployeeRole = 'backend-developer' | 'frontend-developer' | 'security-specialist'

// The stable id of the one fixed security specialist (Feature 07).
export const SECURITY_SPECIALIST_ID = 'ilya-vlasov'

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
  {
    id: SECURITY_SPECIALIST_ID,
    name: 'Илья Власов',
    role: 'security-specialist',
    roleLabel: 'Специалист по информационной безопасности',
    dailySalary: 9_000,
    shortDescription:
      'Специалист по защите инфраструктуры и внутренних процессов. Помогает находить риски до того, как они превращаются в инциденты.',
    persona:
      'Спокойный, внимательный и прямолинейный. Не обещает абсолютной безопасности и всегда объясняет цену риска. Не любит временные решения, которые становятся постоянными.',
    characterId: 'npc-ilya-vlasov',
  },
]

// The two first developers only. Feature 03 gates (form-the-team task, first
// sprint start) and the planning board iterate this, NOT the full catalog, so
// the security specialist never counts as "development team".
export const DEVELOPER_CATALOG: EmployeeDefinition[] = TEAM_CATALOG.filter(
  (e) => e.role === 'backend-developer' || e.role === 'frontend-developer',
)

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
