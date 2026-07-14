import { useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { attachHoverOutline } from '../interaction/hoverOutline'

export interface WhiteboardProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: () => void
}

const WIDTH = 1.5
const HEIGHT = 1.0
const MARKER_COLORS = ['#1a1a1a', '#c0392b', '#2166c9']

export function Whiteboard({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: WhiteboardProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  const removeOutline = useRef<(() => void) | null>(null)
  useEffect(() => {
    return () => removeOutline.current?.()
  }, [])
  const handleClick = onSelect
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect()
      }
    : undefined
  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={
        onSelect
          ? () => {
              document.body.style.cursor = 'pointer'
              if (!removeOutline.current && group.current) {
                removeOutline.current = attachHoverOutline(group.current)
              }
            }
          : undefined
      }
      onPointerOut={
        onSelect
          ? () => {
              document.body.style.cursor = 'auto'
              removeOutline.current?.()
              removeOutline.current = null
            }
          : undefined
      }
    >
      <mesh castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, 0.02]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.3} metalness={0} />
      </mesh>
      <mesh position={[0, -HEIGHT / 2 - 0.03, 0.03]} castShadow>
        <boxGeometry args={[WIDTH * 0.6, 0.04, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {MARKER_COLORS.map((color, i) => (
        <mesh
          key={color}
          position={[-0.15 + i * 0.12, -HEIGHT / 2 + 0.01, 0.05]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
