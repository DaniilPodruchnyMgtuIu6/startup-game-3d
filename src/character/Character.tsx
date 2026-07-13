import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'

const WALK_SPEED = 1.4
const SIT_SETTLE_MS = 1000
const BREW_MS = 3500

const CLIP_URLS = {
  idle: '/character/idle.glb',
  walk: '/character/walk.glb',
  sit: '/character/sit.glb',
  type: '/character/type.glb',
  drink: '/character/drink.glb',
} as const

const ANIMATION_FOR_STATE: Record<string, keyof typeof CLIP_URLS> = {
  idle: 'idle',
  walking: 'walk',
  sittingDown: 'sit',
  working: 'type',
  brewingCoffee: 'idle',
  drinkingCoffee: 'drink',
}

export function Character() {
  const base = useGLTF(CLIP_URLS.idle)
  const walk = useGLTF(CLIP_URLS.walk)
  const sit = useGLTF(CLIP_URLS.sit)
  const type = useGLTF(CLIP_URLS.type)
  const drink = useGLTF(CLIP_URLS.drink)

  const clips = useMemo(
    () => [base.animations[0], walk.animations[0], sit.animations[0], type.animations[0], drink.animations[0]],
    [base, walk, sit, type, drink],
  )

  const group = useRef<Group>(null)
  const { actions } = useAnimations(clips, group)

  const stateKind = useCharacterStore((s) => s.state.kind)

  useEffect(() => {
    const clipName = ANIMATION_FOR_STATE[stateKind] ?? 'idle'
    const action = actions[clipName]
    action?.reset().fadeIn(0.3).play()
    return () => {
      action?.fadeOut(0.3)
    }
  }, [stateKind, actions])

  useEffect(() => {
    if (stateKind === 'sittingDown') {
      const timer = setTimeout(() => useCharacterStore.getState().dispatch({ type: 'SETTLE_ELAPSED' }), SIT_SETTLE_MS)
      return () => clearTimeout(timer)
    }
    if (stateKind === 'brewingCoffee') {
      const timer = setTimeout(() => useCharacterStore.getState().dispatch({ type: 'BREW_ELAPSED' }), BREW_MS)
      return () => clearTimeout(timer)
    }
  }, [stateKind])

  useFrame((_, delta) => {
    const store = useCharacterStore.getState()
    if (store.state.kind === 'walking') {
      const target = store.state.path[store.state.nextIndex]
      const result = stepTowards(store.position, target, WALK_SPEED, delta, store.rotationY)
      store.setTransform(result.position, result.rotationY)
      if (result.reachedTarget) store.dispatch({ type: 'WAYPOINT_REACHED' })
    }
    if (group.current) {
      group.current.position.set(...store.position)
      group.current.rotation.y = store.rotationY
    }
  })

  return (
    <group ref={group}>
      <primitive object={base.scene} />
    </group>
  )
}

useGLTF.preload(CLIP_URLS.idle)
useGLTF.preload(CLIP_URLS.walk)
useGLTF.preload(CLIP_URLS.sit)
useGLTF.preload(CLIP_URLS.type)
useGLTF.preload(CLIP_URLS.drink)
