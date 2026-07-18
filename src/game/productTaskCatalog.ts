// Fixed OfficeFlow backlog (Feature 04). Pure static data - only the mutable
// task state is persisted (see productStore). 14 tasks total: 6 for the first
// working prototype, 8 for the rest of the MVP. Assignees are fixed by role
// (one backend dev = Kirill, one frontend dev = Alina) - no assignee picker.

export type ProductTaskRole = 'backend-developer' | 'frontend-developer'
export type ProductTaskGroup = 'prototype' | 'mvp'

export interface ProductTaskDefinition {
  id: string
  title: string
  description: string
  role: ProductTaskRole
  assigneeEmployeeId: string
  effortDays: number
  group: ProductTaskGroup
}

// One developer's base capacity per sprint (10 working days).
export const EMPLOYEE_SPRINT_CAPACITY_DAYS = 10

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'

export const PRODUCT_TASK_CATALOG: ProductTaskDefinition[] = [
  // --- First working prototype (6 tasks) ---
  {
    id: 'auth-api',
    title: 'API авторизации',
    description: 'Реализовать вход сотрудников и выдачу пользовательской сессии.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 3,
    group: 'prototype',
  },
  {
    id: 'rooms-api',
    title: 'API переговорных',
    description: 'Реализовать получение списка переговорных и их доступности.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 3,
    group: 'prototype',
  },
  {
    id: 'booking-api',
    title: 'API бронирования',
    description: 'Реализовать создание и отмену бронирования переговорной.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 3,
    group: 'prototype',
  },
  {
    id: 'login-screen',
    title: 'Экран входа',
    description: 'Создать интерфейс входа сотрудника в OfficeFlow.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 2,
    group: 'prototype',
  },
  {
    id: 'rooms-screen',
    title: 'Каталог переговорных',
    description: 'Создать экран со списком переговорных и их статусом.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 3,
    group: 'prototype',
  },
  {
    id: 'booking-form',
    title: 'Форма бронирования',
    description: 'Создать пользовательскую форму бронирования переговорной.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 3,
    group: 'prototype',
  },
  // --- Rest of the MVP (8 tasks) ---
  {
    id: 'employees-api',
    title: 'API сотрудников',
    description: 'Реализовать получение и редактирование учётных записей сотрудников.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 4,
    group: 'mvp',
  },
  {
    id: 'guest-passes-api',
    title: 'API гостевых пропусков',
    description: 'Реализовать создание и отзыв гостевых пропусков.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 4,
    group: 'mvp',
  },
  {
    id: 'event-log-api',
    title: 'API журнала событий',
    description: 'Реализовать хранение и получение событий OfficeFlow.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 3,
    group: 'mvp',
  },
  {
    id: 'notifications-api',
    title: 'API уведомлений',
    description: 'Реализовать создание и получение уведомлений.',
    role: 'backend-developer',
    assigneeEmployeeId: KIRILL,
    effortDays: 3,
    group: 'mvp',
  },
  {
    id: 'employees-screen',
    title: 'Экран сотрудников',
    description: 'Создать интерфейс просмотра учётных записей сотрудников.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 4,
    group: 'mvp',
  },
  {
    id: 'guest-passes-screen',
    title: 'Интерфейс гостевых пропусков',
    description: 'Создать форму выдачи и экран списка гостевых пропусков.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 4,
    group: 'mvp',
  },
  {
    id: 'event-log-screen',
    title: 'Экран журнала событий',
    description: 'Создать интерфейс просмотра событий OfficeFlow.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 3,
    group: 'mvp',
  },
  {
    id: 'notifications-screen',
    title: 'Экран уведомлений',
    description: 'Создать интерфейс пользовательских уведомлений.',
    role: 'frontend-developer',
    assigneeEmployeeId: ALINA,
    effortDays: 3,
    group: 'mvp',
  },
]

// Total effort of the whole catalog - the denominator for product readiness.
export const TOTAL_EFFORT_DAYS = PRODUCT_TASK_CATALOG.reduce((sum, t) => sum + t.effortDays, 0)

// The six tasks that make up the first working prototype milestone.
export const FIRST_PROTOTYPE_TASK_IDS = PRODUCT_TASK_CATALOG.filter((t) => t.group === 'prototype').map((t) => t.id)

export function getProductTask(id: string): ProductTaskDefinition | undefined {
  return PRODUCT_TASK_CATALOG.find((t) => t.id === id)
}
