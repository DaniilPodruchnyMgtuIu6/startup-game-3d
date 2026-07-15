import { buildPath, type Point, type PathHints } from './navigation'

export interface Target {
  point: Point
  facing: number
}

type ArrivalGoal =
  | { kind: 'idle' }
  | { kind: 'sit'; target: Target }
  | { kind: 'brew'; target: Target }
  | { kind: 'sitIdle'; target: Target }
  | { kind: 'sofaSit'; target: Target }
  | { kind: 'repair'; target: Target; role: string }

export type CharacterState =
  | { kind: 'idle' }
  | { kind: 'walking'; path: Point[]; nextIndex: number; onArrive: ArrivalGoal }
  | { kind: 'sittingDown'; target: Target }
  | { kind: 'working'; target: Target }
  | { kind: 'brewingCoffee'; target: Target }
  | { kind: 'drinkingCoffee'; target: Target }
  | { kind: 'sittingIdle'; target: Target }
  | { kind: 'sofaSitting'; target: Target }
  | { kind: 'repairing'; target: Target; role: string }
  | { kind: 'talking' }
  | { kind: 'looking' }

export type CharacterEvent =
  | { type: 'CLICK_FLOOR'; point: Point }
  | { type: 'CLICK_WORKSTATION'; target: Target }
  | { type: 'CLICK_COFFEE_MACHINE'; target: Target }
  | { type: 'CLICK_SEAT'; target: Target }
  | { type: 'CLICK_SOFA'; target: Target }
  | { type: 'CLICK_SERVER'; target: Target; role: string }
  | { type: 'REPAIR_DONE' }
  | { type: 'WAYPOINT_REACHED' }
  | { type: 'SETTLE_ELAPSED' }
  | { type: 'BREW_ELAPSED' }
  | { type: 'TALK_START' }
  | { type: 'TALK_END' }
  | { type: 'LOOK_START' }
  | { type: 'LOOK_END' }

// While seated the character's rotation IS the seat's facing - reuse it so a
// character stands up forward off the seat instead of through its backrest.
const SEATED_KINDS = new Set(['sittingDown', 'working', 'sittingIdle', 'sofaSitting'])

export function nextState(
  current: CharacterState,
  event: CharacterEvent,
  position: Point,
  rotationY = 0,
): CharacterState {
  const exitFacing = SEATED_KINDS.has(current.kind) ? rotationY : undefined
  switch (event.type) {
    case 'CLICK_FLOOR':
      return startWalking(position, event.point, { kind: 'idle' }, { exitFacing })
    case 'CLICK_WORKSTATION':
      return startWalking(position, event.target.point, { kind: 'sit', target: event.target }, { exitFacing, entryFacing: event.target.facing })
    case 'CLICK_COFFEE_MACHINE':
      return startWalking(position, event.target.point, { kind: 'brew', target: event.target }, { exitFacing, entryFacing: event.target.facing })
    case 'CLICK_SEAT':
      return startWalking(position, event.target.point, { kind: 'sitIdle', target: event.target }, { exitFacing, entryFacing: event.target.facing })
    case 'CLICK_SOFA':
      return startWalking(position, event.target.point, { kind: 'sofaSit', target: event.target }, { exitFacing, entryFacing: event.target.facing })
    case 'CLICK_SERVER':
      return startWalking(position, event.target.point, { kind: 'repair', target: event.target, role: event.role }, { exitFacing, entryFacing: event.target.facing })
    case 'REPAIR_DONE':
      return current.kind === 'repairing' ? { kind: 'idle' } : current
    case 'WAYPOINT_REACHED':
      return advanceWaypoint(current)
    case 'SETTLE_ELAPSED':
      return current.kind === 'sittingDown' ? { kind: 'working', target: current.target } : current
    case 'BREW_ELAPSED':
      return current.kind === 'brewingCoffee' ? { kind: 'drinkingCoffee', target: current.target } : current
    case 'TALK_START':
      return { kind: 'talking' }
    case 'TALK_END':
      return current.kind === 'talking' ? { kind: 'idle' } : current
    case 'LOOK_START':
      return { kind: 'looking' }
    case 'LOOK_END':
      return current.kind === 'looking' ? { kind: 'idle' } : current
  }
}

function startWalking(from: Point, to: Point, onArrive: ArrivalGoal, hints: PathHints): CharacterState {
  return { kind: 'walking', path: buildPath(from, to, hints), nextIndex: 0, onArrive }
}

function advanceWaypoint(current: CharacterState): CharacterState {
  if (current.kind !== 'walking') return current
  const nextIndex = current.nextIndex + 1
  if (nextIndex >= current.path.length) return arrive(current.onArrive)
  return { ...current, nextIndex }
}

function arrive(goal: ArrivalGoal): CharacterState {
  switch (goal.kind) {
    case 'idle':
      return { kind: 'idle' }
    case 'sit':
      return { kind: 'sittingDown', target: goal.target }
    case 'brew':
      return { kind: 'brewingCoffee', target: goal.target }
    case 'sitIdle':
      return { kind: 'sittingIdle', target: goal.target }
    case 'sofaSit':
      return { kind: 'sofaSitting', target: goal.target }
    case 'repair':
      return { kind: 'repairing', target: goal.target, role: goal.role }
  }
}
