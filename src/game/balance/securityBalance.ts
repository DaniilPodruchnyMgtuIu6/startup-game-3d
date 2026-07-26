// Editable security balance (Feature 17A): audit fines and cadence, corrective
// finding efforts, СКУД investment/effort/escalation, office-intrusion threat
// and server-incident costs. Values are moved verbatim from Features 08-11 -
// the rule modules import from here and re-export their existing names.

export const SECURITY_BALANCE = {
  followUpAudit: {
    intervalWorkdays: 10,
    fineRubByAuditNumber: { 1: 120_000, 2: 250_000, 3: 500_000 } as Record<number, number>,
  },
  findingEffortDaysById: {
    'workstation-locking-training': 2,
    'account-access-review': 3,
    'incident-response-procedure': 2,
    'sensitive-data-logging-review': 3,
  },
  accessControl: {
    investmentCostRub: 180_000,
    effortDaysByAssignee: {
      'sonya-sokolova': 3,
      'ilya-vlasov': 2,
    },
    escalationDelayWorkdays: 2,
  },
  intrusion: {
    delayWorkdays: 4,
    responseCostWithSpecialistRub: 60_000,
    responseCostWithoutSpecialistRub: 140_000,
  },
  serverIncidents: {
    'gateway-outage': {
      immediateCostWithSpecialistRub: 80_000,
      immediateCostWithoutSpecialistRub: 120_000,
      downtimeCostPerDayRub: 40_000,
      recoveryEffortDaysWithoutSpecialist: 2,
      recoveryEffortDaysWithSpecialist: 1,
    },
    'auth-account-incident': {
      immediateCostWithSpecialistRub: 100_000,
      immediateCostWithoutSpecialistRub: 170_000,
      downtimeCostPerDayRub: 30_000,
      recoveryEffortDaysWithoutSpecialist: 2,
      recoveryEffortDaysWithSpecialist: 1,
    },
    'database-exposure-review': {
      immediateCostWithSpecialistRub: 160_000,
      immediateCostWithoutSpecialistRub: 260_000,
      downtimeCostPerDayRub: 50_000,
      recoveryEffortDaysWithoutSpecialist: 3,
      recoveryEffortDaysWithSpecialist: 2,
    },
  },
} as const
