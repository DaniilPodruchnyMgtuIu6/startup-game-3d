import { useEffect, useRef, useState } from 'react'
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
import { useStoryDecisionStore } from './story/storyDecisionStore'
import { isStoryDecisionBlockingNow } from './story/storyDecisionSelectors'
import { useStoryConsequenceStore } from './story/storyConsequenceStore'
import { isStoryConsequencePending } from './story/storyConsequences'
import { completeWorkday, canCompleteCurrentWorkday } from './completeWorkday'
import {
  canAutoAdvanceWorkday,
  shouldOpenSprintKickoff,
  securityBreachStillDue,
  getDailyBeat,
  type WorkdayFlowContext,
  type DailyBeat,
  type DailyBeatContext,
} from './workdayFlow'
import { buildSprintKickoffDialogue, type SprintKickoffContext } from './sprintKickoff'
import { pickNpcAmbientConversation, type NpcAmbientContext } from './npcAmbientConversation'
import { useNpcAmbientStore } from './npcAmbientStore'
import { useRiskStore } from './riskStore'
import { RISK_DOMAINS } from './riskCatalog'
import { getDetectedRiskLevel } from './riskRules'
import { getEmployee, DEVELOPER_CATALOG, PROJECT_MANAGER, SECURITY_SPECIALIST_ID } from './teamCatalog'
import { getProductTask } from './productTaskCatalog'
import { plannedLoadForEmployee, completedInSprint, incompletePlanned, productReadiness, hasFirstPrototype } from './productRules'
import { hasSecuritySpecialist } from './teamRules'
import { getCharacterById } from '../character/characters'
import { femalePm } from '../character/characters/femalePm'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { beginConversationCinematic } from './cinematics/cinematicDirector'
import { KICKOFF_SLOTS, gatherParticipants } from './cinematics/meetingSlots'
import '../ui/ui.css'

// Feature 16 §2: the kickoff/beat content is built from the LIVE sprint plan.
function buildKickoffContext(): SprintKickoffContext {
  const states = useProductStore.getState().taskStates
  const developers = DEVELOPER_CATALOG.map((e) => {
    const first = states
      .filter((s) => getProductTask(s.taskId)?.assigneeEmployeeId === e.id && (s.status === 'planned' || s.status === 'in-progress'))
      .sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0))[0]
    return {
      name: e.name,
      role: e.roleLabel,
      portrait: getCharacterById(e.characterId)?.portrait,
      firstTask: first ? getProductTask(first.taskId)?.title : undefined,
      load: plannedLoadForEmployee(states, e.id),
    }
  })
  const overloaded = DEVELOPER_CATALOG.some((e) => plannedLoadForEmployee(states, e.id) > 10)
  const ilya = getEmployee(SECURITY_SPECIALIST_ID)
  const ilyaHired = hasSecuritySpecialist(useTeamStore.getState().hires)
  return {
    sprintNumber: useSprintStore.getState().sprintNumber,
    pm: { name: PROJECT_MANAGER.name, role: PROJECT_MANAGER.roleLabel, portrait: femalePm.portrait },
    developers,
    overloaded,
    specialist:
      ilyaHired && ilya
        ? {
            name: ilya.name,
            role: ilya.roleLabel,
            portrait: ilyaVlasov.portrait,
            openFindings: useSecurityAuditStore.getState().findings.filter((f) => f.status !== 'closed').length,
          }
        : undefined,
  }
}

function buildDailyBeatContext(): DailyBeatContext {
  const states = useProductStore.getState().taskStates
  const sprintNumber = useSprintStore.getState().sprintNumber
  return {
    readiness: productReadiness(states),
    completedThisSprint: completedInSprint(states, sprintNumber).length,
    plannedRemaining: incompletePlanned(states, sprintNumber).length,
  }
}

