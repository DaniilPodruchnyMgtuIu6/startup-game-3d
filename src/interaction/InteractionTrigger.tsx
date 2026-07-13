import { useCallback } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { computeTriggerPayload, type TriggerTarget } from './triggerPayload'

export interface InteractionTriggerProps {
  position?: [number, number, number]
  size?: [number, number, number]
  onTrigger?: (target: TriggerTarget) => void
}

export function InteractionTrigger({ position = [0, 0, 0], size = [0.7, 0.6, 0.7], onTrigger }: InteractionTriggerProps) {
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onTrigger?.(computeTriggerPayload(event.object))
    },
    [onTrigger],
  )

  if (!onTrigger) return null

  return (
    <mesh
      position={position}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
