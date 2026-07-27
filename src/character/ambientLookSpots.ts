// 18H Wave 3 (§14 "минимум 3" additional ambient activities): fixed standing
// spots for window-look and whiteboard-glance. Both reuse the real 'look'
// clip via CLICK_PERFORM_ACTIVITY (not the older LOOK_START/'looking' state)
// specifically because that event carries a full Target - entryFacing lands
// the character actually facing the window/board, not just wherever the
// last walking step happened to point.
import type { Target } from './characterMachine'
import { WHITEBOARD_POSITION } from '../scene/whiteboardSpot'
import { BUILDING } from '../scene/layout'

const [BOARD_X, , BOARD_Z] = WHITEBOARD_POSITION
const faceBoard = (x: number, z: number) => Math.atan2(BOARD_X - x, BOARD_Z - z)

// Clear of the kickoff meeting slots (z in [2.8, 5.2]) and the whiteboard's
// own approach point (WHITEBOARD_APPROACH_POINT, z=3.7) - a separate, lower
// spot so an ambient glance never crowds a real meeting scene.
const GLANCE_POINT: [number, number, number] = [-5, 0, 1.5]
export const WHITEBOARD_GLANCE_TARGET: Target = { point: GLANCE_POINT, facing: faceBoard(GLANCE_POINT[0], GLANCE_POINT[2]) }

// Open space borders the building's real south glass wall at BUILDING.minZ
// (CurtainWall, Building.tsx) - stand just inside it, facing outward (-Z).
const WINDOW_POINT: [number, number, number] = [0, 0, BUILDING.minZ + 0.7]
export const WINDOW_LOOK_TARGET: Target = { point: WINDOW_POINT, facing: Math.PI }
