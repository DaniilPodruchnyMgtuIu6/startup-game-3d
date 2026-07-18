import { femalePm } from '../character/characters/femalePm'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { securityBreachScene } from './securityBreach'
import { securityFollowUpAuditScene } from './securityFollowUpAudit'
import { officeIntrusionScene } from './officeIntrusion'
import type { CutsceneEntry } from './types'

export const CUTSCENES: Record<string, CutsceneEntry> = {
  'security-breach': { script: securityBreachScene, ownsNpcIds: [femalePm.id] },
  'security-follow-up-audit': { script: securityFollowUpAuditScene },
  'office-intrusion': { script: officeIntrusionScene, ownsNpcIds: [femalePm.id, ilyaVlasov.id] },
}
