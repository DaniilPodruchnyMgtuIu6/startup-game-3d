import { describe, it, expect } from 'vitest'
import { projectHeadsForShot, pickDialoguePanelSide, type ScreenPoint } from './dialogueSafeArea'

describe('projectHeadsForShot (18H §8)', () => {
  it('projects a point at the look-at target to the center of the frame', () => {
    const [head] = projectHeadsForShot([0, 1.6, 3], [0, 1.5, 0], 16 / 9, [[0, 1.5, 0]])
    expect(head.inFront).toBe(true)
    expect(head.x).toBeCloseTo(0.5, 1)
    expect(head.y).toBeCloseTo(0.5, 1)
  })

  it('marks a point behind the camera as not in front', () => {
    const [head] = projectHeadsForShot([0, 1.6, 3], [0, 1.5, 0], 16 / 9, [[0, 1.5, 10]])
    expect(head.inFront).toBe(false)
  })

  it('a point to the right of the look-at axis projects with x > 0.5', () => {
    const [head] = projectHeadsForShot([0, 1.6, 3], [0, 1.5, 0], 16 / 9, [[1.2, 1.5, 0]])
    expect(head.x).toBeGreaterThan(0.5)
  })
})

describe('pickDialoguePanelSide (18H §8)', () => {
  const point = (x: number, y: number, inFront = true): ScreenPoint => ({ x, y, inFront })

  it('stays centered when no head is anywhere near the bottom band', () => {
    expect(pickDialoguePanelSide([point(0.5, 0.3)])).toBe('center')
  })

  it('stays centered when the bottom band is empty of heads entirely', () => {
    expect(pickDialoguePanelSide([])).toBe('center')
  })

  it('shifts left when a right-leaning head sits in the bottom band', () => {
    expect(pickDialoguePanelSide([point(0.85, 0.9)])).toBe('left')
  })

  it('shifts right when a left-leaning head sits in the bottom band', () => {
    expect(pickDialoguePanelSide([point(0.15, 0.9)])).toBe('right')
  })

  it('a dead-center head cannot be cleared by either side - falls to the deterministic tie-break', () => {
    expect(pickDialoguePanelSide([point(0.5, 0.9)])).toBe('left')
  })

  it('ignores a head that is behind the camera', () => {
    expect(pickDialoguePanelSide([point(0.85, 0.9, false)])).toBe('center')
  })

  it('with one head escapable only via left and another only via right, ties break to left', () => {
    // point(0.1) is covered by the 'left' rect only; point(0.8) is covered by
    // the 'center' rect (triggering the check) and the 'right' rect only -
    // each side still covers exactly one head, so the tie-break decides
    expect(pickDialoguePanelSide([point(0.1, 0.9), point(0.8, 0.9)])).toBe('left')
  })
})
