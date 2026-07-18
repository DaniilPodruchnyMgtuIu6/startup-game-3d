import { ROOMS } from './layout'

// Single source of truth for the whiteboard's location (Feature 15 polish: the
// board moved out of the far meeting-room corner). It now hangs on the
// open-space face of the server room's front wall — an existing white `paint`
// wall that faces the isometric camera and sits on the player's main route
// (the player spawns at [2, 0, 6], the NPC desk row is nearby). The material is
// the same shared `wallPaint` the old meeting-room wall uses, so no new wall or
// tint is introduced, and the static nav grid is untouched (the wall was
// already baked in; the board itself registers no obstacle).

export const WHITEBOARD_WALL_X = ROOMS.serverRoom.maxX // -6, the partition to the open space

// Server-room door is centered on the partition; the board hangs on the solid
// span south of it, clear of the doorway and of the focus/server room divider.
export const SERVER_DOOR_Z = (ROOMS.serverRoom.minZ + ROOMS.serverRoom.maxZ) / 2
export const SERVER_DOOR_WIDTH = 0.9

// 0.15 off the wall centerline (matching the old meeting-room offset) so the
// board never z-fights with the wall face; rotated to face the open space (+x).
export const WHITEBOARD_POSITION: [number, number, number] = [WHITEBOARD_WALL_X + 0.15, 1.4, 3.7]
export const WHITEBOARD_ROTATION_Y = Math.PI / 2
export const WHITEBOARD_WIDTH = 1.5

// Where a far click routes the player: right in front of the board, inside the
// walkable strip between the wall clearance and the nearest desk cluster.
export const WHITEBOARD_APPROACH_POINT: [number, number, number] = [WHITEBOARD_WALL_X + 1.0, 0, 3.7]