// Feature 16 §8: the player-visible facts that pick the day's colleague
// conversation. All derivable from what the player can already see — no hidden
// (actual) risk leaks in, only DETECTED risk (§14 rule).
function buildAmbientContext(): NpcAmbientContext {
  const states = useProductStore.getState().taskStates
  const signals = useRiskStore.getState().signals
  const incidents = Object.values(useServerIncidentStore.getState().incidents)
  const access = useAccessControlStore.getState()
  const sprint = useSprintStore.getState()
  return {
    ilyaHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    overloadedDev: DEVELOPER_CATALOG.some((e) => plannedLoadForEmployee(states, e.id) > 10),
    detectedHighRisk: RISK_DOMAINS.some((d) => {
      const level = getDetectedRiskLevel(signals, d)
      return level === 'high' || level === 'critical'
    }),
    serverRecoveryActive: incidents.some((i) => i.status === 'recovery-required' || i.status === 'recovering'),
    accessControlDecisionPending:
      access.accessControl.proposalStatus === 'available' || access.accessControl.proposalStatus === 'postponed',
    intrusionArmed: access.intrusion.status === 'armed',
    readiness: productReadiness(states),
    day: sprint.day,
    sprintNumber: sprint.sprintNumber,
    playedIds: useNpcAmbientStore.getState().playedIds,
  }
}

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

// Short pause after a colleague conversation ends before the day is completed.
const POST_CONVERSATION_MS = 900

