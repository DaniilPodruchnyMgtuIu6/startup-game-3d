import { useEffect, useRef } from 'react'
import { useVideoCutsceneStore, finishVideoCutscene } from './videoCutscene'
import '../ui/ui.css'

// Fullscreen player for story video clips. Muted (the game itself is silent;
// muted also guarantees autoplay). Click anywhere = skip. A hard watchdog
// finishes the scene even if the browser never fires ended/error (stalled
// stream), so a cutscene can never hang the game.

const WATCHDOG_MS = 30_000

export function VideoCutsceneOverlay() {
  const src = useVideoCutsceneStore((s) => s.src)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!src) return
    const watchdog = setTimeout(() => finishVideoCutscene(true), WATCHDOG_MS)
    return () => clearTimeout(watchdog)
  }, [src])

  if (!src) return null
  return (
    <div className="video-cutscene" onClick={() => finishVideoCutscene(true)}>
      <video
        ref={video}
        className="video-cutscene-player"
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={() => finishVideoCutscene(true)}
        onError={() => finishVideoCutscene(false)}
      />
      <div className="video-cutscene-skip">Пропустить ▸</div>
    </div>
  )
}
