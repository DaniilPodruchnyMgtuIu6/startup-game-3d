export interface WindowSkylineProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const BUILDINGS: { x: number; width: number; height: number }[] = [
  { x: -3.5, width: 1.2, height: 3.5 },
  { x: -2.1, width: 0.9, height: 5.2 },
  { x: -0.9, width: 1.4, height: 4.0 },
  { x: 0.6, width: 1.0, height: 6.0 },
  { x: 1.9, width: 1.3, height: 4.6 },
  { x: 3.3, width: 1.0, height: 3.2 },
]

export function WindowSkyline({ position = [0, 0, 0], rotation = [0, 0, 0] }: WindowSkylineProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color="#9fc4e0" roughness={1} metalness={0} emissive="#7fa8c9" emissiveIntensity={0.15} />
      </mesh>
      {BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.height / 2 - 2, -0.05]}>
          <boxGeometry args={[b.width, b.height, 0.4]} />
          <meshStandardMaterial color="#5c6b78" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}
