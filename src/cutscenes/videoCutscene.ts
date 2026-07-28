import { create } from 'zustand'

// 18H+: story video clips ("мультики") for key scenes, generated via
// Higgsfield and played fullscreen over the game. Deterministic gameplay is
// untouched - a clip is pure presentation before the in-engine aftermath.
//
// Contract: playVideoCutscene(src) resolves `true` when the clip finished
// (or the player skipped it) and `false` when it could not play (missing
// file, unsupported codec, headless browser) - the caller falls back to the
// full in-engine staging, so the game never depends on the asset.

interface VideoCutsceneState {
  src: string | null
  begin: (src: string) => void
  clear: () => void
}

export const useVideoCutsceneStore = create<VideoCutsceneState>((set) => ({
  src: null,
  begin: (src) => set({ src }),
  clear: () => set({ src: null }),
}))

let resolveActive: ((played: boolean) => void) | null = null

export function playVideoCutscene(src: string): Promise<boolean> {
  // one clip at a time; a second request while one is up fails to the fallback
  if (useVideoCutsceneStore.getState().src !== null) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    resolveActive = resolve
    useVideoCutsceneStore.getState().begin(src)
  })
}

// Called by the overlay: ended/skip → true, load error → false.
export function finishVideoCutscene(played: boolean): void {
  useVideoCutsceneStore.getState().clear()
  const resolve = resolveActive
  resolveActive = null
  resolve?.(played)
}
