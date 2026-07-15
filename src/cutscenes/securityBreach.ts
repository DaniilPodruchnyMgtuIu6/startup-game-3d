import { useGLTF } from '@react-three/drei'
import { PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { security1 } from '../character/characters/security1'
import { security2 } from '../character/characters/security2'
import { useGameStore } from '../game/gameStore'
import type { CutsceneScript, Point } from './types'

// Preloaded at module load so the guards' GLTFs are already cached by the
// time spawnModeledActor first renders their CharacterModel. Must be called
// with the *combined* clip-URL array in one call, matching exactly how
// CharacterModel itself calls useGLTF(clipEntries.map(...)) - r3f's
// useLoader cache key is [loader, ...urls] compared shallowly as one array,
// so preloading each URL individually (as Character.tsx/Npcs.tsx do) warms
// a different cache entry than the combined call actually looks up and
// still suspends. That's harmless at page load (nothing to lose yet) but
// catastrophic mid-scene: because every character lives inside one
// <Suspense fallback={null}> boundary, a suspend here unmounts and remounts
// the whole subtree - including Npcs and CutsceneRunner itself - wiping
// every character's position and re-triggering the running scene script.
for (const definition of [security1, security2]) {
  useGLTF.preload(Object.values(definition.model.clips))
}

const PM_SEAT: Point = [-1.9, 0, 4.35]
const PM_DESK_CAMERA_TARGET: Point = [-1.9, 1.1, 4.7]
const PM_DESK_CAMERA_POSITION: Point = [-4.5, 1.6, 3.5]
const PM_AWAY_POINT: Point = [-2, 0, 2]
const GUARD1_SPAWN: Point = [-5, 0, 4]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 4.9]
const GUARD2_SPAWN: Point = [-5, 0, 6]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 5.4]

const PLAYER_SEAT: Point = [9, 0, -7.53]
const OFFICE_CAMERA_TARGET: Point = [9, 1.3, -7.53]
const OFFICE_CAMERA_POSITION: Point = [12.5, 1.6, -6]
const GUARD1_OFFICE_MARK: Point = [7.2, 0, -6.5]
const GUARD2_OFFICE_MARK: Point = [8.8, 0, -6.5]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK_CAMERA_TARGET, { position: PM_DESK_CAMERA_POSITION, durationMs: 1200 })
  await director.sit(femalePm.id, { point: PM_SEAT, facing: 0 }, 'workstation')
  await director.wait(800)
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnModeledActor('guard1', GUARD1_SPAWN, security1)
  director.spawnModeledActor('guard2', GUARD2_SPAWN, security2)
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  director.look('guard1', true)
  director.look('guard2', true)

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  director.look('guard1', false)
  director.look('guard2', false)

  await director.sit(PLAYER_ID, { point: PLAYER_SEAT, facing: 0 }, 'seat')

  await director.camera(OFFICE_CAMERA_TARGET, { position: OFFICE_CAMERA_POSITION, durationMs: 1200 })
  await Promise.all([director.walk('guard1', GUARD1_OFFICE_MARK), director.walk('guard2', GUARD2_OFFICE_MARK)])
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
