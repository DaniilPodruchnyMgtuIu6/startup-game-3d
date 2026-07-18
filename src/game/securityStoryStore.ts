import { create } from 'zustand'
import { useGameStore, isIntroReset } from './gameStore'
import type { BoardTask } from './tasks'
import {
  INITIAL_SECURITY_BREACH,
  getInitialPostAuditConversationState,
  normalizePostAuditConversationState,
  normalizeSecurityStoryState,
  type PostAuditConversationState,
  type SecurityBreachData,
  type SecurityBreachDecision,
  type SecurityStaffingDecision,
  type StoryMoment,
} from './securityStoryRules'

// Story state for the security beats. Its own store and localStorage key so the
// sprint/economy/team/product saves are untouched. The scenes (the cutscene and
// the post-audit conversation) drive these lifecycles, so auto and manual paths
// go through exactly the same states.

const SECURITY_STORAGE_KEY = 'startup-office-security'

// Department tasks the story adds (stable ids -> never duplicated).
export const SECURITY_TRAINING_TASK: BoardTask = {
  id: 'security-training',
  text: 'Проводить курсы по безопасности (регулярно)',
  done: false,
}
export const DISCUSS_AUDIT_TASK: BoardTask = {
  id: 'discuss-security-audit-with-sonya',
  text: 'Обсудить результаты аудита с Соней',
  done: false,
}
export const HIRE_SECURITY_TASK: BoardTask = {
  id: 'hire-security-specialist',
  text: 'Нанять специалиста по информационной безопасности',
  done: false,
}
export const CLOSE_FINDINGS_TASK: BoardTask = {
  id: 'close-security-findings-without-specialist',
  text: 'Закрыть замечания аудита силами команды',
  done: false,
}

type StoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function addTaskOnce(task: BoardTask): void {
  const game = useGameStore.getState()
  if (!game.tasks.some((t) => t.id === task.id)) game.addTask({ ...task })
}

export interface SecurityStoryData {
  securityBreach: SecurityBreachData
  postAuditConversation: PostAuditConversationState
  // Whether Ilya's one-off introduction dialogue has already been shown, so it
  // is not repeated after a reload (Feature 07). A plain flag - no new store.
  hasIntroducedSecuritySpecialist: boolean
}

export function loadSecurityStory(storage: StoryStorage | null, search: string): SecurityStoryData {
  const fresh = (): SecurityStoryData => ({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: getInitialPostAuditConversationState('not-started'),
    hasIntroducedSecuritySpecialist: false,
  })
  if (isIntroReset(search)) {
    storage?.removeItem(SECURITY_STORAGE_KEY)
    return fresh()
  }
  if (!storage) return fresh()
  const raw = storage.getItem(SECURITY_STORAGE_KEY)
  if (!raw) return fresh()
  try {
    const parsed = JSON.parse(raw)
    const securityBreach = normalizeSecurityStoryState(parsed)
    // conversation is normalised against the (already normalised) breach status,
    // and derived from it when absent (Feature 05 -> 06 migration).
    const postAuditConversation = normalizePostAuditConversationState(parsed, securityBreach.status)
    const hasIntroducedSecuritySpecialist = (parsed as { hasIntroducedSecuritySpecialist?: unknown })?.hasIntroducedSecuritySpecialist === true
    return { securityBreach, postAuditConversation, hasIntroducedSecuritySpecialist }
  } catch {
    return fresh()
  }
}

