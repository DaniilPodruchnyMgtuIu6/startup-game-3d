import { useMaterials } from '../materials/MaterialsContext'
import { cloneRepeated } from '../materials/cloneRepeated'
import { BUILDING } from './layout'

const MULLION_SPACING = 1.5
const MULLION_WIDTH = 0.08

function CurtainWall({ axis, length, center }: { axis: 'x' | 'z'; length: number; center: [number, number, number] }) {
  const materials = useMaterials()
  const sillHeight = BUILDING.cutawayHeight
  const headerHeight = 0.1
  const glassHeight = BUILDING.wallHeight - sillHeight - headerHeight
  const size = (span: number, h: number): [number, number, number] =>
    axis === 'x' ? [span, h, BUILDING.wallThickness] : [BUILDING.wallThickness, h, span]

  const mullionCount = Math.max(2, Math.floor(length / MULLION_SPACING))
  const mullions = Array.from({ length: mullionCount + 1 }, (_, i) => {
    const t = i / mullionCount - 0.5
    const offset = t * length
    return axis === 'x'
      ? ([center[0] + offset, center[1] + sillHeight + glassHeight / 2, center[2]] as [number, number, number])
      : ([center[0], center[1] + sillHeight + glassHeight / 2, center[2] + offset] as [number, number, number])
  })

  return (
    <group>
      <mesh position={[center[0], sillHeight / 2, center[2]]} castShadow receiveShadow>
        <boxGeometry args={size(length, sillHeight)} />
        <meshStandardMaterial {...materials.wallPaint} />
      </mesh>
      <mesh position={[center[0], sillHeight + glassHeight / 2, center[2]]}>
        <boxGeometry args={size(length - MULLION_WIDTH, glassHeight)} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      {mullions.map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={size(MULLION_WIDTH, glassHeight)} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      <mesh position={[center[0], BUILDING.wallHeight - headerHeight / 2, center[2]]} castShadow>
        <boxGeometry args={size(length, headerHeight)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}

function CutawaySill({ axis, length, center }: { axis: 'x' | 'z'; length: number; center: [number, number, number] }) {
  const materials = useMaterials()
  const size: [number, number, number] =
    axis === 'x'
      ? [length, BUILDING.cutawayHeight, BUILDING.wallThickness]
      : [BUILDING.wallThickness, BUILDING.cutawayHeight, length]
  return (
    <mesh position={[center[0], BUILDING.cutawayHeight / 2, center[2]]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...materials.wallPaint} />
    </mesh>
  )
}

export function Building() {
  const materials = useMaterials()
  const width = BUILDING.maxX - BUILDING.minX
  const depth = BUILDING.maxZ - BUILDING.minZ
  const floorTexture = {
    map: cloneRepeated(materials.floorWoodTextures.map, width / 2, depth / 2),
    normalMap: cloneRepeated(materials.floorWoodTextures.normalMap, width / 2, depth / 2),
    roughnessMap: cloneRepeated(materials.floorWoodTextures.roughnessMap, width / 2, depth / 2),
  }

  return (
    <group>
      <mesh position={[0, -BUILDING.floorThickness / 2, 0]} receiveShadow>
        <boxGeometry args={[width, BUILDING.floorThickness, depth]} />
        <meshStandardMaterial {...floorTexture} roughness={1} metalness={0} />
      </mesh>

      <CurtainWall axis="x" length={width} center={[0, 0, BUILDING.minZ]} />
      <CurtainWall axis="z" length={depth} center={[BUILDING.minX, 0, 0]} />
      <CutawaySill axis="x" length={width} center={[0, 0, BUILDING.maxZ]} />
      <CutawaySill axis="z" length={depth} center={[BUILDING.maxX, 0, 0]} />
    </group>
  )
}
