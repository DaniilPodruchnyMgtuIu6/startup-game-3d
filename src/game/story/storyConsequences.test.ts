import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryConsequenceStore, normalizeConsequenceState, loadConsequences } from './storyConsequenceStore'
import { evaluateStoryCheckpoints, applyConsequenceEffects, buildConsequenceScript } from './storyConsequences'
import { reconcileStoryConsequencesAtStartup } from './reconcileStoryDecisions'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { initialTransactions } from '../economyRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { LEVEL1_TIMELINE_BALANCE } from '../balance/timelineBalance'
import { STORY_BALANCE } from '../balance/storyBalance'
import { toWorkdayIndex } from '../workdayIndex'
import { BOARD_TASKS } from '../tasks'
import type { RiskSignal } from '../riskRules'

const conseq = () => useStoryConsequenceStore.getState()
const story = () => useStoryDecisionStore.getState()
const M = { sprintNumber: 1, day: 2 }
const WARNING_INDEX = toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.day)
const RESOLUTION_INDEX = toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossResolution.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossResolution.day)

function highRiskSignal(domain: 'service-continuity' | 'sensitive-data'): RiskSignal {
  return {
    id: `test:${domain}:high`,
    domain,
    impact: 6,
    source: 'story-decision',
    sourceRef: 'test',
    createdAt: { sprintNumber: 1, day: 1 },
    createdAtWorkdayIndex: 1,
    detectionDelayOverride: 0,
  }
}

function evalAt(index: number) {
  evaluateStoryCheckpoints({ sprintNumber: Math.ceil(index / 10), day: ((index - 1) % 10) + 1, completedWorkdayIndex: index })
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useGameOutcomeStore.getState().resetGameOutcome()
  story().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
  conseq().resetConsequences()
})

describe('checkpoint records are immutable and reload-safe (§14)', () => {
  it('a checkpoint marks exactly once', () => {
    expect(conseq().markCheckpoint('backup-warning', 'triggered', 5)).toBe(true)
    expect(conseq().markCheckpoint('backup-warning', 'passed', 9)).toBe(false)
    expect(conseq().checkpoints['backup-warning']).toEqual({ id: 'backup-warning', status: 'triggered', evaluatedAtWorkdayIndex: 5 })
  })

  it('a running consequence rolls back to the head of the pending queue on reload', () => {
    const n = normalizeConsequenceState({
      runningConsequenceId: 'data-loss-final-warning',
      pendingConsequenceIds: ['backup-warning-scene'],
      completedConsequenceIds: [],
    })
    expect(n.runningConsequenceId).toBeUndefined()
    expect(n.pendingConsequenceIds[0]).toBe('data-loss-final-warning') // priority head
    expect(n.pendingConsequenceIds).toContain('backup-warning-scene')
  })

  it('a completed consequence is never re-queued by a corrupt save', () => {
    const n = normalizeConsequenceState({
      pendingConsequenceIds: ['project-files-destroyed'],
      completedConsequenceIds: ['project-files-destroyed'],
    })
    expect(n.pendingConsequenceIds).toHaveLength(0)
  })

  it('?intro returns the fresh state', () => {
    conseq().markCheckpoint('backup-warning', 'triggered', 5)
    expect(loadConsequences(window.localStorage, '?intro').checkpoints['backup-warning'].status).toBe('pending')
  })
})

