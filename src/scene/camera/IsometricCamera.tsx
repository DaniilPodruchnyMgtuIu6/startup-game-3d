import { useEffect, useRef } from 'react'
import { OrthographicCamera, CameraControls } from '@react-three/drei'
import type CameraControlsImpl from 'camera-controls'

const CAMERA_POSITION: [number, number, number] = [22, 26, 22]
const CAMERA_TARGET: [number, number, number] = [0, 0.8, 0]
const BASE_AZIMUTH = Math.PI / 4
const AZIMUTH_SWING = 0.45

export function IsometricCamera() {
  const controlsRef = useRef<CameraControlsImpl>(null)

  useEffect(() => {
    controlsRef.current?.setLookAt(...CAMERA_POSITION, ...CAMERA_TARGET, false)
  }, [])

  return (
    <>
      <OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={28} near={0.1} far={100} />
      <CameraControls
        ref={controlsRef}
        makeDefault
        minZoom={18}
        maxZoom={45}
        minPolarAngle={0.75}
        maxPolarAngle={1.05}
        minAzimuthAngle={BASE_AZIMUTH - AZIMUTH_SWING}
        maxAzimuthAngle={BASE_AZIMUTH + AZIMUTH_SWING}
        minDistance={25}
        maxDistance={60}
      />
    </>
  )
}
