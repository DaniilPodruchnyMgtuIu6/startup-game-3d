import { useMaterials } from '../materials/MaterialsContext'

export interface DeskProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const TOP_WIDTH = 1.4
const TOP_DEPTH = 0.7
const TOP_THICKNESS = 0.04
const DESK_HEIGHT = 0.75
const LEG_SIZE = 0.05
const LEG_INSET = 0.08

export function Desk({ position = [0, 0, 0], rotation = [0, 0, 0] }: DeskProps) {
  const materials = useMaterials()
  const legHeight = DESK_HEIGHT - TOP_THICKNESS
  const legX = TOP_WIDTH / 2 - LEG_INSET
  const legZ = TOP_DEPTH / 2 - LEG_INSET
  const legPositions: [number, number, number][] = [
    [-legX, legHeight / 2, -legZ],
    [legX, legHeight / 2, -legZ],
    [-legX, legHeight / 2, legZ],
    [legX, legHeight / 2, legZ],
  ]

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, DESK_HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOP_WIDTH, TOP_THICKNESS, TOP_DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {legPositions.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[LEG_SIZE, legHeight, LEG_SIZE]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
