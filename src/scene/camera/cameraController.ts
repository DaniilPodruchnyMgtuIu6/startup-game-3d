import { create } from 'zustand'
import { Vector3 } from 'three'
import type CameraControlsImpl from 'camera-controls'

export type Point = [number, number, number]

let cutsceneControls: CameraControlsImpl | null = null
const tmpPosition = new Vector3()

// Whether the cutscene camera is the one currently rendered. IsometricCamera
// reads this to yield makeDefault/enabled to the cutscene rig without ever
// unmounting - so its own orbited position survives a cutscene untouched.
export const useCutsceneCameraStore = create<{ active: boolean }>()(() => ({ active: false }))

// CutsceneCamera registers its live CameraControls instance here so the
// cutscene director can command it without prop-drilling a ref through the
// scene graph.
export function registerCutsceneCameraControls(instance: CameraControlsImpl | null): void {
  cutsceneControls = instance
}

export function enterCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: true })
}

export function exitCutsceneCamera(): void {
  useCutsceneCameraStore.setState({ active: false })
}

// Smoothly moves the cutscene camera to look at `target` from `position`
// (defaults to its current position, so a scene can re-aim without
// relocating it). Resolves once the transition finishes - camera-controls'
// own setLookAt already returns that promise. durationMs temporarily
// overrides the controls' smoothTime for just this move, then restores it.
export async function flyTo(target: Point, position?: Point, durationMs = 1500): Promise<void> {
  if (!cutsceneControls) return
  const [px, py, pz] = position ?? cutsceneControls.getPosition(tmpPosition).toArray()
  const [tx, ty, tz] = target
  const previousSmoothTime = cutsceneControls.smoothTime
  cutsceneControls.smoothTime = Math.max(0.01, durationMs / 1000)
  try {
    await cutsceneControls.setLookAt(px, py, pz, tx, ty, tz, true)
  } finally {
    cutsceneControls.smoothTime = previousSmoothTime
  }
}
