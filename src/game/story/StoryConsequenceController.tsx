import { useEffect, useRef } from 'react'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useProductStore } from '../productStore'
import { useEconomyStore } from '../economyStore'
import { useTeamStore } from '../teamStore'
import { useSecurityAuditStore } from '../securityAuditStore'
import { useAccessControlStore } from '../accessControlStore'
import { useServerIncidentStore } from '../serverIncidentStore'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useCharacterStore } from '../../character/characterStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
import { buildConsequenceScript, applyConsequenceEffects } from './storyConsequences'
import type { StoryConsequenceId } from './level1Checkpoints'

// Feature 17C: plays the queued mandatory consequence scenes. Respects the
// общий event priority (§13): the scene opens only when the daily report,
// result overlays, audits/intrusions/incidents, cutscenes and panels are all
// closed. The dialogue itself is a static conversation; effects apply through
// applyConsequenceEffects (idempotent), so a reload mid-scene replays the text
// but never the consequences.

function isUiFree(): boolean {
  const game = useGameStore.getState()
  const product = useProductStore.getState()
  const audit = useSecurityAuditStore.getState()
  const access = useAccessControlStore.getState()
  return (
    game.activeDialogue === null &&
    game.activeChoice === null &&
    !useCharacterStore.getState().inputLocked &&
    useCutsceneStore.getState().activeSceneId === null &&
    useServerIncidentsStore.getState().activeMinigame === null &&
    product.activeReport === null &&
    !product.boardOpen &&
    !product.prototypeOpen &&
    !product.releaseCheckOpen &&
    !useEconomyStore.getState().panelOpen &&
    !useTeamStore.getState().panelOpen &&
    audit.auditResultToAcknowledge === null &&
    access.intrusionResultToAcknowledge === null &&
    useServerIncidentStore.getState().incidentResultToAcknowledge === null &&
    audit.followUpAudit.status !== 'pending' &&
    audit.followUpAudit.status !== 'running' &&
    !['pending', 'running'].includes(access.intrusion.status) &&
    !Object.values(useServerIncidentStore.getState().incidents).some((s) => s.status === 'pending' || s.status === 'running')
  )
}

function say(lines: ReturnType<typeof buildConsequenceScript>['lines']): Promise<void> {
  useGameStore.getState().startDialogue(lines)
  return new Promise((resolve) => {
    if (useGameStore.getState().activeDialogue === null) {
      resolve()
      return
    }
    const unsubscribe = useGameStore.subscribe(() => {
      if (useGameStore.getState().activeDialogue !== null) return
      unsubscribe()
      resolve()
    })
  })
}

function choose(options: NonNullable<ReturnType<typeof buildConsequenceScript>['choices']>): Promise<string> {
  return new Promise((resolve) => {
    useGameStore.getState().presentChoice(options, resolve)
  })
}

async function runConsequenceScene(id: StoryConsequenceId): Promise<void> {
  const store = useStoryConsequenceStore.getState()
  store.startConsequence(id)
  const sprint = useSprintStore.getState()
  const moment = { sprintNumber: sprint.sprintNumber, day: sprint.day }
  const script = buildConsequenceScript(id)

  await say(script.lines)
  let choiceId: string | undefined
  if (script.choices && script.choices.length > 0) {
    choiceId = await choose(script.choices)
  }
  applyConsequenceEffects(id, moment, choiceId)
  if (choiceId && script.reaction) {
    await say(script.reaction(choiceId))
  }
  useStoryConsequenceStore.getState().completeConsequence(id)
}

export function StoryConsequenceController() {
  const gamePhase = useGameStore((s) => s.phase)
  const pending = useStoryConsequenceStore((s) => s.pendingConsequenceIds)
  const running = useStoryConsequenceStore((s) => s.runningConsequenceId)
  // Re-check on every UI-busy slice so the scene opens the moment the way is clear.
  useGameStore((s) => s.activeDialogue)
  useGameStore((s) => s.activeChoice)
  useProductStore((s) => s.activeReport)
  useProductStore((s) => s.boardOpen)
  useEconomyStore((s) => s.panelOpen)
  useTeamStore((s) => s.panelOpen)
  useSecurityAuditStore((s) => s.auditResultToAcknowledge)
  useSecurityAuditStore((s) => s.followUpAudit)
  useAccessControlStore((s) => s.intrusionResultToAcknowledge)
  useAccessControlStore((s) => s.intrusion)
  useServerIncidentStore((s) => s.incidentResultToAcknowledge)
  useServerIncidentStore((s) => s.incidents)
  useCutsceneStore((s) => s.activeSceneId)
  useServerIncidentsStore((s) => s.activeMinigame)
  useCharacterStore((s) => s.inputLocked)

  const opening = useRef(false)

  useEffect(() => {
    if (gamePhase !== 'free' || running || opening.current) return
    const next = pending[0]
    if (!next || !isUiFree()) return
    opening.current = true
    void runConsequenceScene(next).finally(() => {
      opening.current = false
    })
  })

  // If the app unmounts mid-scene the store normalisation rolls running back to
  // pending on the next load; nothing to render here.
  return null
}
