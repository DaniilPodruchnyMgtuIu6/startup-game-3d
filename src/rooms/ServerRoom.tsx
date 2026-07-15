import { Wall } from '../scene/Wall'
import { ServerRack } from '../furniture/ServerRack'
import { ServerRoomDoor } from '../furniture/ServerRoomDoor'
import { CableTray } from '../furniture/CableTray'
import { useMaterials } from '../materials/MaterialsContext'
import { cloneRepeated } from '../materials/cloneRepeated'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const RACK_X = [-1.8, -0.6, 0.6, 1.8]

function ConcreteFloorPatch({ width, depth }: { width: number; depth: number }) {
  const materials = useMaterials()
  const map = cloneRepeated(materials.floorConcreteTextures.map, width / 2, depth / 2)
  const normalMap = cloneRepeated(materials.floorConcreteTextures.normalMap, width / 2, depth / 2)
  const roughnessMap = cloneRepeated(materials.floorConcreteTextures.roughnessMap, width / 2, depth / 2)

  return (
    <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={map} normalMap={normalMap} roughnessMap={roughnessMap} roughness={1} metalness={0} />
    </mesh>
  )
}

export function ServerRoom() {
  const bounds = ROOMS.serverRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <ConcreteFloorPatch width={width} depth={depth} />
      <Wall
        axis="z"
        length={depth}
        center={[width / 2, 1.4, 0]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: depth / 2, width: 0.9 }}
      />
      <ServerRoomDoor position={[width / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      {RACK_X.map((x, i) => (
        <ServerRack key={x} position={[x, 0, 0]} seed={i} onRepair={() => {}} />
      ))}
      {/* overhead cabling running along the rack row, dropping into each rack */}
      <CableTray length={4.6} position={[0, 2.35, 0]} drops={RACK_X} dropLength={0.35} />
    </group>
  )
}
