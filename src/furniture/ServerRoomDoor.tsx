import { useMaterials } from '../materials/MaterialsContext'

export interface ServerRoomDoorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1
const FRAME_WIDTH = 0.08
const FRAME_DEPTH = 0.26
// The frame overlaps the wall reveal by this much on every side. Without the
// overlap the frame faces sit exactly coplanar with the wall's cut faces and
// z-fight (visible as light flickering inside the opening).
const REVEAL_OVERLAP = 0.02

// Dresses the server room's bare wall opening as a proper secured doorway:
// metal frame and an access keypad. The opening itself stays clear.
export function ServerRoomDoor({ position = [0, 0, 0], rotation = [0, 0, 0] }: ServerRoomDoorProps) {
  const materials = useMaterials()
  const jambX = DOOR_WIDTH / 2 - REVEAL_OVERLAP + FRAME_WIDTH / 2
  const jambHeight = DOOR_HEIGHT + FRAME_WIDTH - REVEAL_OVERLAP
  const keypadX = -(DOOR_WIDTH / 2 + FRAME_WIDTH + 0.12)

  return (
    <group position={position} rotation={rotation}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * jambX, jambHeight / 2, 0]} castShadow>
          <boxGeometry args={[FRAME_WIDTH, jambHeight, FRAME_DEPTH]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT - REVEAL_OVERLAP + FRAME_WIDTH / 2, 0]} castShadow>
        <boxGeometry args={[DOOR_WIDTH + FRAME_WIDTH * 2, FRAME_WIDTH, FRAME_DEPTH]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[keypadX, 1.25, FRAME_DEPTH / 2]}>
        <boxGeometry args={[0.1, 0.14, 0.03]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[keypadX, 1.29, FRAME_DEPTH / 2 + 0.017]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial {...materials.ledGreen} />
      </mesh>
    </group>
  )
}
