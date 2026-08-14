import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../game/gameStore'
import { useProductStore } from '../game/productStore'
import { useRiskStore } from '../game/riskStore'
import { useTeamStore } from '../game/teamStore'
import { useCinematicStore } from '../game/cinematics/cinematicDirector'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { productReadiness, completedProductTaskCount } from '../game/productRules'
import { PRODUCT_TASK_CATALOG } from '../game/productTaskCatalog'
import { buildRiskObservations } from '../game/riskRules'
import { RISK_LEVEL_LABEL, type RiskLevel } from '../game/riskCatalog'
import { hasSecuritySpecialist } from '../game/teamRules'
import './ui.css'

// Feature 16 §3-adjacent HUD widget: the consequences of the player's security
// decisions surfaced where they can't be missed, not just inside the
// Whiteboard's Security tab. Reuses the exact same detected-risk data
// (buildRiskObservations) - no second risk model, no new store. A domain the
// player has never triggered a signal in stays hidden, matching the existing
// Security tab's own rule.
export function ProductStatusHud() {
  const gamePhase = useGameStore((s) => s.phase)
  const cinematicActive = useCinematicStore((s) => s.active)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const taskStates = useProductStore((s) => s.taskStates)
  const signals = useRiskStore((s) => s.signals)
  const revealDetailedFactors = useTeamStore((s) => hasSecuritySpecialist(s.hires))

  const observations = buildRiskObservations(signals, { revealDetailedFactors })

  // Highlight a domain briefly whenever its detected level changes (either
  // direction - a choice made things worse OR a fix made them better). A ref
  // tracks the previous render's levels so this never re-triggers on an
  // unrelated re-render.
  const previousLevels = useRef<Partial<Record<string, RiskLevel>>>({})
  const [justChanged, setJustChanged] = useState<Set<string>>(new Set())

  useEffect(() => {
    const changed = new Set<string>()
    for (const o of observations) {
      const prev = previousLevels.current[o.domain]
      if (prev !== undefined && prev !== o.level) changed.add(o.domain)
      previousLevels.current[o.domain] = o.level
    }
    if (changed.size === 0) return
    setJustChanged(changed)
    const timer = setTimeout(() => setJustChanged(new Set()), 2200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals])

  if (gamePhase !== 'free' || cinematicActive || cutsceneRunning) return null

  const readiness = productReadiness(taskStates)
  const doneCount = completedProductTaskCount(taskStates)

  return (
    <div className="product-hud">
      <div className="product-hud-readiness">
        <span className="product-hud-readiness-label">OfficeFlow</span>
        <span className="product-hud-readiness-value">{readiness}%</span>
        <span className="product-hud-readiness-tasks">
          {doneCount}/{PRODUCT_TASK_CATALOG.length} задач
        </span>
      </div>
      {observations.length > 0 ? (
        <div className="product-hud-risks">
          {observations.map((o) => (
            <div
              key={o.domain}
              className={`product-hud-chip product-hud-chip--${o.level}${justChanged.has(o.domain) ? ' product-hud-chip--pulse' : ''}`}
              title={o.summary}
            >
              <span className="product-hud-chip-domain">{o.title}</span>
              <span className="product-hud-chip-level">{RISK_LEVEL_LABEL[o.level]}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
