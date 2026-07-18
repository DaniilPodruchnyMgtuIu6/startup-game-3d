import { useGLTF } from '@react-three/drei'
import { intruder } from '../character/characters/intruder'
import { femalePm } from '../character/characters/femalePm'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useAccessControlStore } from '../game/accessControlStore'
import { hasSecuritySpecialist } from '../game/teamRules'
import type { CutsceneScript, Point } from './types'

// Preload the intruder model in the combined form the CharacterModel looks up,
// so spawnModeledActor never suspends mid-scene.
useGLTF.preload(Object.values(intruder.model.clips))

const INTRUDER_SPAWN: Point = [5, 0, 7.4]
const INTRUDER_STOP_EARLY: Point = [3, 0, 5] // contained near the entrance (Ilya branch)
const INTRUDER_WORKSTATION: Point = [0.5, 0, 1] // reached a workstation (no-Ilya branch)
const ILYA_INTERCEPT: Point = [3, 0, 4]
const SONYA_MARK_EARLY: Point = [1.6, 0, 4.4]
const SONYA_MARK_DEEP: Point = [1.6, 0, 1.4]
const CAMERA_TARGET: Point = [2, 1.1, 3]
const CAMERA_POSITION: Point = [8, 3.2, 7]

const asSonya = (text: string) => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text })
const asIlya = (text: string) => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })

// The office-intrusion scene (Feature 10). A temporary visitor enters; with Ilya
// hired he is stopped near the entrance, otherwise he reaches a workstation
// before Sonya notices. The scene commits the result (cost + signals + tasks)
// via resolveIntrusion, then the actor leaves and the result window is shown.
export const officeIntrusionScene: CutsceneScript = async (director) => {
  const store = useAccessControlStore.getState
  const moment = () => {
    const s = useSprintStore.getState()
    return { sprintNumber: s.sprintNumber, day: s.day }
  }
  const hasSpecialist = hasSecuritySpecialist(useTeamStore.getState().hires)
  store().markIntrusionRunning(moment(), hasSpecialist)
  const withIlya = useAccessControlStore.getState().intrusion.hadSecuritySpecialistAtIncident ?? hasSpecialist

  try {
    await director.camera(CAMERA_TARGET, { position: CAMERA_POSITION, durationMs: 1000 })
    director.spawnModeledActor('intruder', INTRUDER_SPAWN, intruder, Math.PI)

    if (withIlya) {
      await director.walk('intruder', INTRUDER_STOP_EARLY)
      await director.walk(ilyaVlasov.id, ILYA_INTERCEPT)
      director.face(ilyaVlasov.id, 'intruder')
      director.face('intruder', ilyaVlasov.id)
      await director.walk(femalePm.id, SONYA_MARK_EARLY)
      director.face(femalePm.id, 'intruder')
      director.talk(ilyaVlasov.id, true)
      await director.say([
        asIlya('У этого посетителя нет согласованного доступа. Я остановил его до входа в рабочую зону.'),
        asSonya('Значит, даже без формальной СКУД мы уже зависим от того, заметит ли проблему конкретный человек.'),
        asIlya('Да. На этот раз мы успели. Но наблюдение сотрудника не заменяет контроль входа.'),
      ])
      director.talk(ilyaVlasov.id, false)
    } else {
      await director.walk('intruder', INTRUDER_WORKSTATION)
      await director.walk(femalePm.id, SONYA_MARK_DEEP)
      director.face(femalePm.id, 'intruder')
      director.face('intruder', femalePm.id)
      director.talk(femalePm.id, true)
      await director.say([
        asSonya('Этот человек не должен был попасть в рабочую зону. Он успел подойти к компьютеру до того, как его остановили.'),
        asSonya('Мы не можем подтвердить утечку, но теперь придётся проверять доступы и журналы.'),
        asSonya('Ручного контроля недостаточно. Нам нужна работающая система доступа.'),
      ])
      director.talk(femalePm.id, false)
    }

    // Commit the deterministic result (idempotent) and remove the temporary actor.
    store().resolveIntrusion(moment(), hasSpecialist)
    director.despawnActor('intruder')
  } catch (error) {
    store().markIntrusionFailed()
    throw error
  }
}
