import { femalePm } from '../character/characters/femalePm'
import { securityBreachScene } from './securityBreach'
import type { CutsceneEntry } from './types'

export const CUTSCENES: Record<string, CutsceneEntry> = {
  'security-breach': { script: securityBreachScene, ownsNpcIds: [femalePm.id] },
}
