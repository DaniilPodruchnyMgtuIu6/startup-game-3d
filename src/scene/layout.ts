export const BUILDING = {
  minX: -12,
  maxX: 12,
  minZ: -8,
  maxZ: 8,
  wallHeight: 2.8,
  wallThickness: 0.2,
  cutawayHeight: 0.9,
  floorThickness: 0.1,
} as const

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type RoomName =
  | 'openSpace'
  | 'meetingRoom'
  | 'focusRoom'
  | 'serverRoom'
  | 'ceoOffice'
  | 'kitchen'
  | 'gameRoom'

const SIDE_COLUMN_WIDTH = 6
const ROW_DEPTH = (BUILDING.maxZ - BUILDING.minZ) / 3

export const ROOMS: Record<RoomName, RoomBounds> = {
  meetingRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.minZ + ROW_DEPTH,
  },
  focusRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ + ROW_DEPTH,
    maxZ: BUILDING.minZ + 2 * ROW_DEPTH,
  },
  serverRoom: {
    minX: BUILDING.minX,
    maxX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ + 2 * ROW_DEPTH,
    maxZ: BUILDING.maxZ,
  },
  ceoOffice: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.minZ + ROW_DEPTH,
  },
  kitchen: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ + ROW_DEPTH,
    maxZ: BUILDING.minZ + 2 * ROW_DEPTH,
  },
  gameRoom: {
    minX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX,
    minZ: BUILDING.minZ + 2 * ROW_DEPTH,
    maxZ: BUILDING.maxZ,
  },
  openSpace: {
    minX: BUILDING.minX + SIDE_COLUMN_WIDTH,
    maxX: BUILDING.maxX - SIDE_COLUMN_WIDTH,
    minZ: BUILDING.minZ,
    maxZ: BUILDING.maxZ,
  },
}

export function roomCenter(bounds: RoomBounds): [number, number, number] {
  return [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]
}

export function roomSize(bounds: RoomBounds): { width: number; depth: number } {
  return { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ }
}
