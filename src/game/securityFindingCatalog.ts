// Fixed catalog of the four audit findings raised after the security breach
// (Feature 08). Pure static data - only mutable finding state is persisted (see
// securityAuditStore), never this catalog. No physical-access / backup / SKUD
// findings here: those belong to later stories.

import { SECURITY_BALANCE } from './balance/securityBalance'

export type SecurityFindingSeverity = 'medium' | 'high'
export type SecurityFindingKind = 'process' | 'technical'

export interface SecurityFindingDefinition {
  id: string
  title: string
  description: string
  severity: SecurityFindingSeverity
  kind: SecurityFindingKind
  effortDays: number
  // Employee ids that MAY be assigned (subject to a real hire record for Kirill
  // and Ilya - eligibility is checked against the live team in the rules).
  eligibleEmployeeIds: string[]
}

export const SECURITY_FINDING_CATALOG: SecurityFindingDefinition[] = [
  {
    id: 'workstation-locking-training',
    title: 'Обучить сотрудников блокировать рабочие станции',
    description: 'Провести обязательный инструктаж и зафиксировать правило блокировки компьютера при уходе с рабочего места.',
    severity: 'high',
    kind: 'process',
    effortDays: SECURITY_BALANCE.findingEffortDaysById['workstation-locking-training'],
    eligibleEmployeeIds: ['sonya-sokolova', 'ilya-vlasov'],
  },
  {
    id: 'account-access-review',
    title: 'Проверить учётные записи и права доступа',
    description: 'Проверить персональные учётные записи, удалить лишние права и исключить использование общих административных доступов.',
    severity: 'high',
    kind: 'technical',
    effortDays: SECURITY_BALANCE.findingEffortDaysById['account-access-review'],
    eligibleEmployeeIds: ['kirill-morozov', 'ilya-vlasov'],
  },
  {
    id: 'incident-response-procedure',
    title: 'Описать порядок обработки инцидентов',
    description: 'Определить, кому сотрудники сообщают о нарушениях, кто фиксирует инцидент и кто принимает решение об эскалации.',
    severity: 'medium',
    kind: 'process',
    effortDays: SECURITY_BALANCE.findingEffortDaysById['incident-response-procedure'],
    eligibleEmployeeIds: ['sonya-sokolova', 'ilya-vlasov'],
  },
  {
    id: 'sensitive-data-logging-review',
    title: 'Проверить журналирование чувствительных данных',
    description: 'Проверить, что пароли, токены и другие чувствительные данные не попадают в технические логи OfficeFlow.',
    severity: 'high',
    kind: 'technical',
    effortDays: SECURITY_BALANCE.findingEffortDaysById['sensitive-data-logging-review'],
    eligibleEmployeeIds: ['kirill-morozov', 'ilya-vlasov'],
  },
]

export function getSecurityFinding(id: string): SecurityFindingDefinition | undefined {
  return SECURITY_FINDING_CATALOG.find((f) => f.id === id)
}

// Process findings = 4 days, technical = 6 days, total = 10 working days.
export const TOTAL_SECURITY_EFFORT_DAYS = SECURITY_FINDING_CATALOG.reduce((sum, f) => sum + f.effortDays, 0)
