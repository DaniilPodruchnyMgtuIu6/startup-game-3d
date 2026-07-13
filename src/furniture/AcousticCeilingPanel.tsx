export interface AcousticCeilingPanelProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  color?: string
}

export function AcousticCeilingPanel({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = '#8a9a8f',
}: AcousticCeilingPanelProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.03, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.5, 0.15, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.3, 6]} />
          <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
