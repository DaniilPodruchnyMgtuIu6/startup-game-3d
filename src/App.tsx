import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { useControls } from 'leva'
import { Office } from './scene/Office'
import { SceneBackground } from './scene/SceneBackground'
import { IntroOverlay } from './ui/IntroOverlay'
import { DialoguePanel } from './ui/DialoguePanel'
import { TaskBoard } from './ui/TaskBoard'
import { MinigameOverlay } from './game/minigames/MinigameOverlay'
import { useCutsceneStore } from './cutscenes/cutsceneStore'
import { useServerIncidentsStore, type ServerRole } from './game/serverIncidentsStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { __startCutscene?: (id: string) => void }).__startCutscene = (id: string) =>
    useCutsceneStore.getState().startScene(id)
  ;(window as unknown as { __breakServer?: (role?: ServerRole) => void }).__breakServer = (role?: ServerRole) =>
    useServerIncidentsStore.getState().breakServer(role)
}

function ExposureControl({ exposure }: { exposure: number }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMappingExposure = exposure
  }, [gl, exposure])
  return null
}

export function App() {
  const { exposure, aoIntensity, bloomIntensity } = useControls('Render', {
    exposure: { value: 1.1, min: 0.5, max: 2, step: 0.05 },
    aoIntensity: { value: 2, min: 0, max: 6, step: 0.1 },
    bloomIntensity: { value: 0.4, min: 0, max: 2, step: 0.05 },
  })

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      >
        <ExposureControl exposure={exposure} />
        <SceneBackground />
        <Office />
        <EffectComposer>
          <N8AO aoRadius={1.2} intensity={aoIntensity} />
          <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} mipmapBlur />
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
        </EffectComposer>
      </Canvas>
      <IntroOverlay />
      <DialoguePanel />
      <TaskBoard />
      <MinigameOverlay />
    </>
  )
}
