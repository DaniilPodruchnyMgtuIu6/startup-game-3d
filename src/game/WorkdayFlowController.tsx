import { useEffect, useState } from 'react'
import { useGameStore } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useProductStore } from './productStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { isOfficeIntrusionBlocking } from './accessControlRules'
import { useServerIncidentStore } from './serverIncidentStore'
import { anyServerIncidentBlocking } from './serverIncidentRules'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useCharacterStore } from '../character/characterStore'
import { isPostAuditConversationRequired } from './securityStoryRules'
import { completeWorkday, canCompleteCurrentWorkday } from './completeWorkday'
import { canAutoAdvanceWorkday, getDailyBeat, type WorkdayFlowContext, type DailyBeat } from './workdayFlow'
import '../ui/ui.css'

// Feature 16 §1: the living Workday Flow. While the sprint is active and nothing
// mandatory is open, each day plays a short observable beat and then the day
// advances AUTOMATICALLY through the single completeWorkday use-case — no manual
// button. Opening a panel/dialogue, a pending mandatory event or the daily report
// pauses the flow (event priority), so the day never advances under the player.

const BEAT_MS: Record<DailyBeat['kind'], number> = {
  kickoff: 4500,
  'mid-sprint': 3500,
  'pre-review': 3500,
  quiet: 3200,
}

function currentFlowContext(): WorkdayFlowContext {
  const product = useProductStore.getState()
  const busy =
    useCharacterStore.getState().inputLocked ||
    useGameStore.getState().activeDialogue !== null ||
    useGameStore.getState().activeChoice !== null ||
    useCutsceneStore.getState().activeSceneId !== null ||
    useServerIncidentsStore.getState().activeMinigame !== null ||
    product.activeReport !== null ||
    product.boardOpen ||
    product.prototypeOpen ||
    product.releaseCheckOpen ||
    useEconomyStore.getState().panelOpen ||
    useTeamStore.getState().panelOpen
  return {
    gamePhase: useGameStore.getState().phase,
    sprintPhase: useSprintStore.getState().phase,
    outcomeBlocking: useGameOutcomeStore.getState().status !== 'playing',
    busy,
    requiredStoryPending: isPostAuditConversationRequired(useSecurityStoryStore.getState().postAuditConversation),
    followUpAuditBlocking: isFollowUpAuditBlocking(useSecurityAuditStore.getState().followUpAudit),
    officeIntrusionBlocking: isOfficeIntrusionBlocking(useAccessControlStore.getState().intrusion),
    serverIncidentBlocking: anyServerIncidentBlocking(Object.values(useServerIncidentStore.getState().incidents)),
  }
}

// Auto-complete the day through the SAME use-case the dev button uses. Sets the
// confirm flag and completes synchronously, so the confirm dialog never renders
// and completeWorkday's idempotency (one report/charge per day) is preserved.
export function autoCompleteWorkday(): void {
  useSprintStore.setState({ confirmingEndDay: true })
  if (!canCompleteCurrentWorkday()) {
    useSprintStore.setState({ confirmingEndDay: false })
    return
  }
  completeWorkday()
}

export function WorkdayFlowController() {
  // Subscribe to every slice that changes the flow context, so the effect re-runs
  // whenever the day may start/stop advancing.
  const gamePhase = useGameStore((s) => s.phase)
  const sprintPhase = useSprintStore((s) => s.phase)
  const day = useSprintStore((s) => s.day)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  useGameStore((s) => s.activeDialogue)
  useGameStore((s) => s.activeChoice)
  useCharacterStore((s) => s.inputLocked)
  useCutsceneStore((s) => s.activeSceneId)
  useServerIncidentsStore((s) => s.activeMinigame)
  useProductStore((s) => s.activeReport)
  useProductStore((s) => s.boardOpen)
  useProductStore((s) => s.prototypeOpen)
  useProductStore((s) => s.releaseCheckOpen)
  useEconomyStore((s) => s.panelOpen)
  useTeamStore((s) => s.panelOpen)
  useGameOutcomeStore((s) => s.status)
  useSecurityStoryStore((s) => s.postAuditConversation.status)
  useSecurityAuditStore((s) => s.followUpAudit)
  useAccessControlStore((s) => s.intrusion)
  useServerIncidentStore((s) => s.incidents)

  const [beat, setBeat] = useState<DailyBeat | null>(null)
  const canAdvance = canAutoAdvanceWorkday(currentFlowContext())

  useEffect(() => {
    if (!canAdvance) {
      setBeat(null)
      return
    }
    const dayBeat = getDailyBeat(sprintNumber, day)
    setBeat(dayBeat)
    const timer = setTimeout(() => {
      // re-check at fire time — guards may have changed since the beat started
      if (canAutoAdvanceWorkday(currentFlowContext())) autoCompleteWorkday()
    }, BEAT_MS[dayBeat.kind])
    return () => {
      clearTimeout(timer)
      setBeat(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdvance, sprintNumber, day])

  if (gamePhase !== 'free' || sprintPhase !== 'active' || !beat) return null
  return (
    <div className={`workday-beat workday-beat--${beat.kind}`}>
      <div className="workday-beat-title">{beat.title}</div>
      <div className="workday-beat-text">{beat.text}</div>
      <div className="workday-beat-progress" aria-hidden />
    </div>
  )
}
