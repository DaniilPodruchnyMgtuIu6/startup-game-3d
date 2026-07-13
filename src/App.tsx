import { Canvas } from '@react-three/fiber'

export function PlaceholderScene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </>
  )
}

export function App() {
  return (
    <Canvas camera={{ position: [4, 4, 4] }}>
      <PlaceholderScene />
    </Canvas>
  )
}