export function currentFlowContext(): WorkdayFlowContext {
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
    useTeamStore.getState().panelOpen ||
    // A resolved scene leaves a result overlay the player must acknowledge; the
    // event itself is no longer "blocking", so without these the day would
    // auto-advance behind the overlay the player is still reading (§10).
    useSecurityAuditStore.getState().auditResultToAcknowledge !== null ||
    useAccessControlStore.getState().intrusionResultToAcknowledge !== null ||
    useServerIncidentStore.getState().incidentResultToAcknowledge !== null ||
    // §8: an NPC↔NPC conversation is this day's beat — the day waits for it
    useNpcAmbientStore.getState().active !== null
  return {
    gamePhase: useGameStore.getState().phase,
    sprintPhase: useSprintStore.getState().phase,
    outcomeBlocking: useGameOutcomeStore.getState().status !== 'playing',
    busy,
    requiredStoryPending:
      isPostAuditConversationRequired(useSecurityStoryStore.getState().postAuditConversation) ||
      // Feature 17A §7: a pending mandatory story decision pauses the flow too.
      isStoryDecisionBlockingNow() ||
      // Feature 17C: an unheld consequence scene pauses it as well.
      isStoryConsequencePending(),
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
  useStoryDecisionStore((s) => s.activeDecisionId)
  useStoryConsequenceStore((s) => s.pendingConsequenceIds)
  useStoryConsequenceStore((s) => s.runningConsequenceId)
  useSecurityAuditStore((s) => s.followUpAudit)
  useAccessControlStore((s) => s.intrusion)
  useServerIncidentStore((s) => s.incidents)
  // Result-acknowledge overlays also pause the flow (Bug A): re-run when one
  // opens or is acknowledged, and when the kickoff marker changes (Bug B).
  useSecurityAuditStore((s) => s.auditResultToAcknowledge)
  useAccessControlStore((s) => s.intrusionResultToAcknowledge)
  useServerIncidentStore((s) => s.incidentResultToAcknowledge)
  useSprintStore((s) => s.kickoffShownForSprint)
  useRiskStore((s) => s.signals)
  const ambientActive = useNpcAmbientStore((s) => s.active)

  const [beat, setBeat] = useState<DailyBeat | null>(null)
  // 18H: guards the async kickoff gather against re-entrant effect runs
  const kickoffGatheringRef = useRef(false)
  const canAdvance = canAutoAdvanceWorkday(currentFlowContext())

  useEffect(() => {
    if (!canAdvance) {
      setBeat(null)
      return
    }
    // Feature 16 §2 + 18H: on the first day of a sprint the team PHYSICALLY
    // gathers at the whiteboard, and only when every present participant has
    // reached its meeting slot AND the camera has settled on the group does
    // the first line open. The "shown" marker is set right before the
    // dialogue, so a reload during the gather simply restarts the gather.
    if (
      shouldOpenSprintKickoff(day, sprintNumber, useSprintStore.getState().kickoffShownForSprint) &&
      !kickoffGatheringRef.current
    ) {
      kickoffGatheringRef.current = true
      const participants = KICKOFF_SLOTS.map((s) => s.characterId).filter(
        (id) => useCharacterStore.getState().characters[id],
      )
      const cinematic = beginConversationCinematic({
        autoEndOnDialogueClose: true,
        ownIds: participants,
        groupIds: participants,
      })
      void (async () => {
        try {
          const { timedOut } = await gatherParticipants(KICKOFF_SLOTS)
          if (timedOut.length) console.warn('kickoff gather timeout (snapped to slots):', timedOut)
          await cinematic.ready // §5: opening transition settled
          // §2: the opening shot was aimed while the cast was still walking in
          // (ready caps at 3.5s, the gather at up to 9s) - re-aim once at the
          // GATHERED group and wait for that settle before the first line.
          await cinematic.resettle()
          useSprintStore.getState().markSprintKickoffShown(sprintNumber)
          useGameStore.getState().startDialogue(buildSprintKickoffDialogue(buildKickoffContext()))
        } catch (error) {
          console.error('kickoff gather failed', error)
          await cinematic.end()
        } finally {
          kickoffGatheringRef.current = false
        }
      })()
      return
    }
    // §8 priority: an ambient conversation must never play on top of a mandatory
    // scene. The one-time security-breach fires on exactly these days (sprint ≥ 2,
    // first prototype ready) and its trigger cannot see a running conversation —
    // so while it is still due, yield the day to it. It fires, completes, and
    // Sonya's post-audit marker then appears; only afterwards do conversations
    // resume. (Follow-up audit / intrusion / server incidents are already covered
    // by canAutoAdvanceWorkday's blocking guards.)
    if (
      securityBreachStillDue(
        useSecurityStoryStore.getState().securityBreach.status === 'completed',
        sprintNumber,
        hasFirstPrototype(useProductStore.getState().taskStates),
      )
    ) {
      return
    }
    const dayKey = `${sprintNumber}:${day}`
    const ambient = useNpcAmbientStore.getState()
    if (ambient.playedDayKey === dayKey) {
      // This day's colleague conversation already ran (while it played the day was
      // `busy`, so we only reach here once it ended) — complete the day now, with
      // no extra banner.
      const t = setTimeout(() => {
        if (canAutoAdvanceWorkday(currentFlowContext())) autoCompleteWorkday()
      }, POST_CONVERSATION_MS)
      return () => clearTimeout(t)
    }
    // Feature 16 §8: the day's beat is a short colleague conversation chosen from
    // real sprint state. Beginning it makes the flow `busy`; the day advances (via
    // the branch above) once the conversation ends. NpcAmbientConversationController
    // stages the walk-up + speech bubbles.
    const conversation = pickNpcAmbientConversation(buildAmbientContext())
    if (conversation) {
      ambient.begin(conversation, dayKey)
      return
    }
    // No conversation available (edge — e.g. before the team exists) → the short
    // status banner, then advance.
    const dayBeat = getDailyBeat(sprintNumber, day, buildDailyBeatContext())
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

  if (gamePhase !== 'free' || sprintPhase !== 'active') return null
  // Feature 16 §8: while a colleague conversation plays, a short HUD note so a
  // player across the office still knows it is happening (the lines themselves
  // are speech bubbles over the two NPCs).
  if (ambientActive) {
    return (
      <div className="workday-ambient">
        <span className="workday-ambient-icon">💬</span>
        <span>{ambientActive.conversation.hudSummary}</span>
      </div>
    )
  }
  if (!beat) return null
  return (
    <div className={`workday-beat workday-beat--${beat.kind}`}>
      <div className="workday-beat-title">{beat.title}</div>
      <div className="workday-beat-text">{beat.text}</div>
      <div className="workday-beat-progress" aria-hidden />
    </div>
  )
}
