import { create } from 'zustand'

// Fullscreen inspection for wall posters that carry real content worth
// reading up close (e.g. the CISO competency map) - purely presentational,
// no gameplay effect, not persisted (an open viewer should never survive a
// reload).

interface PosterViewerState {
  openSrc: string | null
  openPosterViewer: (src: string) => void
  closePosterViewer: () => void
}

export const usePosterViewerStore = create<PosterViewerState>((set) => ({
  openSrc: null,
  openPosterViewer: (src) => set({ openSrc: src }),
  closePosterViewer: () => set({ openSrc: null }),
}))
