import { useCinematicStore } from '../game/cinematics/cinematicDirector'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import './ui.css'

// Feature 18D §8: letterbox bars while a cinematic or a scripted cutscene is
// running - the visual signal that we are "in a scene". Pure presentation:
// pointer events pass through, subtitles (DialoguePanel) render above the
// bottom bar's safe area.
export function CinematicBars() {
  const cinematic = useCinematicStore((s) => s.active)
  const cutscene = useCutsceneStore((s) => s.activeSceneId !== null)
  const active = cinematic || cutscene
  return (
    <div className={`cinematic-bars${active ? ' cinematic-bars--active' : ''}`} aria-hidden>
      <div className="cinematic-bar cinematic-bar--top" />
      <div className="cinematic-bar cinematic-bar--bottom" />
    </div>
  )
}
