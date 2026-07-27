import { useState } from 'react'
import { useQualityStore, type QualityTier } from '../scene/qualityStore'
import { useCinematicStore } from '../game/cinematics/cinematicDirector'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import './ui.css'

// The player-visible graphics switch (live feedback: production hides the dev
// panel, and an automatic downgrade is NOT an acceptable substitute - the
// player decides how the game looks). Persisted via the quality store; the
// Canvas remounts on change (App.tsx keys it by tier).
const TIER_LABELS: Record<QualityTier, string> = {
  low: 'Низкое',
  medium: 'Среднее',
  high: 'Высокое',
  cinematic: 'Кино',
}
const TIERS: QualityTier[] = ['low', 'medium', 'high', 'cinematic']

export function QualityMenu() {
  const tier = useQualityStore((s) => s.tier)
  const setTier = useQualityStore((s) => s.setTier)
  const cinematicActive = useCinematicStore((s) => s.active)
  const cutsceneActive = useCutsceneStore((s) => s.activeSceneId !== null)
  const [open, setOpen] = useState(false)

  // scene UI discipline: no chrome over a running cinematic/cutscene (§8)
  if (cinematicActive || cutsceneActive) return null

  return (
    <div className="quality-menu">
      {open ? (
        <div className="quality-menu-options">
          {TIERS.map((option) => (
            <button
              key={option}
              className={`quality-menu-option${option === tier ? ' quality-menu-option--active' : ''}`}
              onClick={() => {
                setTier(option)
                setOpen(false)
              }}
            >
              {TIER_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}
      <button className="quality-menu-toggle" title="Качество графики" onClick={() => setOpen((v) => !v)}>
        ✦ {TIER_LABELS[tier]}
      </button>
    </div>
  )
}
