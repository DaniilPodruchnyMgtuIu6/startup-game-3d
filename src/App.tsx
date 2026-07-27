import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import { ACESFilmicToneMapping } from 'three'
import { useControls, Leva } from 'leva'
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
import { OfficeIntrusionTrigger } from './game/OfficeIntrusionTrigger'
import { ServerIncidentTrigger } from './game/ServerIncidentTrigger'
import { AuditResultOverlay } from './ui/AuditResultOverlay'
import { IntrusionResultOverlay } from './ui/IntrusionResultOverlay'
import { ServerIncidentResultOverlay } from './ui/ServerIncidentResultOverlay'
import { MinigameOverlay } from './game/minigames/MinigameOverlay'
import { GameOutcomeCoordinator } from './game/GameOutcomeCoordinator'
import { WorkdayFlowController } from './game/WorkdayFlowController'
import { GameOverOverlay } from './ui/GameOverOverlay'
import { MvpReleaseOverlay } from './ui/MvpReleaseOverlay'
import { CampaignSuccessOverlay } from './ui/CampaignSuccessOverlay'
import { NpcConversationPanel } from './ui/NpcConversationPanel'
import { CinematicBars } from './ui/CinematicBars'
import { useQualityStore, currentQuality, type QualityTier } from './scene/qualityStore'
import { QualityMenu } from './ui/QualityMenu'
import { useCutsceneStore } from './cutscenes/cutsceneStore'
import { isIntroReset } from './game/gameStore'
import { useGameOutcomeStore } from './game/gameOutcomeStore'
import { reconcileGameOutcomeAtStartup } from './game/reconcileGameOutcome'
import { reconcilePlanningWithoutTeam } from './game/productStore'
import { forceRegisterFailureForDev } from './game/registerGameFailure'
import { forceRegisterSuccessForDev } from './game/releaseOfficeFlowMvp'
import type { GameFailureReason } from './game/gameOutcomeRules'
import { useServerIncidentsStore, type ServerRole } from './game/serverIncidentsStore'
import { useSecurityStoryStore } from './game/securityStoryStore'
import { useSprintStore } from './game/sprintStore'
import { hireSecuritySpecialist, reconcileSecurityHire } from './game/hireSecuritySpecialist'
import { useSecurityAuditStore } from './game/securityAuditStore'
import { useAccessControlStore } from './game/accessControlStore'
import { initializeSecurityAuditIfReady } from './game/initializeSecurityAudit'
import { reconcileRiskSignals } from './game/reconcileRiskSignals'
import { reconcileAccessControlThreatAndProposal } from './game/reconcileAccessControl'
import { reconcileServerIncidentThreatsAtStartup } from './game/reconcileServerIncidents'
import { reconcileStoryDecisionsAtStartup, reconcileStoryConsequencesAtStartup } from './game/story/reconcileStoryDecisions'
import { useServerIncidentStore } from './game/serverIncidentStore'
import { useRiskStore } from './game/riskStore'
import { RISK_DOMAINS } from './game/riskCatalog'
import { getActualRiskScore, getActualRiskLevel, getDetectedRiskScore, getDetectedRiskLevel } from './game/riskRules'

