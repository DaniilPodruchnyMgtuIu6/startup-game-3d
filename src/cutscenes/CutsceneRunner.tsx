import { useEffect, useRef } from 'react'
import { PlaceholderActorModel } from '../character/PlaceholderActorModel'
import { useCharacterStore } from '../character/characterStore'
import { setInputEnabled } from '../scene/camera/cameraController'
import { createDirector } from './director'
import { CUTSCENES } from './registry'
import { useCutsceneStore } from './cutsceneStore'

// Mounted once inside the office scene, alongside Npcs/MeetPmController. Runs
// whichever scene cutsceneStore.activeSceneId names: locks player input and
// camera dragging, pauses the listed NPCs' own brains, plays the scene
// script through to completion (or failure), then hands everything back.
export function CutsceneRunner() {
  const activeSceneId = useCutsceneStore((s) => s.activeSceneId)
  const actors = useCutsceneStore((s) => s.actors)
  const running = useRef<string | null>(null)

  useEffect(() => {
    if (!activeSceneId || running.current === activeSceneId) return
    const entry = CUTSCENES[activeSceneId]
    if (!entry) {
      console.error(`Unknown cutscene id: ${activeSceneId}`)
      useCutsceneStore.getState().endScene()
      return
    }
    running.current = activeSceneId
    setInputEnabled(false)
    const characterStore = useCharacterStore.getState()
    characterStore.setInputLocked(true)
    characterStore.setSceneOwned(new Set(entry.ownsNpcIds ?? []))

    const director = createDirector()
    void entry.script(director)
      .catch((error) => {
        console.error(`Cutscene "${activeSceneId}" threw`, error)
      })
      .finally(() => {
        running.current = null
        useCutsceneStore.getState().endScene()
        setInputEnabled(true)
        useCharacterStore.getState().setInputLocked(false)
        useCharacterStore.getState().setSceneOwned(new Set())
      })
  }, [activeSceneId])

  return (
    <>
      {Object.entries(actors).map(([id, actor]) => (
        <PlaceholderActorModel key={id} characterId={id} color={actor.color} />
      ))}
    </>
  )
}
