import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import {
  Vector3,
  type Group,
  type Object3D,
  type Mesh,
  type MeshStandardMaterial,
  type OrthographicCamera,
} from 'three'
import { useCutsceneCameraStore } from '../scene/camera/cameraController'
import { useCharacterStore, PLAYER_ID } from './characterStore'
import { useCharacterTransform, WALK_SPEED } from './useCharacterTransform'
import { useServerIncidentsStore, type ServerRole } from '../game/serverIncidentsStore'
import { buildHeldMug, disposeHeldProp } from './heldProps'
import { useNpcAmbientStore } from '../game/npcAmbientStore'
import { visibleLineFor } from '../game/npcAmbientConversation'
import { NPC_CHARACTER_ID, type NpcId } from '../game/npcChatTypes'
import type { CharacterModelConfig, ClipName } from './characters/definition'

// Reverse of NPC_CHARACTER_ID: 3D character id → chat NpcId, for showing an
// ambient conversation's speech bubble over the right participant.
const NPC_ID_FOR_CHARACTER: Record<string, NpcId> = Object.fromEntries(
  (Object.entries(NPC_CHARACTER_ID) as [NpcId, string][]).map(([npcId, charId]) => [charId, npcId]),
)

const SIT_SETTLE_MS = 1000
const BREW_MS = 3500

// Feature 18B §6: below this orthographic zoom the office is so far out that
// name tags turn into unreadable overlapping clutter - hide them until the
// player zooms back in (default zoom is 28, allowed range 12-70).
const TAG_MIN_ZOOM = 19

const CLIP_FOR_STATE: Record<string, ClipName> = {
  idle: 'idle',
  walking: 'walk',
  sittingDown: 'sit',
  working: 'type',
  brewingCoffee: 'idle',
  drinkingCoffee: 'drink',
  sittingIdle: 'sitIdle',
  sofaSitting: 'sofaSit',
  talking: 'talk',
  looking: 'look',
}

// Characters ship different clip subsets - when the preferred clip is missing,
// walk down the fallback chain to the closest available pose.
const CLIP_FALLBACKS: Record<ClipName, ClipName[]> = {
  idle: [],
  walk: ['idle'],
  sit: ['sitIdle', 'idle'],
  type: ['sitIdle', 'idle'],
  drink: ['idle'],
  sitIdle: ['sit', 'idle'],
  sofaSit: ['sitIdle', 'idle'],
  talk: ['idle'],
  look: ['idle'],
}

export function resolveClip(stateKind: string, available: ReadonlySet<string>): ClipName {
  const preferred = CLIP_FOR_STATE[stateKind] ?? 'idle'
  if (available.has(preferred)) return preferred
  for (const fallback of CLIP_FALLBACKS[preferred]) {
    if (available.has(fallback)) return fallback
  }
  return 'idle'
}

export interface CharacterModelProps {
  characterId: string
  config: CharacterModelConfig
  // Optional name + role shown on a small tag above the head (NPCs only).
  label?: { name: string; role: string }
}

