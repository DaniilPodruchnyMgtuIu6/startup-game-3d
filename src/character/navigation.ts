import { ROOMS, type RoomName } from '../scene/layout'

export type Point = [number, number, number]

type SideRoomName = Exclude<RoomName, 'openSpace'>

const SIDE_ROOMS: SideRoomName[] = ['meetingRoom', 'focusRoom', 'serverRoom', 'ceoOffice', 'kitchen', 'gameRoom']

function doorwayFor(room: SideRoomName): Point {
  const bounds = ROOMS[room]
  const isWestColumn = bounds.maxX <= 0
  const doorX = isWestColumn ? bounds.maxX : bounds.minX
  const doorZ = (bounds.minZ + bounds.maxZ) / 2
  return [doorX, 0, doorZ]
}

export const DOORWAYS: Record<SideRoomName, Point> = Object.fromEntries(
  SIDE_ROOMS.map((room) => [room, doorwayFor(room)]),
) as Record<SideRoomName, Point>

export function roomAt(point: Point): RoomName {
  const [x, , z] = point
  for (const name of SIDE_ROOMS) {
    const b = ROOMS[name]
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name
  }
  return 'openSpace'
}

export function buildPath(from: Point, to: Point): Point[] {
  const roomFrom = roomAt(from)
  const roomTo = roomAt(to)

  if (roomFrom === roomTo) return [to]

  const waypoints: Point[] = []
  if (roomFrom !== 'openSpace') waypoints.push(DOORWAYS[roomFrom as SideRoomName])
  if (roomTo !== 'openSpace') waypoints.push(DOORWAYS[roomTo as SideRoomName])
  waypoints.push(to)
  return waypoints
}
