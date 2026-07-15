import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { Vector3, type Group, type Object3D } from 'three'
import { useCharacterStore } from './characterStore'
import { useCharacterTransform } from './useCharacterTransform'
import { buildHeldMug, disposeHeldProp } from './heldProps'
import type { CharacterModelConfig, ClipName } from './characters/definition'

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
}

// Renders one character (player or NPC): its skinned model, animation
// crossfades driven by the shared state machine, and per-frame movement along
// the pathfinding waypoints. All characters go through the same store, grid
// and obstacle avoidance.
export function CharacterModel({ characterId, config }: CharacterModelProps) {
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
    const action = actions[resolveClip(stateKind, availableClips)]
    action?.reset().fadeIn(0.3).play()
    return () => {
      action?.fadeOut(0.3)
    }
  }, [stateKind, actions, availableClips])

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

  useCharacterTransform(characterId, group)

  return (
    <group ref={group}>
      <primitive object={base.scene} />
    </group>
  )
}
