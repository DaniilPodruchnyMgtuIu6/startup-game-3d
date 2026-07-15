import { useRef } from 'react'
import type { Group } from 'three'
import { useCharacterTransform } from './useCharacterTransform'

export interface PlaceholderActorModelProps {
  characterId: string
  color?: string
}

// Stand-in body for scene-only actors that don't have a real model yet (e.g.
// the security guards): a box torso and a smaller box head. Walks and turns
// through the exact same per-frame integration as a real skinned character -
// only the visual representation differs.
export function PlaceholderActorModel({ characterId, color = '#3a4a5c' }: PlaceholderActorModelProps) {
  const group = useRef<Group>(null)
  useCharacterTransform(characterId, group)

  return (
    <group ref={group}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.5, 1.3, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, 1.44, 0]} castShadow>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#e0c9a6" roughness={0.7} metalness={0} />
      </mesh>
    </group>
  )
}
