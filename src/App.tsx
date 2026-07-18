import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { useControls } from 'leva'
import { Office } from './scene/Office'
import { SceneBackground } from './scene/SceneBackground'
import { IntroOverlay } from './ui/IntroOverlay'
import { DialoguePanel } from './ui/DialoguePanel'
import { WhiteboardPanel } from './ui/WhiteboardPanel'
import { SprintHud } from './ui/SprintHud'
import { SprintPhaseOverlay } from './ui/SprintPhaseOverlay'
import { FinancePanel } from './ui/FinancePanel'
import { TeamPanel } from './ui/TeamPanel'
import { DailyReport } from './ui/DailyReport'
import { PrototypeMock } from './ui/PrototypeMock'
import { SecurityStoryTrigger } from './game/securityStoryTrigger'
import { SecurityFollowUpAuditTrigger } from './game/SecurityFollowUpAuditTrigger'
import { AuditResultOverlay } from './ui/AuditResultOverlay'
import { MinigameOverlay } from './game/minigames/MinigameOverlay'
import { useCutsceneStore } from './cutscenes/cutsceneStore'
import { useServerIncidentsStore, type ServerRole } from './game/serverIncidentsStore'
import { useSecurityStoryStore } from './game/securityStoryStore'
import { useSprintStore } from './game/sprintStore'
import { hireSecuritySpecialist, reconcileSecurityHire } from './game/hireSecuritySpecialist'
import { useSecurityAuditStore } from './game/securityAuditStore'
import { initializeSecurityAuditIfReady } from './game/initializeSecurityAudit'

// Feature 07: repair any cross-store inconsistency between the staffing decision,
// the security hire record and its task after a load/migration (spec §17), once
// at startup before the scene mounts.
reconcileSecurityHire()
// Feature 08: create the corrective-action plan from an old save whose post-audit
// conversation is already completed (idempotent migration).
initializeSecurityAuditIfReady()

if (import.meta.env.DEV) {
  ;(window as unknown as { __startCutscene?: (id: string) => void }).__startCutscene = (id: string) =>
    useCutsceneStore.getState().startScene(id)
  ;(window as unknown as { __breakServer?: (role?: ServerRole) => void }).__breakServer = (role?: ServerRole) =>
    useServerIncidentsStore.getState().breakServer(role)
  // Story testing: put the post-audit conversation into its pending state (the
  // marker over Sonya + the objective) without replaying the whole breach. Uses
  // the same unlock the scene does, so it never duplicates the task or decision.
  ;(window as unknown as { __startPostAuditConversation?: () => void }).__startPostAuditConversation = () => {
    const story = useSecurityStoryStore.getState()
    if (story.securityBreach.status !== 'completed') {
      const s = useSprintStore.getState()
      story.markSecurityBreachCompleted({ sprintNumber: s.sprintNumber, day: s.day })
    } else {
      story.unlockPostAuditConversation()
    }
  }
  // Story testing: force the approve staffing decision and hire Ilya through the
  // real use-case (no money/time moved), so his NPC and salary can be verified
  // without replaying the whole story.
  ;(window as unknown as { __hireSecuritySpecialist?: () => void }).__hireSecuritySpecialist = () => {
    const story = useSecurityStoryStore.getState()
    story.resolveSecurityStaffingDecision('approve-security-hire')
    story.markPostAuditConversationCompleted({
      sprintNumber: useSprintStore.getState().sprintNumber,
      day: useSprintStore.getState().day,
    })
    hireSecuritySpecialist()
  }
  // Story testing: force a pending follow-up audit right now (the trigger then
  // runs the scene). Requires the corrective-action plan to be initialised.
  ;(window as unknown as { __triggerFollowUpAudit?: () => void }).__triggerFollowUpAudit = () => {
    const audit = useSecurityAuditStore.getState()
    if (!audit.initialized) return
    useSecurityAuditStore.setState({
      followUpAudit: { ...audit.followUpAudit, status: 'pending', pendingAuditNumber: audit.followUpAudit.records.length + 1 },
    })
  }
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
      <WhiteboardPanel />
      <SprintHud />
      <SprintPhaseOverlay />
      <FinancePanel />
      <TeamPanel />
      <PrototypeMock />
      <DailyReport />
      <AuditResultOverlay />
      <SecurityStoryTrigger />
      <SecurityFollowUpAuditTrigger />
      <MinigameOverlay />
    </>
  )
}
