import { create } from 'zustand'
import { isIntroReset } from './gameStore'
import { isSignalDue, normalizeRiskSignals, type RiskSignal } from './riskRules'

// The hidden-risk signal store (Feature 09). Its own store and localStorage key
// so the sprint/economy/product/team/story/audit saves are untouched. Signals
// are immutable facts - only their detection/acknowledgement fields are ever
// filled in, and only forward (a signal is never removed or rewritten). All
// scoring lives in riskRules so it stays deterministic and testable.

const RISK_STORAGE_KEY = 'startup-office-risk'

type RiskStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): RiskStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadRisk(storage: RiskStorage | null, search: string): RiskSignal[] {
  if (isIntroReset(search)) {
    storage?.removeItem(RISK_STORAGE_KEY)
    return []
  }
  if (!storage) return []
  const raw = storage.getItem(RISK_STORAGE_KEY)
  if (!raw) return []
  try {
    return normalizeRiskSignals((JSON.parse(raw) as { signals?: unknown }).signals)
  } catch {
    return []
  }
}

export function saveRisk(storage: RiskStorage | null, signals: RiskSignal[]): void {
  try {
    storage?.setItem(RISK_STORAGE_KEY, JSON.stringify({ signals }))
  } catch {
    // private mode - risks simply restart empty next time
  }
}

export interface AddRiskSignalsResult {
  added: RiskSignal[]
}
export interface DetectRiskSignalsResult {
  detected: RiskSignal[]
}

interface RiskStore {
  signals: RiskSignal[]
  addSignalsOnce: (signals: RiskSignal[]) => AddRiskSignalsResult
  detectDueSignals: (currentWorkdayIndex: number, hasSecuritySpecialist: boolean) => DetectRiskSignalsResult
  acknowledgeDetectedSignals: (currentWorkdayIndex: number) => void
  resetRisks: () => void
}

const initial = loadRisk(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useRiskStore = create<RiskStore>()((set, get) => {
  const persist = () => saveRisk(safeStorage(), get().signals)

  return {
    signals: initial,

    // Append only signals whose id is not already present; existing signals are
    // never overwritten (their detection/history is preserved). Also dedupes ids
    // within the incoming batch.
    addSignalsOnce: (incoming) => {
      const seen = new Set(get().signals.map((s) => s.id))
      const added: RiskSignal[] = []
      for (const s of incoming) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        added.push(s)
      }
      if (added.length === 0) return { added: [] }
      set({ signals: [...get().signals, ...added] })
      persist()
      return { added }
    },

    // Fill detectedAtWorkdayIndex on every signal whose delay has elapsed and
    // which is not yet detected. Returns the signals detected on this call.
    detectDueSignals: (currentWorkdayIndex, hasSecuritySpecialist) => {
      const detected: RiskSignal[] = []
      const signals = get().signals.map((s) => {
        if (s.detectedAtWorkdayIndex !== undefined) return s
        if (!isSignalDue(s, currentWorkdayIndex, hasSecuritySpecialist)) return s
        const next = { ...s, detectedAtWorkdayIndex: currentWorkdayIndex }
        detected.push(next)
        return next
      })
      if (detected.length > 0) {
        set({ signals })
        persist()
      }
      return { detected }
    },

    // Mark every detected-but-unacknowledged signal as acknowledged. Does not
    // change the score or remove anything.
    acknowledgeDetectedSignals: (currentWorkdayIndex) => {
      let changed = false
      const signals = get().signals.map((s) => {
        if (s.detectedAtWorkdayIndex === undefined || s.acknowledgedAtWorkdayIndex !== undefined) return s
        changed = true
        return { ...s, acknowledgedAtWorkdayIndex: currentWorkdayIndex }
      })
      if (changed) {
        set({ signals })
        persist()
      }
    },

    resetRisks: () => {
      set({ signals: [] })
      persist()
    },
  }
})
