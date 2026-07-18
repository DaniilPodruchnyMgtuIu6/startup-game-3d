import { useGLTF } from '@react-three/drei'
import { PLAYER_ID } from '../character/characterStore'
import { security1 } from '../character/characters/security1'
import { security2 } from '../character/characters/security2'
import { useSprintStore } from '../game/sprintStore'
import { useSecurityAuditStore } from '../game/securityAuditStore'
import type { FollowUpAuditRecord } from '../game/securityAuditRules'
import type { CutsceneScript, Point } from './types'

// Preload the auditor models so spawnModeledActor does not suspend mid-scene
// (same reasoning as the security-breach scene).
for (const definition of [security1, security2]) {
  useGLTF.preload(Object.values(definition.model.clips))
}

const AUDIT_ROLE = 'Аудит безопасности'
const GUARD1_SPAWN: Point = [9, 0, 6.5]
const GUARD2_SPAWN: Point = [9, 0, 5]
const GUARD1_MARK: Point = [3, 0, 2]
const GUARD2_MARK: Point = [4.4, 0, 2]
const CAMERA_TARGET: Point = [3.5, 1.2, 1.5]
const CAMERA_POSITION: Point = [8, 3, 6.5]

const GUARD1 = {
  speaker: security1.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_1_without_emotions.png',
}
const GUARD1_ANGRY = {
  speaker: security1.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_1_angry.png',
}
const GUARD2 = {
  speaker: security2.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_2_without_emotions.png',
}

// The scripted auditor lines for each outcome. No choices - the result is
// already decided by the state of the findings.
function auditorLines(record: FollowUpAuditRecord) {
  if (record.result === 'passed') {
    return [
      { ...GUARD1, text: 'Все замечания предыдущей проверки устранены.' },
      { ...GUARD2, text: 'Повторный аудит пройден. На этом корректирующий план закрыт.' },
    ]
  }
  if (record.auditNumber === 1) {
    return [
      { ...GUARD1_ANGRY, text: 'Часть замечаний не устранена. Компания получает штраф 120 000 рублей.' },
      { ...GUARD2, text: 'Мы назначаем повторную проверку через десять рабочих дней.' },
    ]
  }
  if (record.auditNumber === 2) {
    return [
      { ...GUARD1_ANGRY, text: 'Те же нарушения повторяются. Штраф увеличен до 250 000 рублей.' },
      { ...GUARD2, text: 'Информация о систематическом невыполнении требований будет передана высшему руководству.' },
    ]
  }
  return [
    { ...GUARD1_ANGRY, text: 'Требования безопасности систематически игнорируются. Штраф составляет 500 000 рублей.' },
    { ...GUARD2, text: 'Мы направляем рекомендацию приостановить проект до устранения критических нарушений.' },
  ]
}

// Short follow-up audit scene: the auditors return, the game commits the result
// (fine + status + branch task via resolvePendingAudit), the matching lines
// play, then the actors leave and the result window is shown by AuditResultOverlay.
export const securityFollowUpAuditScene: CutsceneScript = async (director) => {
  const audit = useSecurityAuditStore.getState
  const moment = () => {
    const s = useSprintStore.getState()
    return { sprintNumber: s.sprintNumber, day: s.day }
  }

  audit().markAuditRunning()
  try {
    await director.camera(CAMERA_TARGET, { position: CAMERA_POSITION, durationMs: 1000 })
    director.spawnModeledActor('audit1', GUARD1_SPAWN, security1)
    director.spawnModeledActor('audit2', GUARD2_SPAWN, security2)
    await Promise.all([director.walk('audit1', GUARD1_MARK), director.walk('audit2', GUARD2_MARK)])
    director.face('audit1', PLAYER_ID)
    director.face('audit2', PLAYER_ID)
    director.talk('audit1', true)

    // Commit the result (idempotent) and narrate the matching branch.
    const resolved = audit().resolvePendingAudit(moment())
    const record = resolved.record
    if (record) await director.say(auditorLines(record))

    director.talk('audit1', false)
    director.despawnActor('audit1')
    director.despawnActor('audit2')
  } catch (error) {
    audit().markAuditFailed()
    throw error
  }
}
