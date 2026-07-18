import { describe, it, expect } from 'vitest'
import { pickAutoBreakRole, AUTO_BREAK_MIN_SPRINT, type RackState, type ServerRole } from './serverIncidentsStore'

function allOk(): Record<ServerRole, RackState> {
  const mk = (role: ServerRole): RackState => ({ role, status: 'ok', brokenAt: null, failures: 0 })
  return { gateway: mk('gateway'), auth: mk('auth'), database: mk('database'), backup: mk('backup') }
}

describe('pickAutoBreakRole (deterministic auto-break schedule)', () => {
  it('does not break before the minimum sprint', () => {
    expect(pickAutoBreakRole(12, AUTO_BREAK_MIN_SPRINT - 1, allOk())).toBeNull()
  })

  it('only breaks on cadence days', () => {
    expect(pickAutoBreakRole(13, 2, allOk())).toBeNull() // 13 % 3 !== 0
    expect(pickAutoBreakRole(12, 2, allOk())).not.toBeNull() // 12 % 3 === 0
  })

  it('rotates deterministically across all four racks', () => {
    expect(pickAutoBreakRole(12, 2, allOk())).toBe('gateway')
    expect(pickAutoBreakRole(15, 2, allOk())).toBe('auth')
    expect(pickAutoBreakRole(18, 2, allOk())).toBe('database')
    expect(pickAutoBreakRole(21, 3, allOk())).toBe('backup')
    expect(pickAutoBreakRole(24, 3, allOk())).toBe('gateway')
  })

  it('never piles a second incident on an unresolved one', () => {
    const racks = allOk()
    racks.auth.status = 'broken'
    expect(pickAutoBreakRole(12, 2, racks)).toBeNull()
  })

  it('is stable when called repeatedly for the same day', () => {
    expect(pickAutoBreakRole(15, 2, allOk())).toBe(pickAutoBreakRole(15, 2, allOk()))
  })
})
