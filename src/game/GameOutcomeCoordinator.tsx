import { useEffect } from 'react'
import { useGameStore } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useProductStore } from './productStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { isOfficeIntrusionBlocking } from './accessControlRules'
import { useServerIncidentStore } from './serverIncidentStore'
import { anyServerIncidentBlocking } from './serverIncidentRules'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { registerGameFailureIfNeeded } from './registerGameFailure'

// Feature 12 outcome coordinator. It does NOT compute failure reasons — the
// use-case does that. At a safe moment (all mandatory UI free) it (a) re-runs
// the failure check so a defeat from an out-of-workday transaction (e.g. an
// audit fine or incident cost, applied under a result overlay) is registered
// once that overlay closes, and (b) opens the game-over screen for a pending
// failure. Fires once per safe-moment edge, like the other triggers.
export function GameOutcomeCoordinator() {
  const status = useGameOutcomeStore((s) => s.status)
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const auditBlocking = useSecurityAuditStore((s) => isFollowUpAuditBlocking(s.followUpAudit))
  const auditResult = useSecurityAuditStore((s) => s.auditResultToAcknowledge !== null)
  const intrusionBlocking = useAccessControlStore((s) => isOfficeIntrusionBlocking(s.intrusion))
  const intrusionResult = useAccessControlStore((s) => s.intrusionResultToAcknowledge !== null)
  const serverBlocking = useServerIncidentStore((s) => anyServerIncidentBlocking(Object.values(s.incidents)))
  const serverResult = useServerIncidentStore((s) => s.incidentResultToAcknowledge !== null)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const minigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  const safe =
    gamePhase === 'free' &&
    !dailyReportOpen &&
    !auditBlocking &&
    !auditResult &&
    !intrusionBlocking &&
    !intrusionResult &&
    !serverBlocking &&
    !serverResult &&
    !cutsceneRunning &&
    !minigameOpen &&
    !activeDialogue &&
    !activeChoice

  // Runs when a safe-moment input changes (not every render). The catch-all
  // register covers a defeat caused by an out-of-workday transaction that was
  // applied under a result overlay; the open step promotes any pending failure
  // to the game-over screen. markFailureScreenOpened / registerGameFailureIfNeeded
  // are both idempotent, so a re-run after the status flips settles without loops.
  useEffect(() => {
    if (!safe) return
    if (useGameOutcomeStore.getState().status === 'playing') {
      registerGameFailureIfNeeded('outcome-coordinator:safe-moment', { sprintNumber, day })
    }
    if (useGameOutcomeStore.getState().status === 'failure-pending') {
      useGameOutcomeStore.getState().markFailureScreenOpened()
    }
  }, [safe, sprintNumber, day, status])

  return null
}
