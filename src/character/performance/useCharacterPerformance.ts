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
import { useQualityStore, QUALITY_PRESETS } from '../../scene/qualityStore'
import { EMOTION_POSES } from './characterEmotion'
import { gazeAnglesToward, EYE_HEIGHT_SEATED, EYE_HEIGHT_STANDING } from './gaze'

const SEATED_KINDS = new Set(['sittingDown', 'working', 'sittingIdle', 'sofaSitting'])
const BREATH_PITCH = 0.008
const NOD_PITCH = 0.03
// 18H Wave 3: procedural ping-pong forehand swing (no baked clip exists - see
// docs/art/higgsfield-ambient-motion-prompts.md). Same additive-on-idle
// technique as breathing/emotion, just on the arm chain instead of the torso.
const PADDLE_SWING_HZ = 2.4
const PADDLE_SWING_SHOULDER_RAD = 0.55
const PADDLE_SWING_ELBOW_RAD = 0.4
// 18H Wave 3: procedural phone-check pose - a held, mostly-still raise of the
// forearm (same verified -X axis as the paddle swing, static amplitude - no
// oscillation) plus a downward head pitch (headPitch's own established
// "positive = forward/down" sign, characterEmotion.ts) so the character
// visibly looks at the phone rather than just holding it at their side.
const PHONE_ARM_RAD = 0.75
const PHONE_FOREARM_RAD = 0.95
const PHONE_HEAD_PITCH = 0.16

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
      rightArm: findBone(root, /RightArm$/),
      rightForeArm: findBone(root, /RightForeArm$/),
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
    // 18G §4: the low tier sheds this whole per-frame layer (mixer poses stay)
    if (!QUALITY_PRESETS[useQualityStore.getState().tier].npcPerformance) return
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

    // --- 18H Wave 3: procedural ambient-activity poses layered on 'idle' ---
    const playingPingPong = me.state.kind === 'performing' && me.state.clip === 'pingPongRally'
    const checkingPhone = me.state.kind === 'performing' && me.state.clip === 'checkPhone'

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

    if (playingPingPong) {
      // A back-and-forth forehand: shoulder raises/swings forward, elbow
      // follows with a shorter lag so the paddle leads the motion. Sign
      // verified empirically against the rest-pose FK (negative local X on
      // both RightArm and RightForeArm moves the hand forward-and-up here,
      // not backward through the torso) - see checkArmAxis in session notes.
      const swing = Math.sin(t * Math.PI * 2 * PADDLE_SWING_HZ + phase)
      if (bones.rightArm) bones.rightArm.rotation.x -= 0.3 + swing * PADDLE_SWING_SHOULDER_RAD
      if (bones.rightForeArm) bones.rightForeArm.rotation.x -= 0.2 + Math.max(0, swing) * PADDLE_SWING_ELBOW_RAD
    }

    if (checkingPhone) {
      if (bones.rightArm) bones.rightArm.rotation.x -= PHONE_ARM_RAD
      if (bones.rightForeArm) bones.rightForeArm.rotation.x -= PHONE_FOREARM_RAD
      if (bones.head) bones.head.rotation.x += PHONE_HEAD_PITCH
    }
  })
}
