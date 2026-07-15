import { useCallback, useState } from 'react'
import { PerspectiveCamera, CameraControls } from '@react-three/drei'
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import type CameraControlsImpl from 'camera-controls'
import { registerCutsceneCameraControls, useCutsceneCameraStore } from './cameraController'

// Dedicated cutscene camera: a perspective rig (real depth/dramatic angle,
// which the gameplay OrthographicCamera can never produce) that becomes
// R3F's active camera only while a scripted scene is running. Mounted once
// alongside IsometricCamera and never unmounted, so toggling `active` is a
// clean swap rather than a remount that would reset either rig.
export function CutsceneCamera() {
  const active = useCutsceneCameraStore((s) => s.active)
  // CameraControls needs an explicit `camera` prop here - two rigs exist at
  // once (this one and IsometricCamera's), so it cannot rely on "whichever
  // camera is currently ambient-default." A state-backed ref (not a plain
  // useRef) is required because <CameraControls> can't mount until the
  // camera instance exists.
  const [camera, setCamera] = useState<PerspectiveCameraImpl | null>(null)
  const attachControls = useCallback((instance: CameraControlsImpl | null) => {
    registerCutsceneCameraControls(instance)
  }, [])

  return (
    <>
      <PerspectiveCamera ref={setCamera} makeDefault={active} position={[0, 2, 6]} fov={40} near={0.05} far={100} />
      {camera && <CameraControls ref={attachControls} camera={camera} enabled={false} />}
    </>
  )
}
