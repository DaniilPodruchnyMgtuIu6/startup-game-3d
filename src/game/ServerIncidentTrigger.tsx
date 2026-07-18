import { useEffect, useRef } from 'react'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { useServerIncidentStore } from './serverIncidentStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { getNextPendingServerIncident } from './serverIncidentRules'
import { isOfficeIntrusionBlocking } from './accessControlRules'
import type { ServerIncidentId } from './serverIncidentCatalog'

const SCENE_BY_INCIDENT: Record<ServerIncidentId, string> = {
  'gateway-outage': 'server-gateway-outage',
  'auth-account-incident': 'server-auth-account-incident',
  'database-exposure-review': 'server-database-exposure-review',
}

// The single coordinator for the server-incident scenes (Feature 11). Mounted
// once at the top game level, it launches the next pending incident (fixed
// priority: gateway, auth, database) once the daily report, any follow-up audit
// and any office intrusion are done and the UI is otherwise free.
export function ServerIncidentTrigger() {
  const incidents = useServerIncidentStore((s) => s.incidents)
  const resultPending = useServerIncidentStore((s) => s.incidentResultToAcknowledge !== null)
  const gamePhase = useGameStore((s) => s.phase)
  const isCutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const isServerMinigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const isFollowUpAuditActive = useSecurityAuditStore((s) => isFollowUpAuditBlocking(s.followUpAudit))
  const isIntrusionActive = useAccessControlStore((s) => isOfficeIntrusionBlocking(s.intrusion))
  const financeOpen = useEconomyStore((s) => s.panelOpen)
  const teamOpen = useTeamStore((s) => s.panelOpen)
  const boardOpen = useProductStore((s) => s.boardOpen)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const prototypeOpen = useProductStore((s) => s.prototypeOpen)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  const next = getNextPendingServerIncident(Object.values(incidents))
  const allowed =
    !!next &&
    gamePhase === 'free' &&
    !resultPending &&
    !isCutsceneRunning &&
    !isServerMinigameOpen &&
    !isFollowUpAuditActive &&
    !isIntrusionActive &&
    !financeOpen &&
    !teamOpen &&
    !boardOpen &&
    !dailyReportOpen &&
    !prototypeOpen &&
    !activeDialogue &&
    !activeChoice

  const firing = useRef(false)
  useEffect(() => {
    if (!allowed || !next) {
      firing.current = false
      return
    }
    if (firing.current) return
    firing.current = true
    useCutsceneStore.getState().startScene(SCENE_BY_INCIDENT[next.incidentId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, next?.incidentId])

  return null
}