// Renders one character (player or NPC): its skinned model, animation
// crossfades driven by the shared state machine, and per-frame movement along
// the pathfinding waypoints. All characters go through the same store, grid
// and obstacle avoidance.
export function CharacterModel({ characterId, config, label }: CharacterModelProps) {
  const clipEntries = useMemo(() => Object.entries(config.clips) as [ClipName, string][], [config])
  const gltfs = useGLTF(clipEntries.map(([, url]) => url))
  const base = gltfs[clipEntries.findIndex(([name]) => name === 'idle')]

  const clips = useMemo(() => gltfs.map((gltf) => gltf.animations[0]).filter(Boolean), [gltfs])
  const availableClips = useMemo(() => new Set(clips.map((clip) => clip.name)), [clips])

  const group = useRef<Group>(null)
  const { actions } = useAnimations(clips, group)

  // Feature 18B §4: art pass over the shared skinned model. The Mixamo exports
  // ship raw: meshes cast no shadows (characters visually float), culling uses
  // bind-pose bounds (seated/typing poses pop out at screen edges), and the
  // body/hair atlas materials carry stray metalness that reads grey and waxy
  // under the studio HDRI. Matte skin/cloth with a slight sheen on hair follows
  // the Art Bible. Idempotent: the GLTF cache shares one scene per character,
  // so re-running writes the same values onto the same materials.
  useEffect(() => {
    base.scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.frustumCulled = false
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const standard = material as MeshStandardMaterial
        if (!standard.isMeshStandardMaterial) continue
        standard.metalness = 0
        standard.roughness = /hair/i.test(standard.name) ? 0.45 : 0.85
      }
    })
  }, [base])

  const stateKind = useCharacterStore((s) => s.characters[characterId]?.state.kind)

  useEffect(() => {
    if (!stateKind) return
    const clipName = resolveClip(stateKind, availableClips)
    const action = actions[clipName]
    // The walk clip plays at the ratio of actual travel speed to the clip's
    // own stance pace, so planted feet stay pinned instead of skating.
    action?.setEffectiveTimeScale(clipName === 'walk' ? WALK_SPEED / config.walkPace : 1)
    action?.reset().fadeIn(0.3).play()
    return () => {
      action?.fadeOut(0.3)
    }
  }, [stateKind, actions, availableClips, config.walkPace])

  // hand the character a coffee mug while drinking (the Mixamo drink
  // animations raise the LEFT hand to the mouth)
  useEffect(() => {
    if (stateKind !== 'drinkingCoffee') return
    let hand: Object3D | undefined
    base.scene.traverse((object) => {
      if (!hand && /LeftHand$/.test(object.name)) hand = object
    })
    if (!hand) return
    const mug = buildHeldMug()
    // bones inherit the model's import scale - counter it so the mug stays
    // real-world sized, and offset it into the palm along the finger axis
    const scale = hand.getWorldScale(new Vector3()).x || 1
    mug.scale.setScalar(1 / scale)
    mug.position.set(0, 0.09 / scale, 0.025 / scale)
    hand.add(mug)
    return () => {
      hand?.remove(mug)
      disposeHeldProp(mug)
    }
  }, [stateKind, base])

  useEffect(() => {
    if (stateKind === 'sittingDown') {
      const timer = setTimeout(
        () => useCharacterStore.getState().dispatchTo(characterId, { type: 'SETTLE_ELAPSED' }),
        SIT_SETTLE_MS,
      )
      return () => clearTimeout(timer)
    }
    if (stateKind === 'brewingCoffee') {
      const timer = setTimeout(
        () => useCharacterStore.getState().dispatchTo(characterId, { type: 'BREW_ELAPSED' }),
        BREW_MS,
      )
      return () => clearTimeout(timer)
    }
  }, [stateKind, characterId])

  // The player reaching a broken rack opens its mini-game overlay; leaving
  // 'repairing' (walk away or REPAIR_DONE) closes it. NPCs never open overlays.
  useEffect(() => {
    if (characterId !== PLAYER_ID || stateKind !== 'repairing') return
    const state = useCharacterStore.getState().characters[characterId]?.state
    if (state?.kind !== 'repairing') return
    useServerIncidentsStore.getState().beginRepair(state.role as ServerRole)
    return () => {
      useServerIncidentsStore.getState().closeMinigame()
    }
  }, [stateKind, characterId])

  useCharacterTransform(characterId, group, config.walkLift ?? 0)

  // Feature 16 §8/§9: a compact speech bubble over this colleague, shown ONLY
  // while an NPC↔NPC ambient conversation is running and this character is one of
  // the two participants. Distinct from the name tag and the story/chat markers.
  const ambient = useNpcAmbientStore((s) => s.active)
  const npcId = NPC_ID_FOR_CHARACTER[characterId]
  const bubble =
    ambient && npcId && (ambient.conversation.mover === npcId || ambient.conversation.host === npcId)
      ? visibleLineFor(ambient.conversation, ambient.lineIndex, npcId)
      : null
  // Stagger the two speakers' bubbles vertically (host higher, mover lower) so
  // they never overlap on screen even when the colleagues stand side by side.
  const bubbleY = ambient?.conversation.host === npcId ? 3.05 : 2.5

  // Feature 18B §6: the name tag hides while a cutscene's cinematic perspective
  // camera is active (a floating tag over a close-up face breaks the shot) and
  // when the isometric camera is zoomed far out (unreadable clutter). The zoom
  // check runs every 10th frame and only touches state on a threshold cross.
  const cutsceneActive = useCutsceneCameraStore((s) => s.active)
  const [zoomedOut, setZoomedOut] = useState(false)
  const tagFrame = useRef(0)
  useFrame(({ camera }) => {
    if (!label) return
    tagFrame.current = (tagFrame.current + 1) % 10
    if (tagFrame.current !== 0) return
    const ortho = camera as OrthographicCamera
    const isOut = ortho.isOrthographicCamera === true && ortho.zoom < TAG_MIN_ZOOM
    if (isOut !== zoomedOut) setZoomedOut(isOut)
  })
  const tagVisible = label !== undefined && !cutsceneActive && !zoomedOut

  return (
    <group ref={group}>
      <primitive object={base.scene} />
      {bubble ? (
        <Html position={[0, bubbleY, 0]} center zIndexRange={[8, 0]} pointerEvents="none">
          <div className="npc-bubble">{bubble}</div>
        </Html>
      ) : null}
      {label && tagVisible ? (
        <Html position={[0, 2.05, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
          <div className="npc-tag">
            <span className="npc-tag-name">{label.name}</span>
            <span className="npc-tag-role">{label.role}</span>
          </div>
        </Html>
      ) : null}
    </group>
  )
}
