import type { RiskDomain } from './riskCatalog'
import { SECURITY_BALANCE } from './balance/securityBalance'

// Fixed catalog of the three supported server incidents (Feature 11). Pure
// static data - only mutable incident state is persisted (see
// serverIncidentStore). No BACKUP incident; that rack has no finished mechanic.
// Order defines the fixed scene priority: gateway, auth, database.

export type ServerIncidentId = 'gateway-outage' | 'auth-account-incident' | 'database-exposure-review'
export type ServerRackId = 'gateway' | 'auth' | 'database'

export interface ServerIncidentDefinition {
  id: ServerIncidentId
  rackId: ServerRackId
  title: string
  description: string
  riskDomain: Extract<RiskDomain, 'service-continuity' | 'identity-access' | 'sensitive-data'>
  immediateCostWithSecuritySpecialist: number
  immediateCostWithoutSecuritySpecialist: number
  downtimeCostPerDay: number
  eligibleEmployeeIds: string[]
  recoveryEffortWithoutSecuritySpecialist: number
  recoveryEffortWithSecuritySpecialist: number
  // Titles for the finance journal.
  immediateTransactionTitle: string
  downtimeTransactionTitle: string
}

export const SERVER_INCIDENT_CATALOG: ServerIncidentDefinition[] = [
  {
    id: 'gateway-outage',
    rackId: 'gateway',
    title: 'Отказ внешнего шлюза',
    description: 'Ошибочная или нестабильная конфигурация шлюза сделала OfficeFlow недоступным из офисной сети.',
    riskDomain: 'service-continuity',
    immediateCostWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['gateway-outage'].immediateCostWithSpecialistRub,
    immediateCostWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['gateway-outage'].immediateCostWithoutSpecialistRub,
    downtimeCostPerDay: SECURITY_BALANCE.serverIncidents['gateway-outage'].downtimeCostPerDayRub,
    eligibleEmployeeIds: ['kirill-morozov'],
    recoveryEffortWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['gateway-outage'].recoveryEffortDaysWithoutSpecialist,
    recoveryEffortWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['gateway-outage'].recoveryEffortDaysWithSpecialist,
    immediateTransactionTitle: 'Аварийное реагирование: отказ шлюза',
    downtimeTransactionTitle: 'Простой OfficeFlow: внешний шлюз',
  },
  {
    id: 'auth-account-incident',
    rackId: 'auth',
    title: 'Инцидент с учётными записями',
    description: 'Часть сотрудников потеряла доступ, а в журнале появились подозрительные административные сессии.',
    riskDomain: 'identity-access',
    immediateCostWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['auth-account-incident'].immediateCostWithSpecialistRub,
    immediateCostWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['auth-account-incident'].immediateCostWithoutSpecialistRub,
    downtimeCostPerDay: SECURITY_BALANCE.serverIncidents['auth-account-incident'].downtimeCostPerDayRub,
    eligibleEmployeeIds: ['kirill-morozov', 'ilya-vlasov'],
    recoveryEffortWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['auth-account-incident'].recoveryEffortDaysWithoutSpecialist,
    recoveryEffortWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['auth-account-incident'].recoveryEffortDaysWithSpecialist,
    immediateTransactionTitle: 'Аварийное реагирование: учётные записи',
    downtimeTransactionTitle: 'Ограничение OfficeFlow: учётные записи',
  },
  {
    id: 'database-exposure-review',
    rackId: 'database',
    title: 'Подозрение на раскрытие данных',
    description: 'В журналах базы обнаружены запросы, которые могли вывести служебные или пользовательские данные.',
    riskDomain: 'sensitive-data',
    immediateCostWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['database-exposure-review'].immediateCostWithSpecialistRub,
    immediateCostWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['database-exposure-review'].immediateCostWithoutSpecialistRub,
    downtimeCostPerDay: SECURITY_BALANCE.serverIncidents['database-exposure-review'].downtimeCostPerDayRub,
    eligibleEmployeeIds: ['kirill-morozov', 'ilya-vlasov'],
    recoveryEffortWithoutSecuritySpecialist: SECURITY_BALANCE.serverIncidents['database-exposure-review'].recoveryEffortDaysWithoutSpecialist,
    recoveryEffortWithSecuritySpecialist: SECURITY_BALANCE.serverIncidents['database-exposure-review'].recoveryEffortDaysWithSpecialist,
    immediateTransactionTitle: 'Расследование инцидента базы данных',
    downtimeTransactionTitle: 'Ограничение OfficeFlow: база данных',
  },
]

// Fixed scene priority (also the catalog order).
export const SERVER_INCIDENT_PRIORITY: ServerIncidentId[] = ['gateway-outage', 'auth-account-incident', 'database-exposure-review']

export function getServerIncident(id: string): ServerIncidentDefinition | undefined {
  return SERVER_INCIDENT_CATALOG.find((i) => i.id === id)
}
