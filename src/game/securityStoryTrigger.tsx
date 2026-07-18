import { useEffect, useRef } from 'react'
import { useGameStore } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useEconomyStore } from './economyStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { isEmployeeHired } from './teamRules'
import { hasFirstPrototype } from './productRules'
import { canTriggerSecurityBreach, type SecurityBreachTriggerContext } from './securityStoryRules'
import { tryStartSecurityBreach } from './tryStartSecurityBreach'

// Assembles the trigger context from live selectors. Each hook is called
// unconditionally (no short-circuiting) so the rules of hooks hold.
function useTriggerContext(): SecurityBreachTriggerContext {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintPhase = useSprintStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const hasBackendDeveloper = useTeamStore((s) => isEmployeeHired(s.hires, 'kirill-morozov'))
  const hasFrontendDeveloper = useTeamStore((s) => isEmployeeHired(s.hires, 'alina-belova'))
  const prototypeReady = useProductStore((s) => hasFirstPrototype(s.taskStates))
  const securityBreachStatus = useSecurityStoryStore((s) => s.securityBreach.status)
  const isCutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const isServerMinigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)

  const financeOpen = useEconomyStore((s) => s.panelOpen)
  const teamOpen = useTeamStore((s) => s.panelOpen)
  const boardOpen = useProductStore((s) => s.boardOpen)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const prototypeOpen = useProductStore((s) => s.prototypeOpen)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  return {
    gamePhase,
    sprintPhase,
    sprintNumber,
    day,
    hasBackendDeveloper,
    hasFrontendDeveloper,
    hasFirstPrototype: prototypeReady,
    securityBreachStatus,
    isCutsceneRunning,
    isServerMinigameOpen,
    isBlockingOverlayOpen: financeOpen || teamOpen || boardOpen || dailyReportOpen || prototypeOpen,
    isBlockingDialogueOpen: activeDialogue || activeChoice,
  }
}

// The single coordinator for the security-breach story beat. Mounted once at the
// top game level, it watches game state and launches the existing scene the
// moment every condition is met and the UI is free (e.g. right after the daily
// report is closed). It contains no scene dialogue and no event engine.
export function SecurityStoryTrigger() {
  const context = useTriggerContext()
  const allowed = canTriggerSecurityBreach(context)
  const firing = useRef(false)

  useEffect(() => {
    if (!allowed) {
      firing.current = false
      return
    }
    if (firing.current) return // already launched this eligible window
    firing.current = true
    tryStartSecurityBreach(context)
    // context is intentionally not a dep: we only act on the allowed edge; the
    // use-case re-checks eligibility and startScene ignores a duplicate call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  return null
}
