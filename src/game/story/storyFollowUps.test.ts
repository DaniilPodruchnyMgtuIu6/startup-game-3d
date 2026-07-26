import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import {
  applyStoryFollowUpsForWorkday,
  ensureInternalReviewStarted,
  BASELINE_AUDIT_RESULT_TASK,
  INTERNAL_REVIEW_TASK,
  BACKUP_WARNING_TASK,
  INTERNAL_REVIEW_ASSIGNMENT_ID,
  MISSED_HIRE_DEADLINE_SIGNAL_ID,
} from './storyFollowUps'
import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useRiskStore } from '../riskStore'
import { useSprintStore } from '../sprintStore'
import { STORY_BALANCE } from '../balance/storyBalance'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { toWorkdayIndex } from '../workdayIndex'
import { BOARD_TASKS } from '../tasks'

const story = () => useStoryDecisionStore.getState()
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
})

describe('external audit result (scene 1, audit path)', () => {
  it('the result task closes after the balance delay, not before', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'commission-security-audit', M) // adds the task
    followUpsAt(M_INDEX + STORY_BALANCE.baselineAudit.resultDelayWorkdays - 1)
    expect(taskDone(BASELINE_AUDIT_RESULT_TASK.id)).toBe(false)
    followUpsAt(M_INDEX + STORY_BALANCE.baselineAudit.resultDelayWorkdays)
    expect(taskDone(BASELINE_AUDIT_RESULT_TASK.id)).toBe(true)
  })
})

describe('internal review (scene 1, hire-first path)', () => {
  it('starts on the real hire, occupies Ilya and closes when his work finishes', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    ensureInternalReviewStarted()
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(false) // no hire yet

    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    ensureInternalReviewStarted()
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(true)
    expect(useStoryWorkStore.getState().isEmployeeBusy('ilya-vlasov')).toBe(true)

    followUpsAt(M_INDEX + 1, [INTERNAL_REVIEW_ASSIGNMENT_ID])
    expect(taskDone(INTERNAL_REVIEW_TASK.id)).toBe(true)
  })

  it('a hire missed past the deadline raises governance exactly once', () => {
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    const deadline = M_INDEX + STORY_BALANCE.internalSecurityReview.hireDeadlineWorkdays
    followUpsAt(deadline - 1)
    expect(useRiskStore.getState().signals.some((s) => s.id === MISSED_HIRE_DEADLINE_SIGNAL_ID)).toBe(false)
    followUpsAt(deadline)
    followUpsAt(deadline + 1) // repeated days never duplicate the signal
    const matches = useRiskStore.getState().signals.filter((s) => s.id === MISSED_HIRE_DEADLINE_SIGNAL_ID)
    expect(matches).toHaveLength(1)
    expect(matches[0].impact).toBe(STORY_BALANCE.internalSecurityReview.missedDeadlineGovernanceImpact)
  })
})

describe('postponed backups warning (scene 5)', () => {
  it('the warning task appears after the delay and only once', () => {
    story().unlockDecision('backup-and-restore-strategy', M)
    story().resolveDecision('backup-and-restore-strategy', 'postpone-backup-work', M)
    followUpsAt(M_INDEX + STORY_BALANCE.backupRestore.postponeWarningDelayWorkdays - 1)
    expect(tasks().some((t) => t.id === BACKUP_WARNING_TASK.id)).toBe(false)
    followUpsAt(M_INDEX + STORY_BALANCE.backupRestore.postponeWarningDelayWorkdays)
    followUpsAt(M_INDEX + STORY_BALANCE.backupRestore.postponeWarningDelayWorkdays + 1)
    expect(tasks().filter((t) => t.id === BACKUP_WARNING_TASK.id)).toHaveLength(1)
  })
})

describe('migrated baseline records skip every follow-up', () => {
  it('no audit task, no review, no deadline signal for a legacy save', () => {
    story().recordLegacyBaselineResolution('approve-security-hire', M)
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    followUpsAt(M_INDEX + 10)
    expect(tasks().some((t) => t.id === INTERNAL_REVIEW_TASK.id)).toBe(false)
    expect(useRiskStore.getState().signals).toHaveLength(0)
  })
})
