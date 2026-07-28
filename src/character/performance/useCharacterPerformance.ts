// Feature 18C §5/§6, extended 18H §7: the per-character performance layer.
// Runs AFTER the animation mixer each frame (same useFrame priority tier,
// registered later in CharacterModel), adding damped offsets on top of the
// mixer pose:
//   - breathing / micro body movement (always on, per-character phase);
//   - head look-at toward a registered conversation partner OR a fixed
//     point (clamped) - e.g. "look at the whiteboard";
//   - listener nod / small head-shake / thinking, driven by an explicit
//     DialoguePerformanceCue.listenerReaction, not chosen at random (§7);
//   - emotion bone poses from the centralized presets - a listener reaction
//     that maps onto an existing CharacterEmotion (REACTION_EMOTION) simply
//     wears that pose for as long as the reaction is set.
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
import { REACTION_EMOTION } from './dialoguePerformanceCue'
import { gazeAnglesToward, EYE_HEIGHT_SEATED, EYE_HEIGHT_STANDING } from './gaze'
import { usePingPongRallyStore } from '../pingPongRallyStore'
import { swingEnvelope } from '../pingPongRhythm'

const SEATED_KINDS = new Set(['sittingDown', 'working', 'sittingIdle', 'sofaSitting'])
const BREATH_PITCH = 0.008
const NOD_PITCH = 0.03
// 18H §7: small side-to-side "no" head shake and the averted-gaze "thinking"
// tilt - same damped-additive technique as the nod above, just a different
// axis/target. Kept well inside GAZE_LIMITS-scale amplitudes so they read as
// a listener's micro-reaction, not a second competing gaze system.
const HEAD_SHAKE_HZ = 3.2
const HEAD_SHAKE_YAW = 0.09
const THINKING_HEAD_PITCH = -0.07
const THINKING_HEAD_YAW = 0.16
// 18H Wave 3: procedural ping-pong forehand swing (no baked clip exists - see
// docs/art/higgsfield-ambient-motion-prompts.md). Same additive-on-idle
// technique as breathing/emotion, just on the arm chain instead of the torso.
const PADDLE_SWING_HZ = 2.4
// amplitudes tuned UP after live feedback - the exchange must read as tennis
// even from the isometric distance, not as a wrist twitch
const PADDLE_SWING_SHOULDER_RAD = 0.75
const PADDLE_SWING_ELBOW_RAD = 0.55
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

function findBone(root: Object3D, ...patterns: RegExp[]): Object3D | undefined {
  // ordered candidates: the first pattern with a match wins - needed because
  // Mixamo and Meshy rigs name the SPINE CHAIN in opposite directions (Meshy:
  // Hips -> Spine02 -> Spine01 -> Spine(top); Mixamo: Spine -> Spine1 ->
  // Spine2(top)), so one regex cannot address "the chest" on both.
  for (const pattern of patterns) {
    let found: Object3D | undefined
    root.traverse((object) => {
      if (!found && pattern.test(object.name)) found = object
    })
    if (found) return found
  }
  return undefined
}

function eyeHeightOf(stateKind: string | undefined): number {
  return stateKind && SEATED_KINDS.has(stateKind) ? EYE_HEIGHT_SEATED : EYE_HEIGHT_STANDING
}

