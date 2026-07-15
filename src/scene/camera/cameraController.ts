import { Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'

export type Point = [number, number, number]

let controls: CameraControlsImpl | null = null
const tmpPosition = new Vector3()

// IsometricCamera registers its live CameraControls instance here so code
// outside the R3F tree (the cutscene director) can command the camera
// without prop-drilling a ref through the scene graph.
export function registerCameraControls(instance: CameraControlsImpl | null): void {
  controls = instance
}

// Smoothly moves the camera to look at `target` from `position` (defaults to
// the camera's current position, so a scene can re-aim without relocating
// it). Resolves once the transition finishes - camera-controls' own
// setLookAt already returns that promise. durationMs temporarily overrides
// the controls' smoothTime for just this move, then restores it.
export async function flyTo(target: Point, position?: Point, durationMs = 1500): Promise<void> {
  if (!controls) return
  const [px, py, pz] = position ?? controls.getPosition(tmpPosition).toArray()
  const [tx, ty, tz] = target
  const previousSmoothTime = controls.smoothTime
  controls.smoothTime = Math.max(0.01, durationMs / 1000)
  try {
    await controls.setLookAt(px, py, pz, tx, ty, tz, true)
  } finally {
    controls.smoothTime = previousSmoothTime
  }
}

export function setInputEnabled(enabled: boolean): void {
  if (controls) controls.enabled = enabled
}