describe('data-loss checkpoints (§7/§8/§9)', () => {
  function riskyState() {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M) // review never completes
    story().unlockDecision('backup-and-restore-strategy', M)
    story().resolveDecision('backup-and-restore-strategy', 'postpone-backup-work', M)
    useRiskStore.setState({ signals: [highRiskSignal('service-continuity'), ...useRiskStore.getState().signals] })
  }

  it('the final warning fires exactly at Sprint 4 Day 3, not a day earlier', () => {
    riskyState()
    evalAt(WARNING_INDEX - 1)
    expect(conseq().checkpoints['data-loss-final-warning'].status).toBe('pending')
    evalAt(WARNING_INDEX)
    expect(conseq().checkpoints['data-loss-final-warning'].status).toBe('triggered')
    expect(conseq().pendingConsequenceIds).toContain('data-loss-final-warning')
  })

  it('without the warning shown the terminal branch is impossible (§17.13)', () => {
    riskyState()
    // jump straight to the resolution day - the warning checkpoint was passed
    // earlier because risks were low then
    conseq().markCheckpoint('data-loss-final-warning', 'passed', WARNING_INDEX)
    evalAt(RESOLUTION_INDEX)
    expect(conseq().checkpoints['data-loss-resolution'].status).toBe('passed')
    expect(conseq().pendingConsequenceIds).not.toContain('project-files-destroyed')
  })

  it('a completed baseline review blocks the terminal trigger (§17.14)', () => {
    riskyState()
    evalAt(WARNING_INDEX)
    applyConsequenceEffects('data-loss-final-warning', { sprintNumber: 4, day: 3 })
    conseq().completeConsequence('data-loss-final-warning')
    conseq().setBaselineReviewCompleted()
    evalAt(RESOLUTION_INDEX)
    expect(conseq().checkpoints['data-loss-resolution'].status).toBe('passed')
  })

  it('absent restore -> terminal; configured -> recoverable; verified -> relief (§17.15-17)', () => {
    riskyState()
    evalAt(WARNING_INDEX)
    applyConsequenceEffects('data-loss-final-warning', { sprintNumber: 4, day: 3 })
    conseq().completeConsequence('data-loss-final-warning')
    evalAt(RESOLUTION_INDEX)
    expect(conseq().pendingConsequenceIds).toContain('project-files-destroyed')

    // configured branch
    conseq().resetConsequences()
    story().resetLevel1Story()
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    story().unlockDecision('backup-and-restore-strategy', M)
    story().resolveDecision('backup-and-restore-strategy', 'configure-backups-only', M)
    evalAt(WARNING_INDEX)
    applyConsequenceEffects('data-loss-final-warning', { sprintNumber: 4, day: 3 })
    conseq().completeConsequence('data-loss-final-warning')
    evalAt(RESOLUTION_INDEX)
    expect(conseq().pendingConsequenceIds).toContain('project-recovered-unverified')

    // verified via the late drill
    conseq().resetConsequences()
    conseq().setFinalWarningShown(WARNING_INDEX)
    conseq().setLateRestoreDrillCompleted()
    evalAt(RESOLUTION_INDEX)
    expect(conseq().pendingConsequenceIds).toContain('project-recovered-verified')
  })

  it('the terminal scene registers the failure exactly once', () => {
    applyConsequenceEffects('project-files-destroyed', { sprintNumber: 4, day: 6 })
    applyConsequenceEffects('project-files-destroyed', { sprintNumber: 4, day: 6 })
    const outcome = useGameOutcomeStore.getState()
    expect(outcome.status).toBe('failure-pending')
    expect(outcome.pendingFailure?.reason).toBe('unrecoverable-project-data-loss')
  })

  it('the recoverable branch applies its money and work exactly once', () => {
    applyConsequenceEffects('project-recovered-unverified', { sprintNumber: 4, day: 6 })
    applyConsequenceEffects('project-recovered-unverified', { sprintNumber: 4, day: 6 })
    const recovery = useEconomyStore.getState().transactions.filter((t) => t.id === 'story:recover-unverified-backup')
    expect(recovery).toHaveLength(1)
    expect(recovery[0]).toMatchObject({ category: 'security-recovery', amount: STORY_BALANCE.dataLoss.recoveryCostRub })
    expect(useStoryWorkStore.getState().assignments.filter((a) => a.employeeId === 'kirill-morozov')).toHaveLength(1)
    expect(useGameOutcomeStore.getState().status).toBe('playing')
  })
})

describe('migration (§15)', () => {
  it('an old save past Sprint 4 Day 3 skips the data-loss checkpoints', () => {
    useSprintStore.setState({ sprintNumber: 5, day: 2, phase: 'active', confirmingEndDay: false })
    reconcileStoryConsequencesAtStartup()
    expect(conseq().checkpoints['data-loss-final-warning'].status).toBe('skipped-migration')
    expect(conseq().checkpoints['data-loss-resolution'].status).toBe('skipped-migration')
    expect(conseq().pendingConsequenceIds).toHaveLength(0)
  })

  it('a save at the exact warning day keeps its checkpoint live', () => {
    useSprintStore.setState({ sprintNumber: 4, day: 3, phase: 'active', confirmingEndDay: false })
    reconcileStoryConsequencesAtStartup()
    expect(conseq().checkpoints['data-loss-final-warning'].status).toBe('pending')
  })
})

describe('concealed release risk (§12)', () => {
  it('the discovery scene ends the campaign with the new reason, once', () => {
    applyConsequenceEffects('concealed-risk-discovered', { sprintNumber: 5, day: 5 })
    applyConsequenceEffects('concealed-risk-discovered', { sprintNumber: 5, day: 5 })
    const outcome = useGameOutcomeStore.getState()
    expect(outcome.status).toBe('failure-pending')
    expect(outcome.pendingFailure?.reason).toBe('concealed-critical-release-risk')
  })
})

describe('scene scripts stay honest (§18)', () => {
  it('every consequence scene has lines and no raw numbers in choices', () => {
    for (const id of ['data-loss-final-warning', 'project-files-destroyed', 'backup-warning-scene', 'baseline-audit-result'] as const) {
      const script = buildConsequenceScript(id)
      expect(script.lines.length).toBeGreaterThan(0)
      for (const choice of script.choices ?? []) {
        expect(choice.hint).toBeTruthy()
        expect(choice.hint).not.toMatch(/\d/)
      }
    }
  })

  it('reset clears checkpoints, queue and flags (§17.22)', () => {
    conseq().markCheckpoint('backup-warning', 'triggered', 5)
    conseq().queueConsequenceOnce('backup-warning-scene')
    conseq().setBaselineReviewCompleted()
    conseq().resetConsequences()
    expect(conseq().checkpoints['backup-warning'].status).toBe('pending')
    expect(conseq().pendingConsequenceIds).toHaveLength(0)
    expect(conseq().baselineSecurityReviewCompleted).toBe(false)
  })
})
