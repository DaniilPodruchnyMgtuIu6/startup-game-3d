import { femalePm } from '../character/characters/femalePm'
import { kirillMorozov } from '../character/characters/kirillMorozov'
import { alinaBelova } from '../character/characters/alinaBelova'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { securityBreachScene } from './securityBreach'
import { securityFollowUpAuditScene } from './securityFollowUpAudit'
import { officeIntrusionScene } from './officeIntrusion'
import { serverGatewayOutageScene, serverAuthAccountIncidentScene, serverDatabaseExposureReviewScene } from './serverIncidentScenes'
import { officeFlowMvpReleaseScene } from './mvpReleaseScene'
import type { CutsceneEntry } from './types'

const SERVER_SCENE_NPCS = [femalePm.id, kirillMorozov.id, ilyaVlasov.id]
const RELEASE_SCENE_NPCS = [femalePm.id, kirillMorozov.id, alinaBelova.id, ilyaVlasov.id]

export const CUTSCENES: Record<string, CutsceneEntry> = {
  'security-breach': { script: securityBreachScene, ownsNpcIds: [femalePm.id] },
  'security-follow-up-audit': { script: securityFollowUpAuditScene },
  'office-intrusion': { script: officeIntrusionScene, ownsNpcIds: [femalePm.id, ilyaVlasov.id] },
  'server-gateway-outage': { script: serverGatewayOutageScene, ownsNpcIds: SERVER_SCENE_NPCS },
  'server-auth-account-incident': { script: serverAuthAccountIncidentScene, ownsNpcIds: SERVER_SCENE_NPCS },
  'server-database-exposure-review': { script: serverDatabaseExposureReviewScene, ownsNpcIds: SERVER_SCENE_NPCS },
  'officeflow-mvp-release': { script: officeFlowMvpReleaseScene, ownsNpcIds: RELEASE_SCENE_NPCS },
}
