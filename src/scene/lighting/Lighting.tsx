import { useRef } from 'react'
import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils, type AmbientLight, type DirectionalLight } from 'three'
import { useGameOutcomeStore } from '../../game/gameOutcomeStore'
import { useServerIncidentsStore } from '../../game/serverIncidentsStore'
import { useAccessControlStore } from '../../game/accessControlStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../../game/securityAuditStore'
import { useSprintStore } from '../../game/sprintStore'
import { LIGHTING_PRESETS, resolveLightingState } from './lightingStates'

// Feature 18E §6: the light rig damps smoothly toward the preset of the
// CURRENT deterministic lighting state (no snaps, no real-time dependence).
// Faces stay readable in every state: ambient never drops below 0.24 and the
// key light never dies (see LIGHTING_PRESETS).
const DAMP = 2.2 // ~0.5s to close most of the gap

const tmpColor = new Color()

function dampColor(target: Color, hex: string, dt: number) {
  target.lerp(tmpColor.set(hex), Math.min(1, dt * DAMP))
}

export function SceneLights() {
  const ambientRef = useRef<AmbientLight>(null)
  const keyRef = useRef<DirectionalLight>(null)
  const fillRef = useRef<DirectionalLight>(null)

  // subscribe to the drivers so the state resolves reactively (cheap selectors)
  const outcomeStatus = useGameOutcomeStore((s) => s.status)
  const anyRackDown = useServerIncidentsStore((s) =>
    Object.values(s.racks).some((r) => r.status === 'broken' || r.status === 'repairing'),
  )
  const intrusionActive = useAccessControlStore((s) =>
    ['armed', 'pending', 'running'].includes(s.intrusion.status as string),
  )
  const auditBlocking = useSecurityAuditStore((s) => isFollowUpAuditBlocking(s.followUpAudit))
  const sprintDay = useSprintStore((s) => s.day)

  const preset =
    LIGHTING_PRESETS[resolveLightingState({ outcomeStatus, anyRackDown, intrusionActive, auditBlocking, sprintDay })]

  useFrame((_, dt) => {
    const k = Math.min(1, dt * DAMP)
    if (ambientRef.current) {
      ambientRef.current.intensity = MathUtils.lerp(ambientRef.current.intensity, preset.ambientIntensity, k)
      dampColor(ambientRef.current.color, preset.ambientColor, dt)
    }
    if (keyRef.current) {
      keyRef.current.intensity = MathUtils.lerp(keyRef.current.intensity, preset.keyIntensity, k)
      dampColor(keyRef.current.color, preset.keyColor, dt)
    }
    if (fillRef.current) {
      fillRef.current.intensity = MathUtils.lerp(fillRef.current.intensity, preset.fillIntensity, k)
      dampColor(fillRef.current.color, preset.fillColor, dt)
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={preset.ambientIntensity} />
      <directionalLight
        ref={keyRef}
        position={[-14, 16, -10]}
        intensity={preset.keyIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-bias={-0.0005}
      />
      <directionalLight ref={fillRef} position={[10, 8, 12]} intensity={preset.fillIntensity} />
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