// Feature 07: repair any cross-store inconsistency between the staffing decision,
// the security hire record and its task after a load/migration (spec §17), once
// at startup before the scene mounts.
reconcileSecurityHire()
// Feature 08: create the corrective-action plan from an old save whose post-audit
// conversation is already completed (idempotent migration).
initializeSecurityAuditIfReady()
// Feature 09: rebuild hidden-risk signals from facts in an old Feature 08 save
// (idempotent; a continuing Feature 09 save is a no-op).
reconcileRiskSignals()
// Feature 10: open the СКУД proposal / arm the intrusion threat from an old
// Feature 09 save's office-access risk (idempotent, never fires retroactively).
reconcileAccessControlThreatAndProposal()
// Feature 11: arm server-incident threats from an old Feature 10 save's risk +
// rack instability (idempotent, never fires retroactively).
reconcileServerIncidentThreatsAtStartup()
// Feature 12: migrate an old save into the outcome model (old negative budget
// fails now; shutdown recommendation / past deadline get a safe continuation).
reconcileGameOutcomeAtStartup()
// Feature 16 §6: drop invalid product-plan assignments from a corrupted save
// that has no development team (keeps backlog + completed progress).
reconcilePlanningWithoutTeam()
// Feature 17A §9: create/repair the Level 1 story-decision records against a
// pre-17 save (legacy staffing choice -> resolved baseline; never replayed).
reconcileStoryDecisionsAtStartup()
// Feature 17C §15: data-loss checkpoints already passed by an old save are
// skipped - the catastrophe never fires retroactively.
reconcileStoryConsequencesAtStartup()

// The shared reset flag has now been consumed by every store's module-load
// hydration; strip ?intro so a later manual reload keeps the new game's progress.
if (typeof window !== 'undefined' && isIntroReset(window.location.search)) {
  window.history.replaceState(null, '', window.location.pathname)
}

