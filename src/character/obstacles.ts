export interface Obstacle {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Furniture registers its ground footprint here on mount (see useObstacle).
// The walkability grid reads the live list, so navigation always avoids
// exactly what is rendered. The version counter lets the grid cache rebuild
// only when the furniture set actually changes.
const registry: Obstacle[] = []
let version = 0

export function registerObstacle(box: Obstacle): () => void {
  registry.push(box)
  version++
  return () => {
    const index = registry.indexOf(box)
    if (index !== -1) {
      registry.splice(index, 1)
      version++
    }
  }
}

export function getObstacles(): readonly Obstacle[] {
  return registry
}

// Raw footprint test (no walk margin). Used to pick seat entry/exit points
// that cross furniture margins but never actual furniture geometry.
export function isInsideRawObstacle(x: number, z: number): boolean {
  return registry.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)
}

export function getObstaclesVersion(): number {
  return version
}
