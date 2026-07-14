import { describe, it, expect } from 'vitest'
import { useRef } from 'react'
import type { Group } from 'three'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useObstacle } from './useObstacle'
import { getObstacles } from './obstacles'

function Block({ position }: { position: [number, number, number] }) {
  const group = useRef<Group>(null)
  useObstacle(group)
  return (
    <group ref={group} position={position}>
      <mesh>
        <boxGeometry args={[1, 2, 1]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

describe('useObstacle', () => {
  it('registers the world-space ground footprint and cleans up on unmount', async () => {
    const before = getObstacles().length
    const renderer = await ReactThreeTestRenderer.create(<Block position={[2, 0, 3]} />)

    expect(getObstacles().length).toBe(before + 1)
    const box = getObstacles()[getObstacles().length - 1]
    expect(box.minX).toBeCloseTo(1.5)
    expect(box.maxX).toBeCloseTo(2.5)
    expect(box.minZ).toBeCloseTo(2.5)
    expect(box.maxZ).toBeCloseTo(3.5)

    await renderer.unmount()
    expect(getObstacles().length).toBe(before)
  })
})
