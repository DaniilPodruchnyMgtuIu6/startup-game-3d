import { useEffect, useRef } from 'react'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore } from './securityAuditStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { initializeSecurityAuditIfReady } from './initializeSecurityAudit'

// The single coordinator for the follow-up audit (Feature 08). Mounted once at
// the top game level, it (a) creates the corrective-action plan the moment the
// post-audit conversation is completed, and (b) launches the follow-up audit
// scene the moment the audit is pending and the UI is free (e.g. right after the
// daily report is closed). It contains no scene dialogue and no event engine.
export function SecurityFollowUpAuditTrigger() {
  // (a) initialise the plan once the conversation is completed (idempotent)
  const conversationCompleted = useSecurityStoryStore((s) => s.postAuditConversation.status === 'completed')
  useEffect(() => {
    if (conversationCompleted) initializeSecurityAuditIfReady()
  }, [conversationCompleted])

  // (b) fire the follow-up audit scene when pending and nothing else owns the UI
  const auditStatus = useSecurityAuditStore((s) => s.followUpAudit.status)
  const resultPending = useSecurityAuditStore((s) => s.auditResultToAcknowledge !== null)
  const gamePhase = useGameStore((s) => s.phase)
  const isCutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const isServerMinigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const financeOpen = useEconomyStore((s) => s.panelOpen)
  const teamOpen = useTeamStore((s) => s.panelOpen)
  const boardOpen = useProductStore((s) => s.boardOpen)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const prototypeOpen = useProductStore((s) => s.prototypeOpen)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  const allowed =
    auditStatus === 'pending' &&
    gamePhase === 'free' &&
    !resultPending &&
    !isCutsceneRunning &&
    !isServerMinigameOpen &&
    !financeOpen &&
    !teamOpen &&
    !boardOpen &&
    !dailyReportOpen &&
    !prototypeOpen &&
    !activeDialogue &&
    !activeChoice

  const firing = useRef(false)
  useEffect(() => {
    if (!allowed) {
      firing.current = false
      return
    }
    if (firing.current) return
    firing.current = true
    useCutsceneStore.getState().startScene('security-follow-up-audit')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  return null
}
