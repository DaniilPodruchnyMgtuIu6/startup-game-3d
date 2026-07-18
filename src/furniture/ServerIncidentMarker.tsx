import { useServerIncidentStore } from '../game/serverIncidentStore'
import type { ServerIncidentId } from '../game/serverIncidentCatalog'

// Emergency indicator over a rack while its incident is unresolved (Feature 11
// §31): a compact amber beacon + glow. Built from primitives, does not touch the
// navmesh or the mini-game interaction. Hidden while dormant/armed/resolved.
export function ServerIncidentMarker({ incidentId }: { incidentId: ServerIncidentId }) {
  const status = useServerIncidentStore((s) => s.incidents[incidentId].status)
  const active = status === 'pending' || status === 'running' || status === 'recovery-required' || status === 'recovering'
  if (!active) return null

  return (
    <group position={[0, 2.35, 0]}>
      <mesh>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color="#ffb03a" emissive="#ff8a1e" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <pointLight color="#ff8a1e" intensity={2.2} distance={2.4} position={[0, 0.1, 0]} />
    </group>
  )
}
