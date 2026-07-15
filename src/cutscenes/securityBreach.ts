import { PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { useGameStore } from '../game/gameStore'
import type { CutsceneScript, Point } from './types'

const PM_DESK: Point = [-2, 0.8, 6.3]
// CameraControls' existing minDistance (14) clamps anything tighter, so this
// offset from PM_DESK keeps the requested framing just outside that floor.
const PM_DESK_CAMERA: Point = [8, 12.8, 16.3]
const PM_AWAY_POINT: Point = [-2, 0, 3]
const GUARD1_SPAWN: Point = [-5, 0, 5]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 6.3]
const GUARD2_SPAWN: Point = [-5, 0, 7]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 6.9]

const OFFICE_CAMERA_TARGET: Point = [9, 0.8, -5.3]
const OFFICE_CAMERA_POSITION: Point = [19, 12.8, 4.7]
const PLAYER_OFFICE_MARK: Point = [8, 0, -6.5]
const GUARD1_OFFICE_MARK: Point = [7.2, 0, -6.5]
const GUARD2_OFFICE_MARK: Point = [8.8, 0, -6.5]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK, { position: PM_DESK_CAMERA, durationMs: 1500 })
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnActor('guard1', GUARD1_SPAWN, 0, '#37475c')
  director.spawnActor('guard2', GUARD2_SPAWN, 0, '#4a3c3c')
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  await director.camera(OFFICE_CAMERA_TARGET, { position: OFFICE_CAMERA_POSITION, durationMs: 1500 })
  await Promise.all([
    director.walk(PLAYER_ID, PLAYER_OFFICE_MARK),
    director.walk('guard1', GUARD1_OFFICE_MARK),
    director.walk('guard2', GUARD2_OFFICE_MARK),
  ])
  director.face('guard1', PLAYER_ID)
  director.face('guard2', PLAYER_ID)
  director.face(PLAYER_ID, 'guard1')
  director.talk(PLAYER_ID, true)
  director.talk('guard1', true)

  await director.say([
    {
      ...GUARD1,
      text: 'У вас в отделе только что нашли разблокированный компьютер без присмотра. Это прямое нарушение политики безопасности.',
    },
    { ...GUARD2, text: 'Мы обязаны сообщать о таком наверх. Но для начала хотим услышать вашу версию.' },
  ])

  const pick = await director.choice([
    { id: 'accept', label: 'Беру ответственность на себя, разберёмся.' },
    { id: 'blame', label: 'Это недосмотр PM, я тут ни при чём.' },
  ])

  if (pick === 'blame') {
    useGameStore.getState().addReprimand()
    await director.say([
      {
        ...GUARD1,
        text: 'Понятно. Только перекладывать ответственность на сотрудников — не лучшая черта для руководителя. Это мы тоже отметим.',
      },
    ])
  } else {
    await director.say([
      { ...GUARD1, text: 'Разумно. По крайней мере, вы не пытаетесь спихнуть вину на подчинённых — уже неплохо.' },
    ])
  }

  await director.say([
    {
      ...GUARD2,
      text: 'В качестве меры — отдел обязан регулярно проводить курсы по безопасности для сотрудников. Мы это проконтролируем.',
    },
  ])
  director.addTask({ id: 'security-training', text: 'Проводить курсы по безопасности (регулярно)', done: false })

  director.talk(PLAYER_ID, false)
  director.talk('guard1', false)
  director.despawnActor('guard1')
  director.despawnActor('guard2')
}
