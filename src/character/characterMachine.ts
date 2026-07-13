import { buildPath, type Point } from './navigation'

export interface Target {
  point: Point
  facing: number
}

type ArrivalGoal = { kind: 'idle' } | { kind: 'sit'; target: Target } | { kind: 'brew'; target: Target }

export type CharacterState =
  | { kind: 'idle' }
  | { kind: 'walking'; path: Point[]; nextIndex: number; onArrive: ArrivalGoal }
  | { kind: 'sittingDown'; target: Target }
  | { kind: 'working'; target: Target }
  | { kind: 'brewingCoffee'; target: Target }
  | { kind: 'drinkingCoffee'; target: Target }

export type CharacterEvent =
  | { type: 'CLICK_FLOOR'; point: Point }
  | { type: 'CLICK_WORKSTATION'; target: Target }
  | { type: 'CLICK_COFFEE_MACHINE'; target: Target }
  | { type: 'WAYPOINT_REACHED' }
  | { type: 'SETTLE_ELAPSED' }
  | { type: 'BREW_ELAPSED' }

export function nextState(current: CharacterState, event: CharacterEvent, position: Point): CharacterState {
  switch (event.type) {
    case 'CLICK_FLOOR':
      return startWalking(position, event.point, { kind: 'idle' })
    case 'CLICK_WORKSTATION':
      return startWalking(position, event.target.point, { kind: 'sit', target: event.target })
    case 'CLICK_COFFEE_MACHINE':
      return startWalking(position, event.target.point, { kind: 'brew', target: event.target })
    case 'WAYPOINT_REACHED':
      return advanceWaypoint(current)
    case 'SETTLE_ELAPSED':
      return current.kind === 'sittingDown' ? { kind: 'working', target: current.target } : current
    case 'BREW_ELAPSED':
      return current.kind === 'brewingCoffee' ? { kind: 'drinkingCoffee', target: current.target } : current
  }
}

function startWalking(from: Point, to: Point, onArrive: ArrivalGoal): CharacterState {
  return { kind: 'walking', path: buildPath(from, to), nextIndex: 0, onArrive }
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
  }
}
