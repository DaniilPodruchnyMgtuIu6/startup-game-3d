import { Desk } from './Desk'
import { Chair } from './Chair'
import { Monitor } from './Monitor'
import { Keyboard, Mouse, Mug } from './DeskAccessories'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface WorkstationProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  chairColor?: string
  onSelect?: (target: TriggerTarget) => void
}

export function Workstation({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  chairColor = '#3b3f46',
  onSelect,
}: WorkstationProps) {
  return (
    <group position={position} rotation={rotation}>
      <Desk />
      <Chair position={[0, 0, -0.55]} color={chairColor} />
      <Monitor position={[0, 0.75, 0.2]} rotation={[0, Math.PI, 0]} />
      <Keyboard position={[0, 0.76, -0.1]} />
      <Mouse position={[0.28, 0.765, -0.1]} />
      <Mug position={[-0.25, 0.75, -0.15]} />
      <InteractionTrigger position={[0, 0.3, -0.55]} size={[0.6, 0.6, 0.6]} onTrigger={onSelect} />
    </group>
  )
}
