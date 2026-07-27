// Feature 18H §8: does the dialogue panel visually cover a cast member's
// head for the shot about to play? Projects each present character's eye
// point through the SAME frame the shot is about to settle on (not the
// current mid-transition camera, so the decision happens before the cut,
// matching "перед запуском shot" in the spec) via a throwaway
// PerspectiveCamera matching the cutscene rig's own fov/near/far - no DOM,
// no live three.js camera needed. Pure math, unit-testable like
// cinematicShots.ts.
import { PerspectiveCamera, Vector3 } from 'three'
import type { Point } from './cinematicShots'

// Matches CutsceneCamera.tsx (fov=40, near=0.05, far=100).
const CUTSCENE_FOV = 40
const CUTSCENE_NEAR = 0.05
const CUTSCENE_FAR = 100
const DEFAULT_ASPECT = 16 / 9

export interface ScreenPoint {
  x: number // 0 (left) .. 1 (right)
  y: number // 0 (top) .. 1 (bottom)
  inFront: boolean
}

export type DialoguePanelSide = 'center' | 'left' | 'right'

export function projectHeadsForShot(position: Point, target: Point, aspect: number, heads: Point[]): ScreenPoint[] {
  const camera = new PerspectiveCamera(CUTSCENE_FOV, aspect || DEFAULT_ASPECT, CUTSCENE_NEAR, CUTSCENE_FAR)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateMatrixWorld(true)
  const v = new Vector3()
  return heads.map((head) => {
    v.set(...head).project(camera)
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, inFront: v.z < 1 }
  })
}

// Must track `.dialogue-panel--cinematic` in ui.css: bottom-hugging band,
// max-width 72vw, centered by default. The height is a generous upper bound
// (portrait + text + button) so a real overlap is never missed on a short
// viewport, at the cost of occasionally shifting the panel when it would
// have just barely cleared a head - an acceptable false positive for a
// visual comfort check, never the other way round.
const PANEL_HEIGHT_FRACTION = 0.32
const PANEL_WIDTH_FRACTION = 0.72
const PANEL_SIDE_OFFSET_FRACTION = 0.05

function panelRect(side: DialoguePanelSide): { left: number; right: number; top: number } {
  const top = 1 - PANEL_HEIGHT_FRACTION
  if (side === 'left') return { left: PANEL_SIDE_OFFSET_FRACTION, right: PANEL_SIDE_OFFSET_FRACTION + PANEL_WIDTH_FRACTION, top }
  if (side === 'right') return { left: 1 - PANEL_SIDE_OFFSET_FRACTION - PANEL_WIDTH_FRACTION, right: 1 - PANEL_SIDE_OFFSET_FRACTION, top }
  const half = PANEL_WIDTH_FRACTION / 2
  return { left: 0.5 - half, right: 0.5 + half, top }
}

function coveredBy(head: ScreenPoint, side: DialoguePanelSide): boolean {
  if (!head.inFront) return false
  const rect = panelRect(side)
  return head.y >= rect.top && head.x >= rect.left && head.x <= rect.right
}

// Center is the existing default composition (§8 baseline from Wave 1) -
// only shifted when it would actually cover a head, and only to whichever
// side clears every head. If neither side is fully clear (a dead-center
// head that no horizontal shift can escape), pick the one covering fewer -
// never worse than staying centered.
export function pickDialoguePanelSide(heads: ScreenPoint[]): DialoguePanelSide {
  if (!heads.some((h) => coveredBy(h, 'center'))) return 'center'
  const left = heads.filter((h) => coveredBy(h, 'left')).length
  const right = heads.filter((h) => coveredBy(h, 'right')).length
  if (left === 0) return 'left'
  if (right === 0) return 'right'
  return left <= right ? 'left' : 'right'
}
