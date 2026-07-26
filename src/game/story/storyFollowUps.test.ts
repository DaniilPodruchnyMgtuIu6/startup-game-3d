import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
import {
  applyStoryFollowUpsForWorkday,
  ensureInternalReviewStarted,
  INTERNAL_REVIEW_TASK,
  INTERNAL_REVIEW_ASSIGNMENT_ID,
  MISSED_HIRE_DEADLINE_SIGNAL_ID,
} from './storyFollowUps'
import { applyConsequenceEffects } from './storyConsequences'
import { CONFIRM_RESTORE_TASK_ID, LATE_DRILL_ASSIGNMENT_ID } from './level1Checkpoints'
import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useRiskStore } from '../riskStore'
import { useSprintStore } from '../sprintStore'
import { STORY_BALANCE } from '../balance/storyBalance'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { toWorkdayIndex } from '../workdayIndex'
import { BOARD_TASKS } from '../tasks'

const story = () => useStoryDecisionStore.getState()
const conseq = () => useStoryConsequenceStore.getState()
const tasks = () => useGameStore.getState().tasks
const taskDone = (id: string) => tasks().find((t) => t.id === id)?.done
const M = { sprintNumber: 2, day: 2 }
const M_INDEX = toWorkdayIndex(M.sprintNumber, M.day)

const WITH_ILYA = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 },
]

function followUpsAt(index: number, finished: string[] = []) {
  applyStoryFollowUpsForWorkday({ sprintNumber: 2, day: 2, completedWorkdayIndex: index, finishedAssignmentIds: finished })
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: M.sprintNumber, day: M.day, phase: 'active', confirmingEndDay: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useRiskStore.setState({ signals: [] })
  story().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
  conseq().resetConsequences()
})

describe('external audit result (17C §3)', () => {
  it('queues the result scene after the delay; the scene completes the task and the review flag', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'commission-security-audit', M)
    followUpsAt(M_INDEX + STORY_BALANCE.baselineAudit.resultDelayWorkdays - 1)
    expect(conseq().pendingConsequenceIds).not.toContain('baseline-audit-result')
    followUpsAt(M_INDEX + STORY_BALANCE.baselineAudit.resultDelayWorkdays)
    expect(conseq().pendingConsequenceIds).toContain('baseline-audit-result')

    applyConsequenceEffects('baseline-audit-result', M)
    conseq().completeConsequence('baseline-audit-result')
    expect(taskDone('complete-baseline-security-audit')).toBe(true)
    expect(conseq().baselineSecurityReviewCompleted).toBe(true)

    // repeated day never re-queues a completed scene
    followUpsAt(M_INDEX + STORY_BALANCE.baselineAudit.resultDelayWorkdays + 1)
    expect(conseq().pendingConsequenceIds).not.toContain('baseline-audit-result')
  })
})

describe('internal review (17C §3)', () => {
  it('starts on the real hire and lands as its result scene when the work finishes', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    ensureInternalReviewStarted()
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(false) // no hire yet

    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    ensureInternalReviewStarted()
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(true)
    expect(useStoryWorkStore.getState().isEmployeeBusy('ilya-vlasov')).toBe(true)

    followUpsAt(M_INDEX + 1, [INTERNAL_REVIEW_ASSIGNMENT_ID])
    expect(conseq().pendingConsequenceIds).toContain('internal-review-complete')
    applyConsequenceEffects('internal-review-complete', M)
    conseq().completeConsequence('internal-review-complete')
    expect(taskDone(INTERNAL_REVIEW_TASK.id)).toBe(true)
    expect(conseq().baselineSecurityReviewCompleted).toBe(true)
  })

  it('a hire missed past the deadline raises governance exactly once', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    const deadline = M_INDEX + STORY_BALANCE.internalSecurityReview.hireDeadlineWorkdays
    followUpsAt(deadline - 1)
    expect(useRiskStore.getState().signals.some((s) => s.id === MISSED_HIRE_DEADLINE_SIGNAL_ID)).toBe(false)
    followUpsAt(deadline)
    followUpsAt(deadline + 1)
    const matches = useRiskStore.getState().signals.filter((s) => s.id === MISSED_HIRE_DEADLINE_SIGNAL_ID)
    expect(matches).toHaveLength(1)
    expect(matches[0].impact).toBe(STORY_BALANCE.internalSecurityReview.missedDeadlineGovernanceImpact)
  })
})

describe('finished consequence work closes its tasks (17C)', () => {
  it('a finished late restore drill verifies recovery and closes the confirm task', () => {
    useGameStore.getState().addTask({ id: CONFIRM_RESTORE_TASK_ID, text: 'x', done: false })
    followUpsAt(M_INDEX, [LATE_DRILL_ASSIGNMENT_ID])
    expect(conseq().lateRestoreDrillCompleted).toBe(true)
    expect(taskDone(CONFIRM_RESTORE_TASK_ID)).toBe(true)
  })
})

describe('migrated baseline records skip every follow-up', () => {
  it('no audit scene, no review, no deadline signal for a legacy save', () => {
    story().recordLegacyBaselineResolution('approve-security-hire', M)
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    followUpsAt(M_INDEX + 10)
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(false)
    expect(conseq().pendingConsequenceIds).toHaveLength(0)
    expect(useRiskStore.getState().signals).toHaveLength(0)
  })
})
