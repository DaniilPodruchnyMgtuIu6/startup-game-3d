import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, Color, SRGBColorSpace } from 'three'

const TOP = '#46586e'
const BOTTOM = '#1d2733'

// Deep blue-grey studio backdrop behind the building. Implemented as a
// procedural gradient texture on scene.background (not CSS behind a
// transparent canvas) so it composes correctly with the EffectComposer stack.
export function SceneBackground() {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      // test environments without a 2D canvas - solid tone fallback
      scene.background = new Color(BOTTOM)
      return () => {
        scene.background = null
      }
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, TOP)
    gradient.addColorStop(1, BOTTOM)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    scene.background = texture
    return () => {
      texture.dispose()
      scene.background = null
    }
  }, [scene])

  return null
}
