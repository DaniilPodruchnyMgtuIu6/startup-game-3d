import { useGameStore } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useEconomyStore } from './economyStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { isOfficeIntrusionBlocking } from './accessControlRules'
import { useServerIncidentStore } from './serverIncidentStore'
import { anyServerIncidentBlocking } from './serverIncidentRules'
import { useCharacterStore } from '../character/characterStore'
import { useNpcAmbientStore } from './npcAmbientStore'
import { hasSecuritySpecialist } from './teamRules'
import { isStoryDecisionPendingFor } from './story/storyDecisionSelectors'
import { isCyberStoryPendingFor } from './story/cyberStorySelectors'
import type { NpcId } from './npcChatTypes'

// Pure eligibility for opening an OPTIONAL free chat. A pending mandatory story
// interaction, an open blocking overlay, a running scene/mini-game, or a
// finished campaign all take priority (§18/§19/§25). The DeepSeek call never
// decides this — deterministic game state does.

export interface FreeNpcConversationContext {
  npcId: NpcId
  gamePhase: string
  campaignOver: boolean
  npcPresent: boolean
  requiredInteractionPending: boolean
  inputLocked: boolean
  activeDialogue: boolean
  activeChoice: boolean
  cutsceneRunning: boolean
  minigameOpen: boolean
  blockingOverlayOpen: boolean
}

export interface FreeNpcConversationEligibility {
  eligible: boolean
  reason?:
    | 'not-free-phase'
    | 'campaign-over'
    | 'npc-absent'
    | 'required-interaction'
    | 'busy'
}

export function canOpenFreeNpcConversation(context: FreeNpcConversationContext): FreeNpcConversationEligibility {
  if (context.gamePhase !== 'free') return { eligible: false, reason: 'not-free-phase' }
  if (context.campaignOver) return { eligible: false, reason: 'campaign-over' }
  if (!context.npcPresent) return { eligible: false, reason: 'npc-absent' }
  if (context.requiredInteractionPending) return { eligible: false, reason: 'required-interaction' }
  if (
    context.inputLocked ||
    context.activeDialogue ||
    context.activeChoice ||
    context.cutsceneRunning ||
    context.minigameOpen ||
    context.blockingOverlayOpen
  ) {
    return { eligible: false, reason: 'busy' }
  }
  return { eligible: true }
}

// Whether a mandatory story interaction is pending for this NPC (blocks free
// chat). Only Sonya and Ilya have story beats; Kirill/Alina never do.
export function npcRequiredInteractionPending(npcId: NpcId): boolean {
  // Feature 17A §7: a pending mandatory story decision hides this colleague's
  // optional DeepSeek marker - the story scene must be held first.
  if (isStoryDecisionPendingFor(npcId)) return true
  // Feature 19: a pending mandatory cyber-story incident does the same.
  if (isCyberStoryPendingFor(npcId)) return true
  if (npcId === 'sonya-sokolova') {
    if (useGameStore.getState().phase === 'meetPm') return true
    const status = useSecurityStoryStore.getState().postAuditConversation.status
    return status === 'pending' || status === 'running'
  }
  if (npcId === 'ilya-vlasov') {
    // his one-time onboarding (static) has priority; free chat opens afterwards
    return !useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist
  }
  return false
}

function npcPresent(npcId: NpcId): boolean {
  if (npcId === 'ilya-vlasov') return hasSecuritySpecialist(useTeamStore.getState().hires)
  // Sonya is always present; Kirill/Alina exist once the game reaches free play
  // (they are hired before the first sprint). Presence in the 3D scene is what
  // actually gates the click, so this is a soft check.
  return true
}

export function gatherFreeNpcEligibility(npcId: NpcId): FreeNpcConversationEligibility {
  const outcome = useGameOutcomeStore.getState().status
  const product = useProductStore.getState()
  const audit = useSecurityAuditStore.getState()
  const access = useAccessControlStore.getState()
  const blockingOverlayOpen =
    product.activeReport !== null ||
    product.boardOpen ||
    product.prototypeOpen ||
    product.releaseCheckOpen ||
    useEconomyStore.getState().panelOpen ||
    useTeamStore.getState().panelOpen ||
    audit.auditResultToAcknowledge !== null ||
    access.intrusionResultToAcknowledge !== null ||
    useServerIncidentStore.getState().incidentResultToAcknowledge !== null ||
    isFollowUpAuditBlocking(audit.followUpAudit) ||
    isOfficeIntrusionBlocking(access.intrusion) ||
    anyServerIncidentBlocking(Object.values(useServerIncidentStore.getState().incidents)) ||
    // §8: don't invite a free chat with a colleague who is mid NPC↔NPC conversation
    useNpcAmbientStore.getState().active !== null

  return canOpenFreeNpcConversation({
    npcId,
    gamePhase: useGameStore.getState().phase,
    campaignOver: outcome !== 'playing',
    npcPresent: npcPresent(npcId),
    requiredInteractionPending: npcRequiredInteractionPending(npcId),
    inputLocked: useCharacterStore.getState().inputLocked,
    activeDialogue: useGameStore.getState().activeDialogue !== null,
    activeChoice: useGameStore.getState().activeChoice !== null,
    cutsceneRunning: useCutsceneStore.getState().activeSceneId !== null,
    minigameOpen: useServerIncidentsStore.getState().activeMinigame !== null,
    blockingOverlayOpen,
  })
}
