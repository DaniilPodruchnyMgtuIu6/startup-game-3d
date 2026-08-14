import { useEffect, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { attachHoverOutline } from '../interaction/hoverOutline'
import '../ui/ui.css'

export type WallPosterVariant = 'officeFlow' | 'lockScreen' | 'cisoMap'

export interface WallPosterProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  variant: WallPosterVariant
  // Optional: makes the poster clickable, with the same white hover outline
  // and floating name label used by every other clickable prop
  // (Whiteboard/AccessControlReader). Without onSelect the poster stays pure
  // visual, exactly as before - the two original decor posters are unaffected.
  label?: string
  onSelect?: () => void
}

const SIZE: Record<WallPosterVariant, [number, number]> = {
  officeFlow: [0.62, 0.82],
  lockScreen: [0.62, 0.82],
  // Landscape (source infographic aspect ratio) - much wider than the
  // portrait decor posters, meant to be walked up to and read.
  cisoMap: [1.1, 0.778],
}
const FRAME_DEPTH = 0.02

// Framed printed poster hung on a wall (open-space decor). Pure visual by
// default - registers no obstacle, like the acoustic ceiling panels.
export function WallPoster({ position = [0, 0, 0], rotation = [0, 0, 0], variant, label, onSelect }: WallPosterProps) {
  const materials = useMaterials()
  const poster =
    variant === 'officeFlow'
      ? materials.posterOfficeFlow
      : variant === 'lockScreen'
        ? materials.posterLockScreen
        : materials.posterCisoMap
  const [width, height] = SIZE[variant]
  const group = useRef<Group>(null)
  const removeOutline = useRef<(() => void) | null>(null)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    return () => removeOutline.current?.()
  }, [])

  const handleClick = onSelect
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect()
      }
    : undefined
  const handlePointerOver = onSelect
    ? () => {
        document.body.style.cursor = 'pointer'
        setHover(true)
        if (!removeOutline.current && group.current) {
          removeOutline.current = attachHoverOutline(group.current)
        }
      }
    : undefined
  const handlePointerOut = onSelect
    ? () => {
        document.body.style.cursor = 'auto'
        setHover(false)
        removeOutline.current?.()
        removeOutline.current = null
      }
    : undefined

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh castShadow>
        <boxGeometry args={[width + 0.05, height + 0.05, FRAME_DEPTH]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.002]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial {...poster} />
      </mesh>
      {hover && label ? (
        <Html position={[0, height / 2 + 0.18, 0]} center zIndexRange={[10, 0]}>
          <div className="reader-tip">{label}</div>
        </Html>
      ) : null}
    </group>
  )
}
