import { Workstation } from '../furniture/Workstation'
import { Plant } from '../furniture/Plant'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { TrackLight } from '../furniture/TrackLight'
import { AcousticCeilingPanel } from '../furniture/AcousticCeilingPanel'
import { useCharacterStore } from '../character/characterStore'
import { ROOMS, roomCenter } from '../scene/layout'

const CLUSTER_CENTERS: [number, number][] = [
  [-3, -4],
  [3, -4],
  [-3, 4],
  [3, 4],
]
const CLUSTER_DESK_OFFSETS: [number, number][] = [
  [-1.1, -0.9],
  [1.1, -0.9],
  [-1.1, 0.9],
  [1.1, 0.9],
]
const CHAIR_COLORS = ['#c0392b', '#2166c9', '#2f9e59', '#e0a72b']

function WorkstationCluster({ center }: { center: [number, number] }) {
  return (
    <group position={[center[0], 0, center[1]]}>
      {CLUSTER_DESK_OFFSETS.map(([dx, dz], i) => (
        <Workstation
          key={i}
          position={[dx, 0, dz]}
          chairColor={CHAIR_COLORS[i % CHAIR_COLORS.length]}
          onSelect={(target) => useCharacterStore.getState().clickWorkstation(target)}
        />
      ))}
    </group>
  )
}

const PLANT_POSITIONS: [number, number][] = [
  [-5.4, -7.2],
  [5.4, -7.2],
  [-5.4, 7.2],
  [5.4, 7.2],
]

export function OpenSpace() {
  const center = roomCenter(ROOMS.openSpace)
  return (
    <group position={center}>
      {CLUSTER_CENTERS.map((c, i) => (
        <WorkstationCluster key={i} center={c} />
      ))}
      <Sofa
        position={[-1, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
      />
      <CoffeeTable position={[0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      {PLANT_POSITIONS.map(([x, z], i) => (
        <Plant key={i} position={[x, 0, z]} />
      ))}
      <TrackLight position={[-3, 2.7, -4]} withSpot />
      <TrackLight position={[3, 2.7, -4]} />
      <TrackLight position={[-3, 2.7, 4]} />
      <TrackLight position={[3, 2.7, 4]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, -1.5]} />
      <AcousticCeilingPanel position={[1.5, 2.65, 1.5]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, 1.5]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
