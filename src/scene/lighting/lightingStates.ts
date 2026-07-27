// Feature 18E §6: deterministic lighting states. The office light is a pure
// function of GAME state (never real time): campaign outcome, active server
// racks, an armed intrusion, a blocking follow-up audit, and the sprint day
// (day 1 reads as morning, day 10 as evening - game days, not the clock).
// Presets follow the approved environment moodboards
// (docs/art/references/environment/): warm key + soft cool shadows normally,
// cooler/dimmer under alert, golden for success, desaturated dusk for failure.

export type LightingStateName =
  | 'normal-workday'
  | 'morning'
  | 'evening'
  | 'security-alert'
  | 'server-incident'
  | 'audit'
  | 'success'
  | 'failure'

export interface LightingPreset {
  ambientIntensity: number
  ambientColor: string
  keyIntensity: number
  keyColor: string
  fillIntensity: number
  fillColor: string
  envIntensity: number
}

export const LIGHTING_PRESETS: Record<LightingStateName, LightingPreset> = {
  'normal-workday': {
    ambientIntensity: 0.35,
    ambientColor: '#ffffff',
    keyIntensity: 1.6,
    keyColor: '#fff4e0',
    fillIntensity: 0.3,
    fillColor: '#dfe9ff',
    envIntensity: 0.6,
  },
  morning: {
    ambientIntensity: 0.32,
    ambientColor: '#fff1e2',
    keyIntensity: 1.75,
    keyColor: '#ffe9c8',
    fillIntensity: 0.26,
    fillColor: '#e8f0ff',
    envIntensity: 0.62,
  },
  evening: {
    ambientIntensity: 0.3,
    ambientColor: '#f4e8ff',
    keyIntensity: 1.35,
    keyColor: '#ffd9a8',
    fillIntensity: 0.34,
    fillColor: '#c9d8ff',
    envIntensity: 0.52,
  },
  'security-alert': {
    ambientIntensity: 0.26,
    ambientColor: '#e8edff',
    keyIntensity: 1.15,
    keyColor: '#dfe8ff',
    fillIntensity: 0.4,
    fillColor: '#ffc9a0',
    envIntensity: 0.45,
  },
  'server-incident': {
    ambientIntensity: 0.28,
    ambientColor: '#e4ecff',
    keyIntensity: 1.25,
    keyColor: '#e8eeff',
    fillIntensity: 0.36,
    fillColor: '#ffb8a0',
    envIntensity: 0.48,
  },
  audit: {
    ambientIntensity: 0.33,
    ambientColor: '#f6f6ff',
    keyIntensity: 1.5,
    keyColor: '#f2f0e6',
    fillIntensity: 0.3,
    fillColor: '#d8e4ff',
    envIntensity: 0.55,
  },
  success: {
    ambientIntensity: 0.4,
    ambientColor: '#fff4de',
    keyIntensity: 1.85,
    keyColor: '#ffe6b8',
    fillIntensity: 0.32,
    fillColor: '#eaf2ff',
    envIntensity: 0.7,
  },
  failure: {
    ambientIntensity: 0.24,
    ambientColor: '#dbe2f0',
    keyIntensity: 0.95,
    keyColor: '#cfdcf2',
    fillIntensity: 0.28,
    fillColor: '#b8c6e0',
    envIntensity: 0.38,
  },
}

export interface LightingContext {
  outcomeStatus: string // gameOutcomeStore.status
  anyRackDown: boolean // a server rack is broken or being repaired
  intrusionActive: boolean // intrusion armed/pending/running
  auditBlocking: boolean // follow-up audit pending/running
  sprintDay: number // 1..10 game day (never real time)
}

// Priority (§6): terminal outcomes own the room, then live threats, then the
// audit mood, then the day-of-sprint tint.
export function resolveLightingState(ctx: LightingContext): LightingStateName {
  if (ctx.outcomeStatus.includes('fail')) return 'failure'
  if (ctx.outcomeStatus.includes('succe') || ctx.outcomeStatus.includes('won')) return 'success'
  if (ctx.anyRackDown) return 'server-incident'
  if (ctx.intrusionActive) return 'security-alert'
  if (ctx.auditBlocking) return 'audit'
  if (ctx.sprintDay <= 1) return 'morning'
  if (ctx.sprintDay >= 10) return 'evening'
  return 'normal-workday'
}
