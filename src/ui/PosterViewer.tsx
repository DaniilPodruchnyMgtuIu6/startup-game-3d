import { usePosterViewerStore } from '../game/posterViewerStore'
import './ui.css'

// Fullscreen zoom for a clicked wall poster - same overlay-backdrop pattern
// as PrototypeMock/WhiteboardPanel, just an <img> instead of a mock UI.
export function PosterViewer() {
  const src = usePosterViewerStore((s) => s.openSrc)
  const close = usePosterViewerStore((s) => s.closePosterViewer)

  if (!src) return null

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="poster-viewer" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <img className="poster-viewer-image" src={src} alt="Постер" />
      </div>
    </div>
  )
}
