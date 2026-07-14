import { useCallback, useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import { computeTriggerPayload, type TriggerTarget } from './triggerPayload'
import { registerInteraction, type InteractionKind } from './interactionRegistry'

export interface InteractionTriggerProps {
  position?: [number, number, number]
  size?: [number, number, number]
  onTrigger?: (target: TriggerTarget) => void
  // When given, the trigger also announces itself in the interaction registry
  // so NPCs can discover and use this spot.
  kind?: InteractionKind
}

export function InteractionTrigger({
  position = [0, 0, 0],
  size = [0.7, 0.6, 0.7],
  onTrigger,
  kind,
}: InteractionTriggerProps) {
  const mesh = useRef<Mesh>(null)

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onTrigger?.(computeTriggerPayload(event.object))
    },
    [onTrigger],
  )

  useEffect(() => {
    if (!kind || !mesh.current) return
    mesh.current.updateWorldMatrix(true, true)
    return registerInteraction(kind, computeTriggerPayload(mesh.current))
  }, [kind])

  if (!onTrigger && !kind) return null

  return (
    <mesh
      ref={mesh}
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