if (import.meta.env.DEV) {
  ;(window as unknown as { __startCutscene?: (id: string) => void }).__startCutscene = (id: string) =>
    useCutsceneStore.getState().startScene(id)
  ;(window as unknown as { __breakServer?: (role?: ServerRole) => void }).__breakServer = (role?: ServerRole) =>
    useServerIncidentsStore.getState().breakServer(role)
  // Opens a rack's repair mini-game directly (breaking it first if needed), so a
  // server mini-game can be reviewed without walking the player over to the rack.
  ;(window as unknown as { __repairServer?: (role: ServerRole) => void }).__repairServer = (role: ServerRole) => {
    const store = useServerIncidentsStore.getState()
    if (store.racks[role].status === 'ok') store.breakServer(role)
    store.beginRepair(role)
  }
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
  // Story testing: force a pending office intrusion right now (the trigger then
  // runs the scene). Uses the current specialist snapshot at scene start.
  ;(window as unknown as { __triggerOfficeIntrusion?: () => void }).__triggerOfficeIntrusion = () => {
    const intrusion = useAccessControlStore.getState().intrusion
    if (intrusion.status === 'resolved' || intrusion.status === 'prevented') return
    useAccessControlStore.setState({ intrusion: { ...intrusion, status: 'pending', effectsApplied: intrusion.effectsApplied } })
  }
  // Story testing: force a specific server incident to pending (default gateway).
  ;(window as unknown as { __triggerServerIncident?: (id?: string) => void }).__triggerServerIncident = (id = 'gateway-outage') => {
    const incidents = useServerIncidentStore.getState().incidents
    const state = incidents[id as keyof typeof incidents]
    if (!state || state.status === 'resolved') return
    useServerIncidentStore.setState({ incidents: { ...incidents, [state.incidentId]: { ...state, status: 'pending' } } })
  }
  // Read-only outcome inspector.
  ;(window as unknown as { __getGameOutcome?: () => unknown }).__getGameOutcome = () => {
    const o = useGameOutcomeStore.getState()
    return {
      status: o.status,
      pendingFailure: o.pendingFailure,
      failure: o.failure,
      pendingSuccess: o.pendingSuccess,
      success: o.success,
      leadershipReview: o.leadershipReview,
      campaignDeadline: o.campaignDeadline,
      campaignRelease: o.campaignRelease,
    }
  }
  // Force a defeat with the current statistics through the normal register flow.
  ;(window as unknown as { __triggerGameFailure?: (reason?: GameFailureReason) => void }).__triggerGameFailure = (
    reason: GameFailureReason = 'budget-exhausted',
  ) => forceRegisterFailureForDev(reason)
  // Commit a campaign success from the current stats (the coordinator opens it).
  ;(window as unknown as { __triggerCampaignSuccess?: () => void }).__triggerCampaignSuccess = () =>
    forceRegisterSuccessForDev()
  // Read-only risk inspector: signals + actual/detected score & level per domain.
  ;(window as unknown as { __getRiskState?: () => unknown }).__getRiskState = () => {
    const signals = useRiskStore.getState().signals
    return {
      signals,
      domains: Object.fromEntries(
        RISK_DOMAINS.map((d) => [
          d,
          {
            actualScore: getActualRiskScore(signals, d),
            actualLevel: getActualRiskLevel(signals, d),
            detectedScore: getDetectedRiskScore(signals, d),
            detectedLevel: getDetectedRiskLevel(signals, d),
          },
        ]),
      ),
    }
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
  // 18E §7: persisted quality tier scales dpr/shadows/post passes. The dev
  // panel exposes the switch; gameplay is never blurred on any tier.
  const tier = useQualityStore((s) => s.tier)
  const quality = currentQuality(tier)
  useControls('Render', {
    quality: {
      value: tier,
      options: ['low', 'medium', 'high', 'cinematic'] as QualityTier[],
      onChange: (next: QualityTier) => useQualityStore.getState().setTier(next),
    },
  })

  return (
    <>
      {/* The leva render-tuning panel is a development affordance — hide it in
          production so players never see the exposure/AO/bloom sliders. The
          control values keep their defaults, so the shipped look is unchanged. */}
      <Leva hidden={!import.meta.env.DEV} />
      <Canvas
        key={tier} // shadows/dpr changes need a clean renderer
        // 'soft' = PCFSoftShadowMap: the hard 1-texel shadow edges read as
        // dirty stripes across the floor; soft filtering costs almost nothing
        // and looks like a real interior.
        shadows={quality.shadows ? 'soft' : false}
        // Cap the pixel ratio so high-DPI screens don't render at 4× the
        // pixels — a big GPU-load reduction on integrated GPUs. No
        // preserveDrawingBuffer (nothing reads the buffer back) — it only added
        // memory pressure. A prevented contextlost lets the browser restore the
        // context instead of leaving the office permanently blank.
        // powerPreference: dual-GPU Windows laptops otherwise often hand the
        // page the INTEGRATED gpu - the single biggest real-world fps lever.
        dpr={[1, quality.dprMax]}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault(), false)
        }}
      >
        <ExposureControl exposure={exposure} />
        <SceneBackground />
        <Office />
        {quality.ao ? (
          <EffectComposer>
            {/* halfRes + performance quality: AO at half resolution is much
                cheaper on integrated GPUs and barely perceptible in this scene. */}
            <N8AO halfRes quality="performance" aoRadius={1.2} intensity={aoIntensity} />
            <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} mipmapBlur />
            <Vignette eskil={false} offset={0.1} darkness={0.6} />
          </EffectComposer>
        ) : quality.bloom ? (
          <EffectComposer>
            <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} mipmapBlur />
            <Vignette eskil={false} offset={0.1} darkness={0.6} />
          </EffectComposer>
        ) : null}
      </Canvas>
      <CinematicBars />
      <IntroOverlay />
      <DialoguePanel />
      <WhiteboardPanel />
      <SprintHud />
      <QualityMenu />
      <WorkdayFlowController />
      <SprintPhaseOverlay />
      <FinancePanel />
      <TeamPanel />
      <PrototypeMock />
      <DailyReport />
      <AuditResultOverlay />
      <IntrusionResultOverlay />
      <ServerIncidentResultOverlay />
      <SecurityStoryTrigger />
      <SecurityFollowUpAuditTrigger />
      <OfficeIntrusionTrigger />
      <ServerIncidentTrigger />
      <GameOutcomeCoordinator />
      <MinigameOverlay />
      <NpcConversationPanel />
      <MvpReleaseOverlay />
      <GameOverOverlay />
      <CampaignSuccessOverlay />
    </>
  )
}
