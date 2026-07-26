import { femalePm } from '../character/characters/femalePm'
import { kirillMorozov } from '../character/characters/kirillMorozov'
import { alinaBelova } from '../character/characters/alinaBelova'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { useTeamStore } from '../game/teamStore'
import { useProductStore } from '../game/productStore'
import { useSecurityAuditStore } from '../game/securityAuditStore'
import { useServerIncidentStore } from '../game/serverIncidentStore'
import { useAccessControlStore } from '../game/accessControlStore'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { hasSecuritySpecialist } from '../game/teamRules'
import { finalizeMvpReleaseSuccess } from '../game/releaseOfficeFlowMvp'
import type { DialogueLine } from '../game/gameStore'
import { WHITEBOARD_POSITION } from '../scene/whiteboardSpot'
import type { CutsceneDirector, CutsceneScript, Point } from './types'

// Feature 13 final scene: the team presents OfficeFlow at the whiteboard (now in
// the open space, see scene/whiteboardSpot.ts), the mock prototype is shown,
// everyone speaks their static line, the CEO's approval arrives off-screen, and
// the run's success is committed. On any error the release rewinds so the
// player can retry (server-scene pattern).

const CAMERA_TARGET: Point = [WHITEBOARD_POSITION[0], 1.2, WHITEBOARD_POSITION[2]]
const CAMERA_POSITION: Point = [-1.2, 2.6, 6.2]
// Sonya presents at the board; the others stand in the walkable strip south of
// the desk cluster, facing her (director.walk snaps each mark to the nav grid).
const SONYA_MARK: Point = [-4.9, 0, 3.7]
const ALINA_MARK: Point = [-4.6, 0, 2.4]
const KIRILL_MARK: Point = [-3.8, 0, 2.5]
const ILYA_MARK: Point = [-3.0, 0, 2.7]

const asSonya = (text: string): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text })
const asKirill = (text: string): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text })
const asAlina = (text: string): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text })
const asIlya = (text: string): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })
const asLeadership = (text: string): DialogueLine => ({ speaker: 'Руководство', speakerRole: 'Сообщение', text })

// Any past fine, incident, shutdown recommendation or intrusion tunes Sonya's
// opening line between the "not without mistakes" and the "managed pace" variant.
function hadNotableProblems(): boolean {
  const audit = useSecurityAuditStore.getState()
  const anyFine = audit.followUpAudit.records.some((r) => r.result === 'failed')
  const anyIncident = Object.values(useServerIncidentStore.getState().incidents).some((s) => s.effectsApplied === true)
  const intrusion = useAccessControlStore.getState().intrusion.status
  return anyFine || anyIncident || audit.shutdownRecommendation || intrusion === 'resolved' || intrusion === 'prevented'
}

export const officeFlowMvpReleaseScene: CutsceneScript = async (director: CutsceneDirector) => {
  const hasIlya = hasSecuritySpecialist(useTeamStore.getState().hires)
  const problems = hadNotableProblems()

  try {
    await director.camera(CAMERA_TARGET, { position: CAMERA_POSITION, durationMs: 1000 })
    await director.walk(femalePm.id, SONYA_MARK)
    await director.walk(kirillMorozov.id, KIRILL_MARK)
    await director.walk(alinaBelova.id, ALINA_MARK)
    if (hasIlya) await director.walk(ilyaVlasov.id, ILYA_MARK)

    director.face(kirillMorozov.id, femalePm.id)
    director.face(alinaBelova.id, femalePm.id)
    if (hasIlya) director.face(ilyaVlasov.id, femalePm.id)

    // 18C §5: the release moment - the team stands proud (scene recovery wipes
    // these after the scene, no manual clear needed on the success path).
    director.emotion(femalePm.id, 'confident')
    director.emotion(kirillMorozov.id, 'confident')
    director.emotion(alinaBelova.id, 'confident')
    if (hasIlya) director.emotion(ilyaVlasov.id, 'relieved')

    // show the built product to the room
    useProductStore.getState().openPrototype()

    director.talk(femalePm.id, true)
    await director.say([
      asSonya('Все задачи первого этапа завершены. Команда подготовила OfficeFlow к выпуску.'),
      problems
        ? asSonya('До этого момента мы дошли не без ошибок, но обязательные проблемы устранены и сервис готов к запуску.')
        : asSonya('Мы сохранили управляемый темп и не оставили критических проблем перед запуском.'),
    ])
    director.talk(femalePm.id, false)

    director.talk(kirillMorozov.id, true)
    await director.say([
      asKirill('Серверная часть готова. Авторизация, переговорные, пропуска, события и уведомления собраны в одну систему.'),
    ])
    director.talk(kirillMorozov.id, false)

    director.talk(alinaBelova.id, true)
    await director.say([
      asAlina('Основные пользовательские сценарии проверены. Сотрудники смогут войти, найти переговорную и оформить бронирование без дополнительного обучения.'),
    ])
    director.talk(alinaBelova.id, false)

    if (hasIlya) {
      director.talk(ilyaVlasov.id, true)
      await director.say([
        asIlya('Обязательные замечания закрыты. Это не означает, что рисков больше нет, но сейчас они не блокируют выпуск.'),
      ])
      director.talk(ilyaVlasov.id, false)
    } else {
      director.talk(femalePm.id, true)
      await director.say([
        asSonya('Обязательные замечания закрыты. Дальнейший контроль безопасности останется ответственностью команды.'),
      ])
      director.talk(femalePm.id, false)
    }

    useProductStore.getState().closePrototype()

    await director.say([
      asLeadership('Первый этап OfficeFlow принят. MVP разрешён к внутреннему запуску.'),
    ])

    // 18C: the release moment - the whole team cheers (retargeted Higgsfield
    // celebrate clip) before the success screen takes over.
    director.perform(femalePm.id, 'celebrate')
    director.perform(kirillMorozov.id, 'celebrate')
    director.perform(alinaBelova.id, 'celebrate')
    if (hasIlya) director.perform(ilyaVlasov.id, 'celebrate')
    await director.wait(3200)
    director.perform(femalePm.id, null)
    director.perform(kirillMorozov.id, null)
    director.perform(alinaBelova.id, null)
    if (hasIlya) director.perform(ilyaVlasov.id, null)

    // commit the win — the coordinator opens the success screen after the scene
    finalizeMvpReleaseSuccess()
  } catch (error) {
    useProductStore.getState().closePrototype()
    useGameOutcomeStore.getState().markMvpReleaseFailed()
    throw error
  }
}
