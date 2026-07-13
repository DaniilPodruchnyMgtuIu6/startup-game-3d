import { useMaterials } from '../materials/MaterialsContext'

export interface BookshelfProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.8
const DEPTH = 0.3
const HEIGHT = 2.0
const BOARD_THICKNESS = 0.025
const SHELF_YS = [0.02, 0.55, 1.1, 1.65]

const BOOK_COLORS = ['#8a3b3b', '#3b5d8a', '#3b8a5d', '#8a7a3b', '#5d3b8a', '#3b8a7a']

interface Book {
  x: number
  width: number
  height: number
  color: string
}

function booksFor(shelfIndex: number): Book[] {
  const startX = -WIDTH / 2 + 0.1
  let x = startX
  const books: Book[] = []
  for (let i = 0; i < 6; i++) {
    const width = 0.03 + ((i + shelfIndex) % 3) * 0.008
    const height = 0.22 + ((i + shelfIndex) % 4) * 0.02
    books.push({ x: x + width / 2, width, height, color: BOOK_COLORS[(i + shelfIndex * 2) % BOOK_COLORS.length] })
    x += width + 0.006
  }
  return books
}

export function Bookshelf({ position = [0, 0, 0], rotation = [0, 0, 0] }: BookshelfProps) {
  const materials = useMaterials()
  const sideX = WIDTH / 2 - BOARD_THICKNESS / 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-sideX, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_THICKNESS, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      <mesh position={[sideX, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_THICKNESS, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {SHELF_YS.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH - BOARD_THICKNESS * 2, BOARD_THICKNESS, DEPTH]} />
          <meshStandardMaterial {...materials.woodDesktop} />
        </mesh>
      ))}
      {[1, 2].flatMap((shelfIndex) =>
        booksFor(shelfIndex).map((book, i) => (
          <mesh
            key={`${shelfIndex}-${i}`}
            position={[book.x, SHELF_YS[shelfIndex] + book.height / 2 + BOARD_THICKNESS / 2, 0]}
            castShadow
          >
            <boxGeometry args={[book.width, book.height, DEPTH - 0.06]} />
            <meshStandardMaterial color={book.color} roughness={0.7} metalness={0} />
          </mesh>
        )),
      )}
    </group>
  )
}
