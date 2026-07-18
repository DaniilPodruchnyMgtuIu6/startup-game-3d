import { useEffect, useRef } from 'react'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { canTriggerOfficeIntrusion } from './accessControlRules'

// The single coordinator for the office-intrusion scene (Feature 10). Mounted
// once at the top game level, it launches the scene the moment the intrusion is
// pending and the UI is free - after the daily report and any follow-up audit,
// before the sprint review. Contains no scene dialogue.
export function OfficeIntrusionTrigger() {
  const intrusionStatus = useAccessControlStore((s) => s.intrusion.status)
  const resultPending = useAccessControlStore((s) => s.intrusionResultToAcknowledge !== null)
  const gamePhase = useGameStore((s) => s.phase)
  const isCutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const isServerMinigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const isFollowUpAuditActive = useSecurityAuditStore((s) => isFollowUpAuditBlocking(s.followUpAudit))
  const financeOpen = useEconomyStore((s) => s.panelOpen)
  const teamOpen = useTeamStore((s) => s.panelOpen)
  const boardOpen = useProductStore((s) => s.boardOpen)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const prototypeOpen = useProductStore((s) => s.prototypeOpen)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  const allowed =
    gamePhase === 'free' &&
    !resultPending &&
    canTriggerOfficeIntrusion({
      intrusionStatus,
      isDailyReportOpen: dailyReportOpen,
      isFollowUpAuditActive,
      isCutsceneRunning,
      isServerMinigameOpen,
      isBlockingOverlayOpen: financeOpen || teamOpen || boardOpen || prototypeOpen,
      isBlockingDialogueOpen: activeDialogue || activeChoice,
    })

  const firing = useRef(false)
  useEffect(() => {
    if (!allowed) {
      firing.current = false
      return
    }
    if (firing.current) return
    firing.current = true
    useCutsceneStore.getState().startScene('office-intrusion')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  return null
}