export function useCharacterPerformance(characterId: string, root: Object3D) {
  const bones = useMemo(
    () => ({
      head: findBone(root, /Head$/),
      // lower spine: Meshy 'Spine02', Mixamo '...rig:Spine'
      spine: findBone(root, /Spine02$/, /:Spine$/, /^Spine$/),
      // chest: Mixamo 'Spine2'; on Meshy rigs the TOP spine bone is the bare
      // 'Spine' (carries shoulders+neck). The old /Spine2$/ matched NOTHING
      // on the v2 rigs - chest breathing/coil was silently dead since the
      // model swap.
      chest: findBone(root, /Spine2$/, /^Spine$/),
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
  const applied = useRef({ yaw: 0, pitch: 0, headPitch: 0, spinePitch: 0, chestPitch: 0, nod: 0, shake: 0, think: 0 })

  // referential hygiene: nothing to dispose, but keep the ref zeroed when the
  // model instance changes so a respawn never inherits old offsets
  useEffect(() => {
    applied.current = { yaw: 0, pitch: 0, headPitch: 0, spinePitch: 0, chestPitch: 0, nod: 0, shake: 0, think: 0 }
  }, [root])

  useFrame(({ clock }, delta) => {
    // 18G §4: the low tier sheds this whole per-frame layer (mixer poses stay)
    if (!QUALITY_PRESETS[useQualityStore.getState().tier].npcPerformance) return
    const t = clock.elapsedTime
    const k = 1 - Math.exp(-delta * 6) // damping toward targets
    const store = useCharacterStore.getState()
    const me = store.characters[characterId]
    if (!me) return

    const perf = usePerformanceStore.getState()

    // --- gaze target: a registered partner CHARACTER, or a fixed POINT
    // (18H §7 focusTarget, e.g. "look at the whiteboard") - never both, see
    // setGazePoint. ---
    let targetYaw = 0
    let targetPitch = 0
    const partnerId = perf.gazeTargets[characterId]
    const partner = partnerId ? store.characters[partnerId] : undefined
    const gazePoint = perf.gazePoints[characterId]
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
    } else if (gazePoint) {
      // the point already carries its own world height - no separate "eye
      // height" to add on top of it.
      const gaze = gazeAnglesToward(me.position, me.rotationY, eyeHeightOf(me.state.kind), gazePoint, 0)
      if (gaze.active) {
        targetYaw = gaze.yaw
        targetPitch = gaze.pitch
      }
    }

    // --- 18H §7: the listener's current reaction to the line on screen,
    // driven by DialoguePerformanceCue - not chosen at random. ---
    const reaction = perf.listenerReactions[characterId]

    // --- listener nod: the pre-18H ambient-conversation trigger, OR an
    // explicit 'nod' reaction cue (§7) - same motion, two triggers. ---
    let nodTarget = 0
    const ambient = useNpcAmbientStore.getState().active
    const npcId = NPC_ID_FOR_CHARACTER[characterId]
    if (ambient && npcId && (ambient.conversation.mover === npcId || ambient.conversation.host === npcId)) {
      const line = ambient.conversation.lines[ambient.lineIndex]
      if (line && line.speaker !== npcId) nodTarget = 1
    }
    if (reaction === 'nod') nodTarget = 1
    const shakeTarget = reaction === 'small-head-shake' ? 1 : 0
    const thinkTarget = reaction === 'thinking' ? 1 : 0

    // --- emotion preset (§5), overridden by a reaction that reads as one of
    // the existing presets (§7 REACTION_EMOTION - e.g. 'concerned-listening'
    // wears the same pose as the 'concerned' emotion). ---
    const reactionEmotion = reaction ? REACTION_EMOTION[reaction] : undefined
    const emotion = reactionEmotion ?? perf.emotions[characterId] ?? 'neutral'
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
    a.shake += (shakeTarget - a.shake) * k
    a.think += (thinkTarget - a.think) * k

    const breath = Math.sin(t * 1.5 + phase) * BREATH_PITCH
    const nod = Math.sin(t * 4.2) * NOD_PITCH * a.nod
    const shake = Math.sin(t * HEAD_SHAKE_HZ + phase) * HEAD_SHAKE_YAW * a.shake

    if (bones.head) {
      bones.head.rotation.y += a.yaw + shake + THINKING_HEAD_YAW * a.think
      bones.head.rotation.x += a.pitch + a.headPitch + nod + THINKING_HEAD_PITCH * a.think
    }
    if (bones.spine) bones.spine.rotation.x += a.spinePitch
    if (bones.chest) bones.chest.rotation.x += a.chestPitch + breath

    if (playingPingPong) {
      // A REAL exchange, not a metronome arm (live feedback «анимации игры в
      // тенис нет»): the swing shares its phase clock with the ball
      // (pingPongRhythm) - the WINDUP coils shortly before the ball arrives
      // at THIS player, the STRIKE drives through exactly as it leaves. Arm
      // axis signs as before (negative local X = forward/up, verified by
      // rest-pose FK); the torso coils with the windup and releases through
      // the strike so the whole body plays, not just the wrist.
      const rally = usePingPongRallyStore.getState().participants
      const side = rally ? (rally.indexOf(characterId) as -1 | 0 | 1) : -1
      if (side === -1) {
        // solo practice (no opponent found): keep a light ready sway
        const sway = Math.sin(t * Math.PI * 2 * PADDLE_SWING_HZ + phase)
        if (bones.rightArm) bones.rightArm.rotation.x -= 0.3 + sway * 0.15
        if (bones.rightForeArm) bones.rightForeArm.rotation.x -= 0.25
      } else {
        const { windup, strike } = swingEnvelope(t, side)
        if (bones.rightArm) bones.rightArm.rotation.x -= 0.3 - windup * 0.35 + strike * PADDLE_SWING_SHOULDER_RAD
        if (bones.rightForeArm) bones.rightForeArm.rotation.x -= 0.2 + strike * PADDLE_SWING_ELBOW_RAD - windup * 0.18
        if (bones.spine) bones.spine.rotation.y += windup * 0.38 - strike * 0.26
        // ready stance between exchanges: slight forward lean
        if (bones.chest) bones.chest.rotation.x += 0.06
      }
    }

    if (checkingPhone) {
      if (bones.rightArm) bones.rightArm.rotation.x -= PHONE_ARM_RAD
      if (bones.rightForeArm) bones.rightForeArm.rotation.x -= PHONE_FOREARM_RAD
      if (bones.head) bones.head.rotation.x += PHONE_HEAD_PITCH
    }
  })
}
