import { useState } from 'react'
import { Html } from '@react-three/drei'
import { useAccessControlStore } from '../game/accessControlStore'
import '../ui/ui.css'

// A low-poly access-control reader by the entrance, shown only once СКУД is
// active (Feature 10 §16). Built from environment primitives - a slim post, a
// panel and a green indicator - placed at the south-east edge of the open space
// so it never blocks the navmesh or the door. Hover shows a short label.
export function AccessControlReader() {
  const active = useAccessControlStore((s) => s.accessControl.proposalStatus === 'active')
  const [hover, setHover] = useState(false)
  if (!active) return null

  return (
    <group position={[5.6, 0, 7.3]} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.12, 1, 0.12]} />
        <meshStandardMaterial color="#3a4250" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.06, 0]} castShadow>
        <boxGeometry args={[0.22, 0.32, 0.09]} />
        <meshStandardMaterial color="#242a34" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.16, 0.06]}>
        <boxGeometry args={[0.07, 0.07, 0.02]} />
        <meshStandardMaterial color="#5fe08a" emissive="#4caf6e" emissiveIntensity={1.4} />
      </mesh>
      {hover ? (
        <Html position={[0, 1.55, 0]} center zIndexRange={[10, 0]}>
          <div className="reader-tip">СКУД активна</div>
        </Html>
      ) : null}
    </group>
  )
}
