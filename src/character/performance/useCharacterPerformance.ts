// Feature 18C §5/§6: the per-character performance layer. Runs AFTER the
// animation mixer each frame (same useFrame priority tier, registered later in
// CharacterModel), adding damped offsets on top of the mixer pose:
//   - breathing / micro body movement (always on, per-character phase);
//   - head look-at toward the registered conversation partner (clamped);
//   - listener nods while the partner's ambient line is on screen;
//   - emotion bone poses from the centralized presets.
// The mixer rewrites bone rotations every frame, so simply ceasing to add an
// offset IS the cleanup - nothing here can leave a stale pose behind (§7).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Object3D } from 'three'
import { useCharacterStore } from '../characterStore'
import { useNpcAmbientStore } from '../../game/npcAmbientStore'
import { NPC_CHARACTER_ID, type NpcId } from '../../game/npcChatTypes'
import { usePerformanceStore } from './performanceStore'
import { EMOTION_POSES } from './characterEmotion'
import { gazeAnglesToward, EYE_HEIGHT_SEATED, EYE_HEIGHT_STANDING } from './gaze'

const SEATED_KINDS = new Set(['sittingDown', 'working', 'sittingIdle', 'sofaSitting'])
const BREATH_PITCH = 0.008
const NOD_PITCH = 0.03

const NPC_ID_FOR_CHARACTER: Record<string, NpcId> = Object.fromEntries(
  (Object.entries(NPC_CHARACTER_ID) as [NpcId, string][]).map(([npcId, charId]) => [charId, npcId]),
)

function findBone(root: Object3D, suffix: RegExp): Object3D | undefined {
  let found: Object3D | undefined
  root.traverse((object) => {
    if (!found && suffix.test(object.name)) found = object
  })
  return found
}

function eyeHeightOf(stateKind: string | undefined): number {
  return stateKind && SEATED_KINDS.has(stateKind) ? EYE_HEIGHT_SEATED : EYE_HEIGHT_STANDING
}

export function useCharacterPerformance(characterId: string, root: Object3D) {
  const bones = useMemo(
    () => ({
      head: findBone(root, /Head$/),
      spine: findBone(root, /Spine$/),
      chest: findBone(root, /Spine2$/),
    }),
    [root],
  )
  // per-character breathing phase so the office doesn't inhale in unison
  const phase = useMemo(() => {
    let h = 0
    for (const ch of characterId) h = (h * 31 + ch.charCodeAt(0)) % 997
    return (h / 997) * Math.PI * 2
  }, [characterId])

  // damped applied offsets - smooth approach, no jitter (§6)
  const applied = useRef({ yaw: 0, pitch: 0, headPitch: 0, spinePitch: 0, chestPitch: 0, nod: 0 })

  // referential hygiene: nothing to dispose, but keep the ref zeroed when the
  // model instance changes so a respawn never inherits old offsets
  useEffect(() => {
    applied.current = { yaw: 0, pitch: 0, headPitch: 0, spinePitch: 0, chestPitch: 0, nod: 0 }
  }, [root])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-delta * 6) // damping toward targets
    const store = useCharacterStore.getState()
    const me = store.characters[characterId]
    if (!me) return

    // --- gaze target (registered conversation partner) ---
    let targetYaw = 0
    let targetPitch = 0
    const partnerId = usePerformanceStore.getState().gazeTargets[characterId]
    const partner = partnerId ? store.characters[partnerId] : undefined
    if (partner) {
      const gaze = gazeAnglesToward(
        me.position,
        me.rotationY,
        eyeHeightOf(me.state.kind),
        partner.position,
        eyeHeightOf(partner.state.kind),
      )
      if (gaze.active) {
        targetYaw = gaze.yaw
        targetPitch = gaze.pitch
      }
    }

    // --- listener nod while the ambient partner's line is on screen (§6) ---
    let nodTarget = 0
    const ambient = useNpcAmbientStore.getState().active
    const npcId = NPC_ID_FOR_CHARACTER[characterId]
    if (ambient && npcId && (ambient.conversation.mover === npcId || ambient.conversation.host === npcId)) {
      const line = ambient.conversation.lines[ambient.lineIndex]
      if (line && line.speaker !== npcId) nodTarget = 1
    }

    // --- emotion preset (§5) ---
    const emotion = usePerformanceStore.getState().emotions[characterId] ?? 'neutral'
    const pose = EMOTION_POSES[emotion]

    const a = applied.current
    a.yaw += (targetYaw - a.yaw) * k
    a.pitch += (targetPitch - a.pitch) * k
    a.headPitch += (pose.headPitch - a.headPitch) * k
    a.spinePitch += (pose.spinePitch - a.spinePitch) * k
    a.chestPitch += (pose.chestPitch - a.chestPitch) * k
    a.nod += (nodTarget - a.nod) * k

    const breath = Math.sin(t * 1.5 + phase) * BREATH_PITCH
    const nod = Math.sin(t * 4.2) * NOD_PITCH * a.nod

    if (bones.head) {
      bones.head.rotation.y += a.yaw
      bones.head.rotation.x += a.pitch + a.headPitch + nod
    }
    if (bones.spine) bones.spine.rotation.x += a.spinePitch
    if (bones.chest) bones.chest.rotation.x += a.chestPitch + breath
  })
}
