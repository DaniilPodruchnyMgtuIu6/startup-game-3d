// Pure status/blink logic for server rack LEDs, kept out of the render
// component so it can be unit-tested and later reused by the server-repair
// game mechanic (an 'error' rack is one the player will fix).

export type LedStatus = 'ok' | 'warn' | 'error'

const STATUS_MATERIAL = {
  ok: 'ledGreen',
  warn: 'ledAmber',
  error: 'ledRed',
} as const

// Deterministic pseudo-random status mix: mostly green, some amber, rare red.
// Same (seed, unit) always yields the same status, so the scene is stable
// across reloads and tests.
export function ledStatusFor(seed: number, unit: number): LedStatus {
  const hash = (seed * 7919 + unit * 104729 + 13) % 17
  if (hash === 0) return 'error'
  if (hash <= 3) return 'warn'
  return 'ok'
}

export function ledMaterialKeyFor(status: LedStatus): (typeof STATUS_MATERIAL)[LedStatus] {
  return STATUS_MATERIAL[status]
}

const BASE_INTENSITY = 3
const DIM = 0.25

// Blink waveform per status: errors flash urgently, warnings pulse slower,
// healthy units mostly stay lit with a brief periodic activity dip. Each unit
// gets a phase offset so a rack's LEDs never blink in lockstep.
export function ledIntensityAt(status: LedStatus, unit: number, timeSeconds: number): number {
  const phase = unit * 0.618
  switch (status) {
    case 'error': {
      const on = Math.sin((timeSeconds + phase) * Math.PI * 2 * 2.2) > 0
      return on ? BASE_INTENSITY : BASE_INTENSITY * DIM
    }
    case 'warn': {
      const on = Math.sin((timeSeconds + phase) * Math.PI * 2 * 0.9) > -0.3
      return on ? BASE_INTENSITY : BASE_INTENSITY * DIM
    }
    case 'ok': {
      const dip = Math.sin((timeSeconds + phase) * Math.PI * 2 * 0.35) > 0.92
      return dip ? BASE_INTENSITY * DIM : BASE_INTENSITY
    }
  }
}