export function saveSecurityStory(storage: StoryStorage | null, data: SecurityStoryData): void {
  try {
    storage?.setItem(SECURITY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode - story simply restarts fresh next time
  }
}

export interface ResolveSecurityDecisionResult {
  applied: boolean
  decision: SecurityBreachDecision
}
export interface ResolveSecurityStaffingResult {
  applied: boolean
  decision: SecurityStaffingDecision
}

interface SecurityStoryStore extends SecurityStoryData {
  // --- security-breach scene (Feature 05) ---
  markSecurityBreachRunning: (moment: StoryMoment) => void
  resolveSecurityBreachDecision: (decision: SecurityBreachDecision) => ResolveSecurityDecisionResult
  markSecurityBreachCompleted: (moment: StoryMoment) => void
  markSecurityBreachFailed: () => void
  // --- post-audit conversation (Feature 06) ---
  unlockPostAuditConversation: () => void
  markPostAuditConversationRunning: (moment: StoryMoment) => void
  resolveSecurityStaffingDecision: (decision: SecurityStaffingDecision) => ResolveSecurityStaffingResult
  markPostAuditConversationCompleted: (moment: StoryMoment) => void
  markPostAuditConversationFailed: () => void
  // --- security specialist (Feature 07) ---
  markSecuritySpecialistIntroduced: () => void
  resetSecurityStory: () => void
}

const initial = loadSecurityStory(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useSecurityStoryStore = create<SecurityStoryStore>()((set, get) => {
  const persist = () =>
    saveSecurityStory(safeStorage(), {
      securityBreach: get().securityBreach,
      postAuditConversation: get().postAuditConversation,
      hasIntroducedSecuritySpecialist: get().hasIntroducedSecuritySpecialist,
    })

  // Move a locked conversation to pending and make sure the objective task
  // exists. Idempotent - safe to call after a reload, migration, or a repeated
  // scene completion.
  const unlock = () => {
    const pa = get().postAuditConversation
    if (pa.status === 'locked') set({ postAuditConversation: { ...pa, status: 'pending' } })
    if (get().postAuditConversation.status === 'pending') addTaskOnce(DISCUSS_AUDIT_TASK)
    persist()
  }

  return {
    ...initial,

    // --- security-breach scene ---
    markSecurityBreachRunning: (moment) => {
      const sb = get().securityBreach
      if (sb.status === 'completed') return
      set({ securityBreach: { ...sb, status: 'running', firstStartedAt: sb.firstStartedAt ?? moment } })
      persist()
    },

    resolveSecurityBreachDecision: (decision) => {
      const sb = get().securityBreach
      const finalDecision = sb.decision ?? decision
      if (sb.effectsApplied) {
        if (!sb.decision) {
          set({ securityBreach: { ...sb, decision: finalDecision } })
          persist()
        }
        return { applied: false, decision: finalDecision }
      }
      const game = useGameStore.getState()
      if (finalDecision === 'blame-project-manager') game.addReprimand()
      addTaskOnce(SECURITY_TRAINING_TASK)
      set({ securityBreach: { ...sb, decision: finalDecision, effectsApplied: true } })
      persist()
      return { applied: true, decision: finalDecision }
    },

    markSecurityBreachCompleted: (moment) => {
      const sb = get().securityBreach
      if (sb.status !== 'completed') {
        set({ securityBreach: { ...sb, status: 'completed', completedAt: sb.completedAt ?? moment } })
      }
      unlock() // opening the post-audit conversation is part of finishing the scene
    },

    markSecurityBreachFailed: () => {
      const sb = get().securityBreach
      if (sb.status !== 'running') return
      set({ securityBreach: { ...sb, status: 'not-started' } })
      persist()
    },

    // --- post-audit conversation ---
    unlockPostAuditConversation: () => unlock(),

    markPostAuditConversationRunning: (moment) => {
      const pa = get().postAuditConversation
      if (pa.status !== 'pending') return
      set({ postAuditConversation: { ...pa, status: 'running', startedAt: pa.startedAt ?? moment } })
      persist()
    },

    resolveSecurityStaffingDecision: (decision) => {
      const pa = get().postAuditConversation
      const finalDecision = pa.staffingDecision ?? decision
      if (pa.effectsApplied) {
        if (!pa.staffingDecision) {
          set({ postAuditConversation: { ...pa, staffingDecision: finalDecision } })
          persist()
        }
        return { applied: false, decision: finalDecision }
      }
      addTaskOnce(finalDecision === 'approve-security-hire' ? HIRE_SECURITY_TASK : CLOSE_FINDINGS_TASK)
      useGameStore.getState().completeTask(DISCUSS_AUDIT_TASK.id)
      set({ postAuditConversation: { ...pa, staffingDecision: finalDecision, effectsApplied: true } })
      persist()
      return { applied: true, decision: finalDecision }
    },

    markPostAuditConversationCompleted: (moment) => {
      const pa = get().postAuditConversation
      if (pa.status === 'completed') return
      set({ postAuditConversation: { ...pa, status: 'completed', completedAt: pa.completedAt ?? moment } })
      persist()
    },

    markPostAuditConversationFailed: () => {
      const pa = get().postAuditConversation
      if (pa.status !== 'running') return
      set({ postAuditConversation: { ...pa, status: 'pending' } })
      persist()
    },

    markSecuritySpecialistIntroduced: () => {
      if (get().hasIntroducedSecuritySpecialist) return
      set({ hasIntroducedSecuritySpecialist: true })
      persist()
    },

    resetSecurityStory: () => {
      set({
        securityBreach: { ...INITIAL_SECURITY_BREACH },
        postAuditConversation: getInitialPostAuditConversationState('not-started'),
        hasIntroducedSecuritySpecialist: false,
      })
      persist()
    },
  }
})
