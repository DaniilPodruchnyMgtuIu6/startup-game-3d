import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshStandardMaterial } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { ledStatusFor, ledMaterialKeyFor, ledIntensityAt } from './serverRackLights'

export interface ServerRackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  // Differentiates the deterministic LED status mix between racks.
  seed?: number
}

const WIDTH = 0.6
const DEPTH = 1.0
const HEIGHT = 2.0
const UNIT_COUNT = 8
const UNIT_HEIGHT = 0.18
const UNIT_GAP = 0.02

const PATCH_CABLE_COLORS = ['#d97b29', '#2166c9', '#d9c22b']

export function ServerRack({ position = [0, 0, 0], rotation = [0, 0, 0], seed = 0 }: ServerRackProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const ledMaterials = useRef<(MeshStandardMaterial | null)[]>([])
  const elapsed = useRef(0)
  const stackHeight = UNIT_COUNT * (UNIT_HEIGHT + UNIT_GAP)
  const startY = HEIGHT - 0.15 - stackHeight

  useFrame((_, delta) => {
    elapsed.current += delta
    ledMaterials.current.forEach((material, unit) => {
      if (!material) return
      material.emissiveIntensity = ledIntensityAt(ledStatusFor(seed, unit), unit, elapsed.current)
    })
  })

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * WIDTH) / 2 + side * 0.005, HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.01, HEIGHT - 0.02, DEPTH - 0.02]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {Array.from({ length: UNIT_COUNT }, (_, unit) => {
        const y = startY + unit * (UNIT_HEIGHT + UNIT_GAP)
        const ledKey = ledMaterialKeyFor(ledStatusFor(seed, unit))
        return (
          <group key={unit}>
            <mesh position={[0, y, DEPTH / 2 + 0.005]} castShadow>
              <boxGeometry args={[WIDTH - 0.04, UNIT_HEIGHT, 0.01]} />
              <meshStandardMaterial {...materials.metalFrame} />
            </mesh>
            <mesh position={[WIDTH / 2 - 0.06, y, DEPTH / 2 + 0.012]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial
                ref={(material) => {
                  ledMaterials.current[unit] = material
                }}
                {...materials[ledKey]}
              />
            </mesh>
          </group>
        )
      })}
      {/* patch cables looping between adjacent front units */}
      {PATCH_CABLE_COLORS.map((color, i) => {
        const unit = 1 + i * 2 + (seed % 2)
        const y = startY + unit * (UNIT_HEIGHT + UNIT_GAP) + (UNIT_HEIGHT + UNIT_GAP) / 2
        const x = -WIDTH / 2 + 0.12 + i * 0.14
        return (
          <mesh key={color} position={[x, y, DEPTH / 2 + 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[(UNIT_HEIGHT + UNIT_GAP) / 2, 0.008, 8, 16, Math.PI]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0} />
          </mesh>
        )
      })}
    </group>
  )
}
