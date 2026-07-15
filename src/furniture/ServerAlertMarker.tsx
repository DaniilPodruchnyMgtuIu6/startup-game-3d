import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Group } from 'three'

// Floating "!" badge above a broken server, the classic game "come deal with
// this" marker: billboarded to face the camera and gently bobbing. The glyph
// is baked into a canvas texture (not drei/troika <Text>, which needs WebGL
// SDF generation and breaks the WebGL-less test renderer).

const BOB_AMP = 0.07
const BOB_SPEED = 3.2

function makeBadgeTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.beginPath()
  ctx.arc(64, 64, 50, 0, Math.PI * 2)
  ctx.fillStyle = '#e5484d'
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 82px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('!', 64, 72)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export interface ServerAlertMarkerProps {
  y?: number
  size?: number
}

export function ServerAlertMarker({ y = 2.35, size = 0.32 }: ServerAlertMarkerProps) {
  const ref = useRef<Group>(null)
  const elapsed = useRef(0)
  const texture = useMemo(makeBadgeTexture, [])
  useEffect(() => () => texture?.dispose(), [texture])

  useFrame((state, delta) => {
    if (!ref.current) return
    elapsed.current += delta
    // billboard toward the camera (racks are unrotated, so a local copy of the
    // camera orientation faces the plane at the viewer) + a small bob
    ref.current.quaternion.copy(state.camera.quaternion)
    ref.current.position.y = y + Math.sin(elapsed.current * BOB_SPEED) * BOB_AMP
  })

  if (!texture) return null

  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh renderOrder={999}>
        <planeGeometry args={[size, size]} />
        {/* depthTest off so the marker reads clearly above the rack even when
            something would otherwise occlude it */}
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
