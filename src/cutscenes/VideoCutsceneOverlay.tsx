import { useEffect, useRef } from 'react'
import { useVideoCutsceneStore, finishVideoCutscene } from './videoCutscene'
import '../ui/ui.css'

// Fullscreen player for story video clips. Muted (the game itself is silent;
// muted also guarantees autoplay). Click anywhere = skip. A hard watchdog
// finishes the scene even if the browser never fires ended/error (stalled
// stream), so a cutscene can never hang the game.

const WATCHDOG_MS = 30_000
// Some generated clips reach currentTime===duration (readyState HAVE_ENOUGH_
// DATA, fully decoded) without the browser ever firing 'ended' - a known MP4
// container-metadata quirk (moov duration/frame-count rounding), confirmed
// live on one of the data-loss clips: every frame played, currentTime sat at
// the exact duration, 'ended' just never came - only the 30s watchdog moved
// the scene on, a long visible stall on a clip that finished playing in
// under a second. Polling currentTime against duration catches this near-
// instantly without waiting for the browser's own end signal.
const END_EPSILON_S = 0.15

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
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          if (Number.isFinite(v.duration) && v.duration - v.currentTime <= END_EPSILON_S) finishVideoCutscene(true)
        }}
      />
      <div className="video-cutscene-skip">Пропустить ▸</div>
    </div>
  )
}
