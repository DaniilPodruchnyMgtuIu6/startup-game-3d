import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
import { Vector3, type Group, type Object3D } from 'three'
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

  return (
    <group ref={group}>
      <primitive object={base.scene} />
      {bubble ? (
        <Html position={[0, bubbleY, 0]} center zIndexRange={[8, 0]} pointerEvents="none">
          <div className="npc-bubble">{bubble}</div>
        </Html>
      ) : null}
      {label ? (
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
