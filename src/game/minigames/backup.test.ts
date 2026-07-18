import { describe, it, expect } from 'vitest'
import { bestRestorePointId, evaluateBackup, pickBackupScenario, type BackupScenario } from './backup'

const scenario: BackupScenario = {
  brief: 'x',
  points: [
    { id: 'infected', when: 't', location: 'same-server', ageDays: 0, verified: true, infected: true },
    { id: 'best', when: 't', location: 'offline', ageDays: 1, verified: true, infected: false },
    { id: 'unverified', when: 't', location: 'offsite-cloud', ageDays: 0, verified: false, infected: false },
    { id: 'stale', when: 't', location: 'offsite-cloud', ageDays: 30, verified: true, infected: false },
  ],
}

describe('backup mini-game evaluation', () => {
  it('accepts the freshest safe, verified, off-server copy', () => {
    expect(bestRestorePointId(scenario)).toBe('best')
    expect(evaluateBackup('best', scenario)).toEqual({ passed: true })
  })

  it('rejects an infected copy first', () => {
    expect(evaluateBackup('infected', scenario).reason).toBe('infected')
  })

  it('rejects an unverified copy', () => {
    expect(evaluateBackup('unverified', scenario).reason).toBe('unverified')
  })

  it('rejects a working but stale copy (more data lost than necessary)', () => {
    expect(evaluateBackup('stale', scenario).reason).toBe('stale')
  })

  it('rejects a copy on the same server even when fresh and verified', () => {
    const s: BackupScenario = {
      brief: 'x',
      points: [
        { id: 'onserver', when: 't', location: 'same-server', ageDays: 0, verified: true, infected: false },
        { id: 'safe', when: 't', location: 'offline', ageDays: 2, verified: true, infected: false },
      ],
    }
    expect(evaluateBackup('onserver', s).reason).toBe('on-server')
    expect(evaluateBackup('safe', s)).toEqual({ passed: true })
  })

  it('every authored scenario has exactly one winning restore point', () => {
    for (let i = 0; i < 3; i++) {
      const sc = pickBackupScenario(() => i / 3)
      const best = bestRestorePointId(sc)
      expect(best).toBeTruthy()
      expect(evaluateBackup(best as string, sc)).toEqual({ passed: true })
      const passing = sc.points.filter((p) => evaluateBackup(p.id, sc).passed)
      expect(passing).toHaveLength(1)
    }
  })
})
