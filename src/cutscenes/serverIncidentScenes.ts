import { femalePm } from '../character/characters/femalePm'
import { kirillMorozov } from '../character/characters/kirillMorozov'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useServerIncidentStore } from '../game/serverIncidentStore'
import { hasSecuritySpecialist } from '../game/teamRules'
import type { DialogueLine } from '../game/gameStore'
import type { ServerIncidentId } from '../game/serverIncidentCatalog'
import type { CutsceneDirector, CutsceneScript, Point } from './types'

// Three short server-incident scenes (Feature 11). They reuse Sonya, Kirill and
// (if hired) Ilya and the existing server room; each commits the incident result
// (immediate cost + occurred signal + recovery task) via resolveServerIncidentScene.

const CAMERA_TARGET: Point = [-9, 1.2, 5.6]
const CAMERA_POSITION: Point = [-3.5, 2.6, 7.2]
const SONYA_MARK: Point = [-7.4, 0, 6.4]
const KIRILL_MARK: Point = [-8.6, 0, 6.4]
const ILYA_MARK: Point = [-9.8, 0, 6.4]

const asSonya = (text: string): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portraitWorried ?? femalePm.portrait, text })
const asKirill = (text: string): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text })
const asIlya = (text: string): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })

interface IncidentLines {
  withoutIlya: DialogueLine[]
  withIlya: DialogueLine[]
}

async function runServerScene(director: CutsceneDirector, incidentId: ServerIncidentId, lines: IncidentLines) {
  const store = useServerIncidentStore.getState
  const moment = () => {
    const s = useSprintStore.getState()
    return { sprintNumber: s.sprintNumber, day: s.day }
  }
  const hasSpecialist = hasSecuritySpecialist(useTeamStore.getState().hires)
  store().markServerIncidentRunning(incidentId, moment(), hasSpecialist)
  const withIlya = useServerIncidentStore.getState().incidents[incidentId].hadSecuritySpecialistAtIncident ?? hasSpecialist

  try {
    await director.camera(CAMERA_TARGET, { position: CAMERA_POSITION, durationMs: 1000 })
    await director.walk(femalePm.id, SONYA_MARK)
    await director.walk(kirillMorozov.id, KIRILL_MARK)
    if (withIlya) await director.walk(ilyaVlasov.id, ILYA_MARK)
    director.face(femalePm.id, kirillMorozov.id)
    director.talk(femalePm.id, true)
    if (withIlya) director.talk(ilyaVlasov.id, true)
    director.talk(kirillMorozov.id, true)
    await director.say(withIlya ? lines.withIlya : lines.withoutIlya)
    director.talk(femalePm.id, false)
    director.talk(kirillMorozov.id, false)
    if (withIlya) director.talk(ilyaVlasov.id, false)
    store().resolveServerIncidentScene(incidentId, moment())
  } catch (error) {
    store().markServerIncidentSceneFailed(incidentId)
    throw error
  }
}

export const serverGatewayOutageScene: CutsceneScript = (director) =>
  runServerScene(director, 'gateway-outage', {
    withoutIlya: [
      asSonya('OfficeFlow недоступен из офисной сети. Команда не может проверить текущую сборку.'),
      asKirill('Шлюз меняли вручную несколько раз. Теперь придётся восстанавливать рабочую конфигурацию и проверять маршруты заново.'),
    ],
    withIlya: [
      asSonya('OfficeFlow недоступен из офисной сети. Команда не может проверить текущую сборку.'),
      asIlya('Я нашёл изменение, после которого шлюз стал нестабильным. Кириллу всё равно нужно восстановить конфигурацию, но причину мы уже локализовали.'),
    ],
  })

export const serverAuthAccountIncidentScene: CutsceneScript = (director) =>
  runServerScene(director, 'auth-account-incident', {
    withoutIlya: [
      asSonya('Несколько сотрудников потеряли доступ к OfficeFlow. В журналах есть подозрительные административные сессии.'),
      asKirill('Сначала придётся отозвать активные сессии и перепроверить права всех служебных учётных записей.'),
    ],
    withIlya: [
      asIlya('Я ограничил подозрительные сессии и подготовил список учётных записей для проверки.'),
      asIlya('Теперь нужно восстановить доступ и закрыть причину появления лишних разрешений.'),
    ],
  })

export const serverDatabaseExposureReviewScene: CutsceneScript = (director) =>
  runServerScene(director, 'database-exposure-review', {
    withoutIlya: [
      asSonya('В журналах базы есть запросы, которые могли вывести лишние данные.'),
      asKirill('Пока не закончим проверку, часть операций придётся ограничить.'),
    ],
    withIlya: [
      asIlya('Я ограничил подозрительные запросы и зафиксировал журналы для расследования.'),
      asIlya('Подтверждённой утечки пока нет, но базу нужно проверить до снятия ограничений.'),
    ],
  })
