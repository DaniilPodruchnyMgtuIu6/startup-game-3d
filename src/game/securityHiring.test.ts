import { describe, it, expect } from 'vitest'
import {
  canHireSecuritySpecialist,
  getCurrentTeamCapacityLabel,
  isSecuritySpecialistCandidateAvailable,
  type SecurityHireContext,
} from './securityHiring'
import { SECURITY_SPECIALIST_ID } from './teamCatalog'
import type { HireRecord } from './teamRules'

const hire = (employeeId: string): HireRecord => ({ employeeId, hiredAtSprint: 2, hiredAtDay: 3 })
const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const ILYA = SECURITY_SPECIALIST_ID

const eligible = (over: Partial<SecurityHireContext> = {}): SecurityHireContext => ({
  staffingDecision: 'approve-security-hire',
  postAuditConversationStatus: 'completed',
  isAlreadyHired: false,
  sprintPhase: 'active',
  isCutsceneRunning: false,
  isServerMinigameOpen: false,
  isBlockingOverlayOpen: false,
  ...over,
})

describe('canHireSecuritySpecialist', () => {
  it('allows the hire when everything lines up (active or planning)', () => {
    expect(canHireSecuritySpecialist(eligible()).allowed).toBe(true)
    expect(canHireSecuritySpecialist(eligible({ sprintPhase: 'planning' })).allowed).toBe(true)
  })

  it.each<[string, Partial<SecurityHireContext>, string]>([
    ['decline decision', { staffingDecision: 'decline-security-hire' }, 'decision-not-approved'],
    ['no decision', { staffingDecision: undefined }, 'decision-not-approved'],
    ['conversation not completed', { postAuditConversationStatus: 'pending' }, 'conversation-not-completed'],
    ['already hired', { isAlreadyHired: true }, 'already-hired'],
    ['review', { sprintPhase: 'review' }, 'sprint-phase'],
    ['cutscene running', { isCutsceneRunning: true }, 'cutscene-running'],
    ['minigame open', { isServerMinigameOpen: true }, 'server-minigame-open'],
    ['overlay open', { isBlockingOverlayOpen: true }, 'overlay-open'],
  ])('is blocked when %s', (_l, over, reason) => {
    const result = canHireSecuritySpecialist(eligible(over))
    expect(result.allowed).toBe(false)
    expect(result.blockingReasons).toContain(reason)
  })
})

describe('isSecuritySpecialistCandidateAvailable', () => {
  it('only on approve + completed conversation', () => {
    expect(isSecuritySpecialistCandidateAvailable('approve-security-hire', 'completed')).toBe(true)
    expect(isSecuritySpecialistCandidateAvailable('approve-security-hire', 'pending')).toBe(false)
    expect(isSecuritySpecialistCandidateAvailable('decline-security-hire', 'completed')).toBe(false)
    expect(isSecuritySpecialistCandidateAvailable(undefined, 'completed')).toBe(false)
  })
})

describe('getCurrentTeamCapacityLabel', () => {
  const devs = [hire(KIRILL), hire(ALINA)]
  it('approve + not hired -> 3/4', () => {
    expect(getCurrentTeamCapacityLabel('approve-security-hire', devs)).toBe('3/4')
  })
  it('approve + hired -> 4/4', () => {
    expect(getCurrentTeamCapacityLabel('approve-security-hire', [...devs, hire(ILYA)])).toBe('4/4')
  })
  it('decline -> 3/3', () => {
    expect(getCurrentTeamCapacityLabel('decline-security-hire', devs)).toBe('3/3')
  })
  it('no decision -> 3/3', () => {
    expect(getCurrentTeamCapacityLabel(undefined, devs)).toBe('3/3')
  })
})
