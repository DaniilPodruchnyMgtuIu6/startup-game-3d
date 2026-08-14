import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useAccessControlStore } from '../accessControlStore'
import { useCyberStoryStore } from './cyberStoryStore'
import { CYBER_STORY_INCIDENT_PRIORITY, type CyberConsequenceId, type CyberStoryChoiceId, type CyberStoryIncidentId } from './cyberStoryTypes'
import { currentMoment, runCyberConsequenceScene, runCyberStoryConversation, runCyberStoryConversationVisualOnly } from './cyberStoryInteraction'

// Feature 19 dev-only scene launcher (`window.__startupGameDev.scenes`, see
// scenes.md). Registered from App.tsx ONLY behind `import.meta.env.DEV`, so it
// never ships in the production bundle (verified by artPipeline-style dev
// tooling and by the production-build check in scenes.md). Every method goes
// through the SAME real stores/use-cases the game itself uses - no effect
// bypass, no duplicate application (idempotency guarantees are the store's,
// unchanged here), no Higgsfield network calls (a scene's insert either finds
// its local .mp4 under public/cutscenes/ or falls back in-engine).

export type DevSceneId = CyberStoryIncidentId | 'office-intrusion'

export const DEV_SCENE_IDS: DevSceneId[] = [...CYBER_STORY_INCIDENT_PRIORITY, 'office-intrusion']

export interface DevSceneStatus {
  id: DevSceneId
  status: string
}

function isCyberSceneId(id: DevSceneId): id is CyberStoryIncidentId {
  return id !== 'office-intrusion'
}

function list(): DevSceneStatus[] {
  const cyber = useCyberStoryStore.getState()
  return DEV_SCENE_IDS.map((id) => ({
    id,
    status: isCyberSceneId(id) ? cyber.incidents[id].status : useAccessControlStore.getState().intrusion.status,
  }))
}

// Minimal state so the scene CAN play without replaying the whole campaign:
// forces the incident's own store into `available` (cyber scenes) or the
// intrusion into `pending` (office-intrusion) - the same store methods the
// real triggers call, not a parallel path.
function prepare(id: DevSceneId): void {
  if (!isCyberSceneId(id)) {
    const intrusion = useAccessControlStore.getState().intrusion
    if (intrusion.status === 'resolved' || intrusion.status === 'prevented') return
    useAccessControlStore.setState({ intrusion: { ...intrusion, status: 'pending' } })
    return
  }
  const record = useCyberStoryStore.getState().incidents[id]
  if (record.status === 'locked') useCyberStoryStore.getState().unlockIncident(id, currentMoment())
}

// Full playthrough: prepares (idempotent) then runs the exact production
// scene runner. `visualOnly: true` plays the identical cinematic/dialogue but
// never calls resolveIncident - explicitly marked, zero effects applied.
async function play(id: DevSceneId, opts: { visualOnly?: boolean } = {}): Promise<void> {
  if (!isCyberSceneId(id)) {
    useCutsceneStore.getState().startScene('office-intrusion')
    return
  }
  if (opts.visualOnly) {
    console.info(`[cyber-story-dev] playing "${id}" in visual-only mode - no effects will be applied`)
    await runCyberStoryConversationVisualOnly(id)
    return
  }
  prepare(id)
  await runCyberStoryConversation(id)
}

// Fast path: apply a specific choice's real effects directly through the real
// store, without the 3D walk/dialogue - for setting up a branch's downstream
// state quickly (fixtures, delayed-consequence tests).
function resolve(id: CyberStoryIncidentId, choiceId: CyberStoryChoiceId) {
  const store = useCyberStoryStore.getState()
  if (store.incidents[id].status === 'locked') store.unlockIncident(id, currentMoment())
  store.startIncident(id, currentMoment())
  return store.resolveIncident(id, choiceId, currentMoment())
}

// Queues a delayed consequence right now, bypassing the due-day wait - the
// already-mounted CyberStoryController picks it up on its next tick, the same
// production handler a real due day uses (mirrors Feature 17C's
// __queueStoryConsequence dev hook).
function playConsequence(id: CyberConsequenceId): void {
  useCyberStoryStore.getState().queueConsequenceOnce(id)
}

// Directly plays an already-queued/scheduled consequence right now, without
// waiting for the controller's next UI-free tick - useful when the dev build
// has another panel open. Real runner, real effects, idempotent.
async function playConsequenceNow(id: CyberConsequenceId): Promise<void> {
  playConsequence(id)
  await runCyberConsequenceScene(id)
}

function reset(id: DevSceneId): void {
  if (!isCyberSceneId(id)) {
    useAccessControlStore.getState().resetAccessControl()
    return
  }
  useCyberStoryStore.getState().resetIncident(id)
}

export const cyberStoryDevScenes = { list, prepare, play, resolve, playConsequence, playConsequenceNow, reset }
