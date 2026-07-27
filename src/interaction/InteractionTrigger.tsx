import { useCallback, useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import { computeTriggerPayload, type TriggerTarget } from './triggerPayload'
import { registerInteraction, type InteractionKind } from './interactionRegistry'
import { attachHoverOutline } from './hoverOutline'

export interface InteractionTriggerProps {
  position?: [number, number, number]
  // The trigger's forward (+z after this rotation) IS the facing a character
  // adopts on arrival (computeTriggerPayload) - rotate the trigger when the
  // character must face a different way than the furniture group's forward
  // (e.g. ping-pong sides face the table, the pull-up approach faces the bar).
  rotation?: [number, number, number]
  size?: [number, number, number]
  onTrigger?: (target: TriggerTarget) => void
  // When given, the trigger also announces itself in the interaction registry
  // so NPCs can discover and use this spot.
  kind?: InteractionKind
}

export function InteractionTrigger({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = [0.7, 0.6, 0.7],
  onTrigger,
  kind,
}: InteractionTriggerProps) {
  const mesh = useRef<Mesh>(null)
  const removeOutline = useRef<(() => void) | null>(null)

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onTrigger?.(computeTriggerPayload(event.object))
    },
    [onTrigger],
  )

  // No dependency array: like useObstacle, the registered target must follow
  // the trigger wherever a re-render moves it, or clicks/NPCs would aim at a
  // stale position.
  useEffect(() => {
    if (!kind || !mesh.current) return
    mesh.current.updateWorldMatrix(true, true)
    return registerInteraction(kind, computeTriggerPayload(mesh.current))
  })

  // drop the hover highlight if the trigger unmounts mid-hover
  useEffect(() => {
    return () => removeOutline.current?.()
  }, [])

  if (!onTrigger && !kind) return null

  return (
    <mesh
      ref={mesh}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
        // highlight the furniture piece this trigger belongs to
        if (!removeOutline.current && mesh.current?.parent) {
          removeOutline.current = attachHoverOutline(mesh.current.parent)
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
        removeOutline.current?.()
        removeOutline.current = null
      }}
    >
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
