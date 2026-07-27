import { describe, it, expect } from 'vitest'
import { ECONOMY_BALANCE } from './economyBalance'
import { TEAM_BALANCE } from './teamBalance'
import { SECURITY_BALANCE } from './securityBalance'
import { TIMELINE_BALANCE } from './timelineBalance'
import { STORY_BALANCE } from './storyBalance'
import { INITIAL_BUDGET, BASE_DAILY_COST, BASE_SPRINT_COST, ACCESS_CONTROL_INVESTMENT_COST } from '../economyRules'
import { getEmployee } from '../teamCatalog'
import { SECURITY_AUDIT_FINE_BY_NUMBER } from '../securityAuditRules'
import { SECURITY_FINDING_CATALOG, TOTAL_SECURITY_EFFORT_DAYS } from '../securityFindingCatalog'
import {
  OFFICE_INTRUSION_DELAY_DAYS,
  OFFICE_INTRUSION_RESPONSE_COST_WITH_SPECIALIST,
  OFFICE_INTRUSION_RESPONSE_COST_WITHOUT_SPECIALIST,
  getAccessControlEffortDays,
} from '../accessControlRules'
import { SERVER_INCIDENT_CATALOG } from '../serverIncidentCatalog'
import { SPRINT_DAYS } from '../sprintRules'
import { CAMPAIGN_DEADLINE_SPRINT, LEADERSHIP_GRACE_PERIOD_DAYS, MAX_SERVER_DOWNTIME_DAYS } from '../gameOutcomeRules'

// Feature 17A §3: the constants moved into the balance files verbatim. These
// tests pin the ORIGINAL Feature 01-13 numbers, so an accidental edit of a
// balance value (or a broken re-export) fails loudly.

describe('legacy numbers are unchanged after the move', () => {
  it('economy', () => {
    expect(INITIAL_BUDGET).toBe(2_500_000)
    expect(BASE_DAILY_COST).toBe(20_000)
    expect(BASE_SPRINT_COST).toBe(200_000)
    expect(ECONOMY_BALANCE.initialBudgetRub).toBe(2_500_000)
  })

  it('team salaries', () => {
    expect(getEmployee('kirill-morozov')?.dailySalary).toBe(9_000)
    expect(getEmployee('alina-belova')?.dailySalary).toBe(8_000)
    expect(getEmployee('ilya-vlasov')?.dailySalary).toBe(9_000)
    expect(TEAM_BALANCE.dailySalaryRubByEmployee['ilya-vlasov']).toBe(9_000)
  })

  it('audit fines, interval and finding efforts', () => {
    expect(SECURITY_AUDIT_FINE_BY_NUMBER).toEqual({ 1: 120_000, 2: 250_000, 3: 500_000 })
    expect(SECURITY_BALANCE.followUpAudit.intervalWorkdays).toBe(10)
    expect(TOTAL_SECURITY_EFFORT_DAYS).toBe(10)
    expect(SECURITY_FINDING_CATALOG.map((f) => f.effortDays)).toEqual([2, 3, 2, 3])
  })

  it('СКУД and intrusion', () => {
    expect(ACCESS_CONTROL_INVESTMENT_COST).toBe(180_000)
    expect(getAccessControlEffortDays('sonya-sokolova')).toBe(3)
    expect(getAccessControlEffortDays('ilya-vlasov')).toBe(2)
    expect(SECURITY_BALANCE.accessControl.escalationDelayWorkdays).toBe(2)
    expect(OFFICE_INTRUSION_DELAY_DAYS).toBe(4)
    expect(OFFICE_INTRUSION_RESPONSE_COST_WITH_SPECIALIST).toBe(60_000)
    expect(OFFICE_INTRUSION_RESPONSE_COST_WITHOUT_SPECIALIST).toBe(140_000)
  })

  it('server incidents', () => {
    const byId = Object.fromEntries(SERVER_INCIDENT_CATALOG.map((i) => [i.id, i]))
    expect(byId['gateway-outage']).toMatchObject({
      immediateCostWithSecuritySpecialist: 80_000,
      immediateCostWithoutSecuritySpecialist: 120_000,
      downtimeCostPerDay: 40_000,
      recoveryEffortWithoutSecuritySpecialist: 2,
      recoveryEffortWithSecuritySpecialist: 1,
    })
    expect(byId['auth-account-incident']).toMatchObject({
      immediateCostWithSecuritySpecialist: 100_000,
      immediateCostWithoutSecuritySpecialist: 170_000,
      downtimeCostPerDay: 30_000,
    })
    expect(byId['database-exposure-review']).toMatchObject({
      immediateCostWithSecuritySpecialist: 160_000,
      immediateCostWithoutSecuritySpecialist: 260_000,
      downtimeCostPerDay: 50_000,
      recoveryEffortWithoutSecuritySpecialist: 3,
      recoveryEffortWithSecuritySpecialist: 2,
    })
  })

  it('timeline', () => {
    expect(SPRINT_DAYS).toBe(10)
    expect(CAMPAIGN_DEADLINE_SPRINT).toBe(6)
    expect(LEADERSHIP_GRACE_PERIOD_DAYS).toBe(5)
    expect(MAX_SERVER_DOWNTIME_DAYS).toBe(5)
  })

  it('story balance keeps the 17A base values (17B added fields around them)', () => {
    expect(STORY_BALANCE.baselineAudit).toMatchObject({ costRub: 140_000, resultDelayWorkdays: 2 })
    expect(STORY_BALANCE.internalSecurityReview).toMatchObject({ effortDays: 2, hireDeadlineWorkdays: 3 })
    expect(STORY_BALANCE.backupRestore).toMatchObject({
      fullDrillCostRub: 60_000,
      fullDrillEffortDays: 2,
      configureOnlyCostRub: 30_000,
      configureOnlyEffortDays: 1,
    })
  })
})

describe('balance modules are leaf modules (no cyclic imports possible)', () => {
  // Raw sources via Vite - keeps this test free of node imports (browser tsconfig).
  const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const balanceFiles = [
    './economyBalance.ts',
    './teamBalance.ts',
    './securityBalance.ts',
    './timelineBalance.ts',
    './storyBalance.ts',
    './ambientOfficeBalance.ts',
  ]

  it.each(balanceFiles)('%s contains no import statements at all', (file) => {
    const source = sources[file]
    expect(source).toBeTruthy()
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\brequire\s*\(/)
  })

  it('index.ts only re-exports the balance modules', () => {
    const source = sources['./index.ts']
    expect(source).toBeTruthy()
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
    expect(imports.length).toBeGreaterThan(0)
    expect(imports.every((p) => p.startsWith('./'))).toBe(true)
  })
})
