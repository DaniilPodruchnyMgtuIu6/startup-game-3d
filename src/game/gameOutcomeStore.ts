import { create } from 'zustand'
import { isIntroReset } from './gameStore'
import { useRiskStore } from './riskStore'
import { leadershipReviewRecoveredSignals } from './riskSignals'
import { riskMomentAt } from './riskContext'
import type { StoryMoment } from './securityStoryRules'
import {
  LEADERSHIP_GRACE_PERIOD_DAYS,
  initialGameOutcome,
  isLeadershipSuspensionDue,
  normalizeGameOutcome,
  type GameFailureSnapshot,
  type GameOutcomeData,
  type LeadershipReviewStatus,
} from './gameOutcomeRules'
import { canRegisterSuccess, type CampaignSuccessSnapshot } from './mvpReleaseRules'

// Feature 12 outcome state: the four defeat conditions, the leadership grace
// period and the campaign deadline. Its own localStorage key so a failure (and
// its immutable snapshot) survives a reload. The pure math lives in
// gameOutcomeRules; the register use-case (registerGameFailure) gathers the
// evaluation snapshot from the other stores and calls registerPendingFailure.

const GAME_OUTCOME_STORAGE_KEY = 'startup-office-game-outcome'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadGameOutcome(storage: Storage | null, search: string): GameOutcomeData {
  if (isIntroReset(search)) {
    storage?.removeItem(GAME_OUTCOME_STORAGE_KEY)
    return initialGameOutcome()
  }
  if (!storage) return initialGameOutcome()
  const raw = storage.getItem(GAME_OUTCOME_STORAGE_KEY)
  if (!raw) return initialGameOutcome()
  try {
    return normalizeGameOutcome(JSON.parse(raw))
  } catch {
    return initialGameOutcome()
  }
}

