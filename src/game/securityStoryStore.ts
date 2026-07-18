import { create } from 'zustand'
import { useGameStore } from './gameStore'
import { isIntroReset } from './gameStore'
import {
  INITIAL_SECURITY_BREACH,
  normalizeSecurityStoryState,
  type SecurityBreachData,
  type SecurityBreachDecision,
  type StoryMoment,
} from './securityStoryRules'

// Story state for the security-breach beat. Its own store and localStorage key
// so the sprint/economy/team/product saves are untouched. The scene script
// drives this lifecycle, so both the auto-trigger and the manual dev start go
// through exactly the same states.

const SECURITY_STORAGE_KEY = 'startup-office-security'

// The recurring security-training board task the scene adds. Stable id so it is
// never duplicated (idempotent).
export const SECURITY_TRAINING_TASK = {
  id: 'security-training',
  text: 'Проводить курсы по безопасности (регулярно)',
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

export function loadSecurityStory(storage: StoryStorage | null, search: string): SecurityBreachData {
  if (isIntroReset(search)) {
    storage?.removeItem(SECURITY_STORAGE_KEY)
    return { ...INITIAL_SECURITY_BREACH }
  }
  if (!storage) return { ...INITIAL_SECURITY_BREACH }
  const raw = storage.getItem(SECURITY_STORAGE_KEY)
  if (!raw) return { ...INITIAL_SECURITY_BREACH }
  try {
    return normalizeSecurityStoryState(JSON.parse(raw))
  } catch {
    return { ...INITIAL_SECURITY_BREACH }
  }
}

export function saveSecurityStory(storage: StoryStorage | null, securityBreach: SecurityBreachData): void {
  try {
    storage?.setItem(SECURITY_STORAGE_KEY, JSON.stringify({ securityBreach }))
  } catch {
    // private mode - story simply restarts not-started next time
  }
}

export interface ResolveSecurityDecisionResult {
  applied: boolean
  decision: SecurityBreachDecision
}

interface SecurityStoryStore {
  securityBreach: SecurityBreachData
  markSecurityBreachRunning: (moment: StoryMoment) => void
  // Saves the decision once and applies its side-effects exactly once.
  resolveSecurityBreachDecision: (decision: SecurityBreachDecision) => ResolveSecurityDecisionResult
  markSecurityBreachCompleted: (moment: StoryMoment) => void
  markSecurityBreachFailed: () => void
  resetSecurityStory: () => void
}

const initial = loadSecurityStory(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useSecurityStoryStore = create<SecurityStoryStore>()((set, get) => {
  const persist = () => saveSecurityStory(safeStorage(), get().securityBreach)

  return {
    securityBreach: initial,

    markSecurityBreachRunning: (moment) => {
      const sb = get().securityBreach
      if (sb.status === 'completed') return
      set({ securityBreach: { ...sb, status: 'running', firstStartedAt: sb.firstStartedAt ?? moment } })
      persist()
    },

    resolveSecurityBreachDecision: (decision) => {
      const sb = get().securityBreach
      const finalDecision = sb.decision ?? decision // decision is written once
      if (sb.effectsApplied) {
        if (!sb.decision) {
          set({ securityBreach: { ...sb, decision: finalDecision } })
          persist()
        }
        return { applied: false, decision: finalDecision }
      }
      // apply the idempotent side-effects exactly once
      const game = useGameStore.getState()
      if (finalDecision === 'blame-project-manager') game.addReprimand()
      if (!game.tasks.some((t) => t.id === SECURITY_TRAINING_TASK.id)) game.addTask({ ...SECURITY_TRAINING_TASK })
      set({ securityBreach: { ...sb, decision: finalDecision, effectsApplied: true } })
      persist()
      return { applied: true, decision: finalDecision }
    },

    markSecurityBreachCompleted: (moment) => {
      const sb = get().securityBreach
      if (sb.status === 'completed') return // completed is final
      set({ securityBreach: { ...sb, status: 'completed', completedAt: sb.completedAt ?? moment } })
      persist()
    },

    markSecurityBreachFailed: () => {
      const sb = get().securityBreach
      if (sb.status !== 'running') return
      set({ securityBreach: { ...sb, status: 'not-started' } })
      persist()
    },

    resetSecurityStory: () => {
      set({ securityBreach: { ...INITIAL_SECURITY_BREACH } })
      persist()
    },
  }
})
