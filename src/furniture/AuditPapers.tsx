// 18E §5: a small stack of audit paperwork with a red findings folder. Mounted
// on Sonya's desk only while a corrective plan is open (deterministic from the
// persisted follow-up audit status) - the audit literally piles up on the PM.
export interface AuditPapersProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function AuditPapers({ position = [0, 0, 0], rotation = [0, 0, 0] }: AuditPapersProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* loose paper stack, slightly fanned */}
      <mesh position={[0, 0.006, 0]} castShadow>
        <boxGeometry args={[0.21, 0.012, 0.3]} />
        <meshStandardMaterial color="#f4f1e8" roughness={0.9} />
      </mesh>
      <mesh position={[0.015, 0.017, 0.01]} rotation={[0, 0.16, 0]}>
        <boxGeometry args={[0.21, 0.01, 0.3]} />
        <meshStandardMaterial color="#efece2" roughness={0.9} />
      </mesh>
      {/* red findings folder on top */}
      <mesh position={[-0.01, 0.028, -0.005]} rotation={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[0.23, 0.012, 0.32]} />
        <meshStandardMaterial color="#b64a3e" roughness={0.7} />
      </mesh>
    </group>
  )
}
