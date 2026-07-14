import { useMaterials } from '../materials/MaterialsContext'

export interface WallDoorway {
  offset: number
  width: number
}

export interface WallProps {
  axis: 'x' | 'z'
  length: number
  center: [number, number, number]
  height: number
  thickness: number
  material: 'paint' | 'accentBlue' | 'accentGreen'
  doorway?: WallDoorway
}

const DOOR_HEIGHT = 2.1

const WALL_MATERIAL_KEY = {
  paint: 'wallPaint',
  accentBlue: 'wallAccentBlue',
  accentGreen: 'wallAccentGreen',
} as const

export function Wall({ axis, length, center, height, thickness, material, doorway }: WallProps) {
  const materials = useMaterials()
  const matProps = materials[WALL_MATERIAL_KEY[material]]
  const size = (span: number): [number, number, number] =>
    axis === 'x' ? [span, height, thickness] : [thickness, height, span]

  if (!doorway) {
    return (
      <mesh position={center} castShadow receiveShadow>
        <boxGeometry args={size(length)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    )
  }

  const halfLength = length / 2
  const doorCenterOffset = doorway.offset - halfLength
  const leftLength = doorway.offset - doorway.width / 2
  const rightLength = length - doorway.offset - doorway.width / 2
  const lintelHeight = height - DOOR_HEIGHT

  const offsetVec = (span: number): [number, number, number] =>
    axis === 'x' ? [center[0] + span, center[1], center[2]] : [center[0], center[1], center[2] + span]

  const leftCenter = offsetVec(-halfLength + leftLength / 2)
  const rightCenter = offsetVec(halfLength - rightLength / 2)
  const lintelCenter: [number, number, number] = [
    axis === 'x' ? center[0] + doorCenterOffset : center[0],
    center[1] + height / 2 - lintelHeight / 2,
    axis === 'z' ? center[2] + doorCenterOffset : center[2],
  ]

  return (
    <group>
      <mesh position={leftCenter} castShadow receiveShadow>
        <boxGeometry args={size(leftLength)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={rightCenter} castShadow receiveShadow>
        <boxGeometry args={size(rightLength)} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh position={lintelCenter} castShadow receiveShadow>
        <boxGeometry
          args={axis === 'x' ? [doorway.width, lintelHeight, thickness] : [thickness, lintelHeight, doorway.width]}
        />
        <meshStandardMaterial {...matProps} />
      </mesh>
    </group>
  )
}
