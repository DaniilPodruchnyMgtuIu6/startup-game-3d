import { describe, it, expect, beforeEach } from 'vitest'
import { initializeSecurityAuditIfReady } from './initializeSecurityAudit'
import { useSprintStore } from './sprintStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useGameStore } from './gameStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { BOARD_TASKS } from './tasks'
import { toWorkdayIndex } from './workdayIndex'

const audit = () => useSecurityAuditStore.getState()

function setConversation(status: 'pending' | 'completed', completedAt?: { sprintNumber: number; day: number }, decision: 'approve-security-hire' | 'decline-security-hire' = 'approve-security-hire') {
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status, staffingDecision: status === 'completed' ? decision : undefined, ...(completedAt ? { completedAt } : {}), effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
}

beforeEach(() => {
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useGameStore.setState({ tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  window.localStorage.clear()
})

describe('initializeSecurityAuditIfReady', () => {
  it('does nothing while the post-audit conversation is not completed', () => {
    setConversation('pending')
    useSprintStore.setState({ sprintNumber: 2, day: 2, phase: 'active' })
    initializeSecurityAuditIfReady()
    expect(audit().initialized).toBe(false)
  })

  it('initialises with the deadline anchored at completion + 9', () => {
    // completed at sprint 2 day 2 (index 12) -> deadline index 21 (sprint 3 day 1)
    setConversation('completed', { sprintNumber: 2, day: 2 })
    useSprintStore.setState({ sprintNumber: 2, day: 2, phase: 'active' })
    initializeSecurityAuditIfReady()
    expect(audit().initialized).toBe(true)
    expect(audit().followUpAudit.status).toBe('scheduled')
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(toWorkdayIndex(2, 2) + 9) // 21
  })

  it('is idempotent (a second call does not re-anchor)', () => {
    setConversation('completed', { sprintNumber: 2, day: 2 })
    useSprintStore.setState({ sprintNumber: 2, day: 2, phase: 'active' })
    initializeSecurityAuditIfReady()
    const deadline = audit().followUpAudit.nextAuditWorkdayIndex
    useSprintStore.setState({ sprintNumber: 5, day: 5 })
    initializeSecurityAuditIfReady()
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(deadline)
  })

  it('migrates an old overdue save: schedules the audit for the current day, no retroactive fine', () => {
    // completed long ago (sprint 2 day 2 = index 12, old deadline 21) but now at
    // sprint 5 day 1 (index 41) -> deadline is far in the past -> schedule now.
    setConversation('completed', { sprintNumber: 2, day: 2 })
    useSprintStore.setState({ sprintNumber: 5, day: 1, phase: 'active' })
    initializeSecurityAuditIfReady()
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(toWorkdayIndex(5, 1)) // 41 (fires next completed day)
    expect(audit().followUpAudit.records).toEqual([]) // no retroactive fine
  })
})