export function saveGameOutcome(storage: Storage | null, data: GameOutcomeData): void {
  try {
    storage?.setItem(GAME_OUTCOME_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode — restarts fresh next time
  }
}

export interface RegisterFailureResult {
  registered: boolean
}
export interface RegisterSuccessResult {
  registered: boolean
}
export interface StoryTransitionResult {
  changed: boolean
}
export interface LeadershipReviewResolutionContext {
  currentWorkdayIndex: number
  allFindingsClosed: boolean
  moment: StoryMoment
}
export interface LeadershipReviewResolutionResult {
  status: LeadershipReviewStatus
  changed: boolean
}

interface GameOutcomeStore extends GameOutcomeData {
  registerPendingFailure: (snapshot: GameFailureSnapshot) => RegisterFailureResult
  markFailureScreenOpened: () => void
  startLeadershipGracePeriod: (currentWorkdayIndex: number) => StoryTransitionResult
  resolveLeadershipReview: (context: LeadershipReviewResolutionContext) => LeadershipReviewResolutionResult
  markCampaignDeadlineMet: (moment: StoryMoment) => StoryTransitionResult
  markCampaignDeadlineMissed: () => StoryTransitionResult
  markMvpReleaseRunning: (moment: StoryMoment) => StoryTransitionResult
  registerPendingSuccess: (snapshot: CampaignSuccessSnapshot) => RegisterSuccessResult
  markSuccessScreenOpened: () => void
  markMvpReleaseFailed: () => void
  resetGameOutcome: () => void
}

const initial = loadGameOutcome(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameOutcomeStore = create<GameOutcomeStore>()((set, get) => {
  const persist = () =>
    saveGameOutcome(safeStorage(), {
      status: get().status,
      pendingFailure: get().pendingFailure,
      failure: get().failure,
      pendingSuccess: get().pendingSuccess,
      success: get().success,
      leadershipReview: get().leadershipReview,
      campaignDeadline: get().campaignDeadline,
      campaignRelease: get().campaignRelease,
    })

  return {
    ...initial,

    // Register a defeat exactly once. Ignored if a failure is already pending or
    // final — the first registered reason wins and its snapshot is immutable.
    registerPendingFailure: (snapshot) => {
      if (get().status !== 'playing') return { registered: false }
      set({ status: 'failure-pending', pendingFailure: snapshot })
      persist()
      return { registered: true }
    },

    // The coordinator calls this at a safe moment to open the game-over screen.
    markFailureScreenOpened: () => {
      const { status, pendingFailure } = get()
      if (status !== 'failure-pending' || !pendingFailure) return
      set({ status: 'failed', failure: pendingFailure, pendingFailure: undefined })
      persist()
    },

    // Third failed audit → five future completed working days to close findings.
    // Idempotent: a repeated call never re-arms or moves the deadline.
    startLeadershipGracePeriod: (currentWorkdayIndex) => {
      if (get().leadershipReview.status !== 'inactive') return { changed: false }
      set({
        leadershipReview: {
          status: 'grace-period',
          startedAtWorkdayIndex: currentWorkdayIndex,
          dueWorkdayIndex: currentWorkdayIndex + LEADERSHIP_GRACE_PERIOD_DAYS,
        },
      })
      persist()
      return { changed: true }
    },

    // Evaluated on each completed day while in grace. Closing every finding (any
    // time up to the due day) recovers; an open finding on/after the due day fails.
    resolveLeadershipReview: (context) => {
      const review = get().leadershipReview
      if (review.status !== 'grace-period') return { status: review.status, changed: false }
      if (context.allFindingsClosed) {
        set({ leadershipReview: { ...review, status: 'recovered', recoveredAt: context.moment } })
        useRiskStore
          .getState()
          .addSignalsOnce(leadershipReviewRecoveredSignals(riskMomentAt(context.moment.sprintNumber, context.moment.day)))
        persist()
        return { status: 'recovered', changed: true }
      }
      if (review.dueWorkdayIndex !== undefined && isLeadershipSuspensionDue(context.currentWorkdayIndex, review.dueWorkdayIndex)) {
        set({ leadershipReview: { ...review, status: 'failed' } })
        persist()
        return { status: 'failed', changed: true }
      }
      return { status: 'grace-period', changed: false }
    },

    markCampaignDeadlineMet: (moment) => {
      const cd = get().campaignDeadline
      if (cd.status !== 'active') return { changed: false }
      set({ campaignDeadline: { ...cd, status: 'met', metAt: moment } })
      persist()
      return { changed: true }
    },

    markCampaignDeadlineMissed: () => {
      const cd = get().campaignDeadline
      if (cd.status !== 'active') return { changed: false }
      set({ campaignDeadline: { ...cd, status: 'missed' } })
      persist()
      return { changed: true }
    },

    // Feature 13: the player-confirmed MVP release scene has started.
    markMvpReleaseRunning: (moment) => {
      if (get().status !== 'playing' || get().campaignRelease.status !== 'not-started') return { changed: false }
      set({ campaignRelease: { status: 'running', startedAt: moment } })
      persist()
      return { changed: true }
    },

    // Register a campaign win exactly once. Rejected over a pending/final failure
    // or an existing success (first final outcome wins; failure has priority).
    registerPendingSuccess: (snapshot) => {
      if (!canRegisterSuccess(get().status)) return { registered: false }
      set({ status: 'success-pending', pendingSuccess: snapshot })
      persist()
      return { registered: true }
    },

    // The coordinator calls this at a safe moment to open the campaign-success
    // screen; the immutable snapshot backs it and the release is marked released.
    markSuccessScreenOpened: () => {
      const { status, pendingSuccess, campaignRelease } = get()
      if (status !== 'success-pending' || !pendingSuccess) return
      set({
        status: 'succeeded',
        success: pendingSuccess,
        pendingSuccess: undefined,
        campaignRelease: { ...campaignRelease, status: 'released', releasedAt: pendingSuccess.releasedAt },
      })
      persist()
    },

    // The release scene threw: rewind the release so the player can retry. A
    // deadline already marked met during an early release is kept (§10).
    markMvpReleaseFailed: () => {
      if (get().campaignRelease.status !== 'running') return
      set({ campaignRelease: { status: 'not-started' } })
      persist()
    },

    resetGameOutcome: () => {
      // Explicit undefined so a stale pending/final snapshot cannot survive the
      // shallow merge zustand's set performs.
      set({ ...initialGameOutcome(), pendingFailure: undefined, failure: undefined, pendingSuccess: undefined, success: undefined })
      persist()
    },
  }
})
