import { Environment } from '@react-three/drei'

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[-14, 16, -10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[10, 8, 12]} intensity={0.3} />
    </>
  )
}

export function Lighting() {
  return (
    <>
      <SceneLights />
      <Environment files="/hdri/studio.hdr" background={false} environmentIntensity={0.6} />
    </>
  )
}
