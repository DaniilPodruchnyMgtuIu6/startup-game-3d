import { useCallback } from 'react'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'
import { BUILDING } from '../layout'
import { useCutsceneCameraStore } from './cameraController'

const CAMERA_POSITION: [number, number, number] = [22, 26, 22]
const CAMERA_TARGET: [number, number, number] = [0, 0.8, 0]
const PAN_PADDING = 3

// Keeps orbiting free of the building's footprint - the target can pan
// anywhere inside, but not drift off into empty space while orbiting.
const PAN_BOUNDARY = new Box3(
  new Vector3(BUILDING.minX - PAN_PADDING, 0, BUILDING.minZ - PAN_PADDING),
  new Vector3(BUILDING.maxX + PAN_PADDING, BUILDING.wallHeight, BUILDING.maxZ + PAN_PADDING),
)

export function IsometricCamera() {
  // Yields makeDefault/enabled to the cutscene camera while one is active -
  // this rig is never unmounted, so its orbited setLookAt state is exactly
  // where the player left it once a cutscene ends.
  const cutsceneActive = useCutsceneCameraStore((s) => s.active)

  // A callback ref (not useEffect + useRef) because CameraControls' internal
  // camera-controls instance is recreated once OrthographicCamera's makeDefault
  // effect swaps in the real camera (its first instance briefly wraps R3F's
  // stock default camera) — a one-shot effect would orient that discarded
  // instance and leave the real one at its identity rotation.
  const attachControls = useCallback((instance: CameraControlsImpl | null) => {
    instance?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false)
    instance?.setBoundary(PAN_BOUNDARY)
  }, [])

  return (
    <>
      <OrthographicCamera makeDefault={!cutsceneActive} position={CAMERA_POSITION} zoom={28} near={0.1} far={150} />
      <CameraControls
        ref={attachControls}
        makeDefault={!cutsceneActive}
        enabled={!cutsceneActive}
        minZoom={12}
        maxZoom={70}
        minPolarAngle={0.3}
        maxPolarAngle={1.4}
        minDistance={14}
        maxDistance={75}
        boundaryFriction={0.9}
      />
    </>
  )
}
