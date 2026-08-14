import { useGLTF } from '@react-three/drei'
import { intruder } from '../character/characters/intruder'
import { femalePm } from '../character/characters/femalePm'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useAccessControlStore } from '../game/accessControlStore'
import { hasSecuritySpecialist } from '../game/teamRules'
import { playShot, attachPerLineShots } from '../game/cinematics/cinematicDirector'
import { playVideoCutscene } from './videoCutscene'
import type { CutsceneScript, Point } from './types'

// 18F: while the outsider walks in, the camera keeps a medium shot glued to
// him - the threat visibly APPROACHES instead of crawling across a top-down
// map (§ office-intrusion: «понятное приближение угрозы, не top-down»).
async function trackIntruderWalk(walk: Promise<void>): Promise<void> {
  const tracker = setInterval(() => void playShot('medium', 'intruder', { side: -1, durationMs: 470 }), 450)
  try {
    await walk
  } finally {
    clearInterval(tracker)
  }
}

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

const asSonya = (text: string) => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portraitWorried ?? femalePm.portrait, text })
const asIlya = (text: string) => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })
// The intruder is a one-scene visitor, not a roster character - no persona,
// just enough to render a speaker line matching the same shape.
const asIntruder = (text: string) => ({ speaker: intruder.displayName, speakerRole: 'Посторонний', portrait: '/dialogue_pictures/intruder/intruder_neutral.jpg', text })

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
    // 18H+: the break-in itself plays as a generated story clip («мультик»,
    // Higgsfield). When it plays, the in-engine scene opens directly on the
    // AFTERMATH - actors already at the confrontation spots; the walk-in
    // staging below remains the full fallback (missing file, unsupported
    // codec), so the game never depends on the video asset.
    const clipPlayed = await playVideoCutscene(
      withIlya ? '/cutscenes/office-intrusion-stopped.mp4' : '/cutscenes/office-intrusion-reached.mp4',
    )
    await director.camera(CAMERA_TARGET, { position: CAMERA_POSITION, durationMs: clipPlayed ? 500 : 1000 })
    director.spawnModeledActor('intruder', clipPlayed ? (withIlya ? INTRUDER_STOP_EARLY : INTRUDER_WORKSTATION) : INTRUDER_SPAWN, intruder, Math.PI)

    if (withIlya) {
      if (!clipPlayed) await trackIntruderWalk(director.walk('intruder', INTRUDER_STOP_EARLY))
      await director.walk(ilyaVlasov.id, ILYA_INTERCEPT)
      director.face(ilyaVlasov.id, 'intruder')
      director.face('intruder', ilyaVlasov.id)
      // the interception, eye level: Ilya between the outsider and the office
      await playShot('two-shot', ilyaVlasov.id, { partnerId: 'intruder', side: 1, durationMs: 900 })
      await director.walk(femalePm.id, SONYA_MARK_EARLY)
      director.face(femalePm.id, 'intruder')
      // 18C §5: body language for the beat - Ilya is firm, Sonya worried.
      director.emotion(ilyaVlasov.id, 'angry-controlled')
      director.emotion(femalePm.id, 'concerned')
      director.talk(ilyaVlasov.id, true)
      // 18F: per-line OTS coverage over the intruder's shoulder
      let side: 1 | -1 = 1
      const detach = attachPerLineShots((line) => {
        side = side === 1 ? -1 : 1
        const speakerId = line.speaker === femalePm.persona!.name ? femalePm.id : ilyaVlasov.id
        void playShot('over-the-shoulder', speakerId, { partnerId: 'intruder', side, durationMs: 800 })
      })
      await director.say([
        asIlya('У этого посетителя нет согласованного доступа. Я остановил его до входа в рабочую зону.'),
        asSonya('Значит, даже без формальной СКУД мы уже зависим от того, заметит ли проблему конкретный человек.'),
        asIlya('Да. На этот раз мы успели. Но наблюдение сотрудника не заменяет контроль входа.'),
      ])
      detach()
      director.talk(ilyaVlasov.id, false)
      director.emotion(ilyaVlasov.id, null)
      director.emotion(femalePm.id, null)
    } else {
      if (!clipPlayed) await trackIntruderWalk(director.walk('intruder', INTRUDER_WORKSTATION))
      // caught right where the monitor went down - the crash is what drew
      // Sonya over, not a silent walk-in (matches the video: he knocks it
      // over while trying to leave, not while still working the computer)
      await playShot('medium-close', 'intruder', { side: 1, durationMs: 900 })
      await director.walk(femalePm.id, SONYA_MARK_DEEP)
      director.face(femalePm.id, 'intruder')
      director.face('intruder', femalePm.id)

      // Part 1 (live feedback - the story now has him plug in a flash drive
      // and drop the monitor on his way out): Sonya questions him directly,
      // a real back-and-forth instead of a monologue at an empty chair. She
      // never gets confirmation of what the drive held - canon: data is
      // never shown as confirmably stolen, only a standing risk (§ office-
      // intrusion rules, officeIntrusionSignals). Per-line OTS coverage
      // follows whoever is actually speaking.
      let side: 1 | -1 = -1
      const detachQuestioning = attachPerLineShots((line) => {
        side = side === 1 ? -1 : 1
        const speakerId = line.speaker === femalePm.persona!.name ? femalePm.id : 'intruder'
        void playShot('over-the-shoulder', speakerId, { partnerId: speakerId === femalePm.id ? 'intruder' : femalePm.id, side, durationMs: 800 })
      })
      const exchange = async (speakerId: string, emotion: Parameters<typeof director.emotion>[1], line: ReturnType<typeof asSonya>) => {
        director.emotion(speakerId, emotion)
        director.talk(speakerId, true)
        await director.say([line])
        director.talk(speakerId, false)
      }
      await exchange(femalePm.id, 'surprised', asSonya('Стоп! Кто вы такой и что вы делаете за этим компьютером?'))
      await exchange('intruder', 'concerned', asIntruder('Я... из ИТ-поддержки. Обновляю прошивку монитора, уже заканчиваю.'))
      await exchange(femalePm.id, 'angry-controlled', asSonya('У нас нет заявки на обслуживание. И пропуска на входе я тоже не видела.'))
      await exchange('intruder', 'neutral', asIntruder('Ладно... ухожу.'))
      director.emotion('intruder', null)
      await exchange(femalePm.id, 'angry-controlled', asSonya('Уходите. Сейчас же.'))
      detachQuestioning()
      director.emotion(femalePm.id, null)

      // escorted out, not silently despawned mid-conversation
      await director.walk('intruder', INTRUDER_SPAWN)

      // Part 2: with him gone, Sonya turns the same urgency on the player.
      // The proposal to install СКУД already exists (an intrusion cannot
      // fire before it was offered and postponed/ignored, see
      // accessControlRules.ts) - this is a callback, not a duplicate ask;
      // the actual approve/postpone choice stays on the whiteboard task.
      await playShot('medium-close', femalePm.id, { side: 1, durationMs: 900 })
      director.emotion(femalePm.id, 'concerned')
      director.talk(femalePm.id, true)
      await director.say([
        asSonya('Мы даже не знаем, кто это был и что у него было на флешке. Может, ничего важного. А может — половина наших внутренних данных.'),
        asSonya('Мы уже обсуждали систему контроля доступа на входе. Сегодня я окончательно убедилась — тянуть больше нельзя.'),
        asSonya('Я оставлю это на доске. Посмотрите, когда будет минута — и, пожалуйста, не откладывайте снова.'),
      ])
      director.talk(femalePm.id, false)
      director.emotion(femalePm.id, null)
    }

    // Commit the deterministic result (idempotent) and remove the temporary actor.
    store().resolveIntrusion(moment(), hasSpecialist)
    director.despawnActor('intruder')
  } catch (error) {
    store().markIntrusionFailed()
    throw error
  }
}
