import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Group } from 'three'

// Floating "plan the sprint" badge above the whiteboard during planning. Same
// billboard + bob technique as the broken-server marker; the glyph (a task
// list) is baked into a canvas texture (test-safe, no drei/troika <Text>).

const BOB_AMP = 0.06
const BOB_SPEED = 2.6

function makeBadgeTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // rounded blue badge
  ctx.fillStyle = '#3573dd'
  ctx.beginPath()
  const r = 26
  ctx.roundRect(18, 22, 92, 84, r)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  // three "task" lines
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 3; i++) {
    const y = 44 + i * 20
    ctx.beginPath()
    ctx.arc(40, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(52, y - 4, 44, 8)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export interface PlanningMarkerProps {
  y?: number
  size?: number
}

export function PlanningMarker({ y = 0.85, size = 0.28 }: PlanningMarkerProps) {
  const ref = useRef<Group>(null)
  const elapsed = useRef(0)
  const texture = useMemo(makeBadgeTexture, [])
  useEffect(() => () => texture?.dispose(), [texture])

  useFrame((state, delta) => {
    if (!ref.current) return
    elapsed.current += delta
    ref.current.quaternion.copy(state.camera.quaternion)
    ref.current.position.y = y + Math.sin(elapsed.current * BOB_SPEED) * BOB_AMP
  })

  if (!texture) return null

  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh renderOrder={999}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
