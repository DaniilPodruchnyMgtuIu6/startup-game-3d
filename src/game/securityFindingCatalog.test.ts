import { describe, it, expect } from 'vitest'
import {
  SECURITY_FINDING_CATALOG,
  TOTAL_SECURITY_EFFORT_DAYS,
  getSecurityFinding,
} from './securityFindingCatalog'

const effortOfKind = (kind: 'process' | 'technical') =>
  SECURITY_FINDING_CATALOG.filter((f) => f.kind === kind).reduce((s, f) => s + f.effortDays, 0)

describe('security finding catalog', () => {
  it('contains exactly four findings with unique ids', () => {
    expect(SECURITY_FINDING_CATALOG).toHaveLength(4)
    expect(new Set(SECURITY_FINDING_CATALOG.map((f) => f.id)).size).toBe(4)
  })

  it('total effort is 10 working days (process 4, technical 6)', () => {
    expect(TOTAL_SECURITY_EFFORT_DAYS).toBe(10)
    expect(effortOfKind('process')).toBe(4)
    expect(effortOfKind('technical')).toBe(6)
  })

  it('Ilya is eligible for every finding', () => {
    expect(SECURITY_FINDING_CATALOG.every((f) => f.eligibleEmployeeIds.includes('ilya-vlasov'))).toBe(true)
  })

  it('Sonya is eligible only for process findings', () => {
    for (const f of SECURITY_FINDING_CATALOG) {
      expect(f.eligibleEmployeeIds.includes('sonya-sokolova')).toBe(f.kind === 'process')
    }
  })

  it('Kirill is eligible only for technical findings', () => {
    for (const f of SECURITY_FINDING_CATALOG) {
      expect(f.eligibleEmployeeIds.includes('kirill-morozov')).toBe(f.kind === 'technical')
    }
  })

  it('Alina is eligible for none', () => {
    expect(SECURITY_FINDING_CATALOG.some((f) => f.eligibleEmployeeIds.includes('alina-belova'))).toBe(false)
  })

  it('getSecurityFinding resolves by id', () => {
    expect(getSecurityFinding('account-access-review')?.severity).toBe('high')
    expect(getSecurityFinding('nope')).toBeUndefined()
  })
})
