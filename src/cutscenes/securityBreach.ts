import { useGLTF } from '@react-three/drei'
import { PLAYER_ID, useCharacterStore } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { security1 } from '../character/characters/security1'
import { security2 } from '../character/characters/security2'
import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useSecurityStoryStore } from '../game/securityStoryStore'
import { mapCutsceneChoiceToSecurityDecision, type SecurityBreachDecision } from '../game/securityStoryRules'
import { playShot, playInsert, attachPerLineShots } from '../game/cinematics/cinematicDirector'
import { execChairSeatTarget } from '../rooms/CeoOffice'
import { playVideoCutscene } from './videoCutscene'
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

// Same seat the click-to-sit path uses (was a stale [9,0,-7.53] behind the chair).
const { point: PLAYER_SEAT, facing: PLAYER_SEAT_FACING } = execChairSeatTarget()
// 18D: where the player rises to face the auditors - beside his chair, a
// personal-space gap from both guard marks so the models never interpenetrate
const PLAYER_STAND_MARK: Point = [PLAYER_SEAT[0], 0, PLAYER_SEAT[2] + 0.18]
const OFFICE_CAMERA_TARGET: Point = [PLAYER_SEAT[0], 1.3, PLAYER_SEAT[2]]
const OFFICE_CAMERA_POSITION: Point = [PLAYER_SEAT[0] + 3.5, 1.6, PLAYER_SEAT[2] + 1.53]
const GUARD1_OFFICE_MARK: Point = [PLAYER_SEAT[0] - 1.8, 0, PLAYER_STAND_MARK[2] + 0.85]
const GUARD2_OFFICE_MARK: Point = [PLAYER_SEAT[0] - 0.2, 0, PLAYER_STAND_MARK[2] + 0.85]

const AUDIT_ROLE = 'Аудит безопасности'
const PLAYER_ROLE = 'Руководитель отдела'

// Three expressions per guard, used across the scene as the situation
// escalates: thinking while they puzzle out what happened at the desk,
// angry once they're laying out the violation, neutral for the calmer
// (accept-responsibility) reply so the two branches read differently even
// through the portrait alone.
const GUARD1_THINKING = {
  speaker: security1.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_1_thinking.png',
}
const GUARD1_ANGRY = {
  speaker: security1.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_1_angry.png',
}
const GUARD1_NEUTRAL = {
  speaker: security1.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_1_without_emotions.png',
}
const GUARD2_THINKING = {
  speaker: security2.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/security_2_thinking.png',
}
const GUARD2_ANGRY = {
  speaker: security2.displayName,
  speakerRole: AUDIT_ROLE,
  portrait: '/dialogue_pictures/security/angry_security_2.png',
}

export const securityBreachScene: CutsceneScript = async (director) => {
  const playerName = useGameStore.getState().playerName
  const PLAYER_SHOCKED = {
    speaker: playerName,
    speakerRole: PLAYER_ROLE,
    portrait: '/dialogue_pictures/businessman/businessman_shocked.png',
  }
  const PLAYER_SAD = {
    speaker: playerName,
    speakerRole: PLAYER_ROLE,
    portrait: '/dialogue_pictures/businessman/businessmen_sad.png',
  }

  const story = useSecurityStoryStore.getState
  const moment = () => {
    const s = useSprintStore.getState()
    return { sprintNumber: s.sprintNumber, day: s.day }
  }

  // Drive the story lifecycle from the scene itself, so the auto-trigger and the
  // manual __startCutscene both go through the exact same states. On any failure
  // the story returns to not-started so it can be reached again.
  story().markSecurityBreachRunning(moment())
  try {
    await runScene(director, { PLAYER_SHOCKED, PLAYER_SAD })
    story().markSecurityBreachCompleted(moment())
  } catch (error) {
    story().markSecurityBreachFailed()
    throw error
  }
}

interface PlayerLines {
  PLAYER_SHOCKED: { speaker: string; speakerRole: string; portrait: string }
  PLAYER_SAD: { speaker: string; speakerRole: string; portrait: string }
}

async function runScene(director: Parameters<CutsceneScript>[0], { PLAYER_SHOCKED, PLAYER_SAD }: PlayerLines) {
  // Feature 16 §8: keep the opening tight — a short camera move, no dead pause.
  await director.camera(PM_DESK_CAMERA_TARGET, { position: PM_DESK_CAMERA_POSITION, durationMs: 700 })
  await director.sit(femalePm.id, { point: PM_SEAT, facing: 0 }, 'workstation')
  // Mark BEFORE she stands: the unlocked-left-on fact is about the desk, not
  // about who's currently sitting. Copy the point so later choreography can't
  // alias-mutate the stored unlock.
  useCharacterStore.getState().markScreenUnlocked([PM_SEAT[0], PM_SEAT[1], PM_SEAT[2]])
  await director.wait(250)
  // She's leaving without locking - the monitor must stay lit even though
  // she's no longer sitting there, which is the entire point of the scene.
  await director.walk(femalePm.id, PM_AWAY_POINT)

  // 18D §4 (тревога): INSERT of the fact of the scene - the unlocked monitor.
  // Live-feedback pass: a generated clip (empty desk, glowing unlocked screen)
  // reads better than the static insert; falls back to the original 3D insert
  // if the file/codec is unavailable.
  const monitorClipPlayed = await playVideoCutscene('/cutscenes/security-breach-unlocked-monitor.mp4')
  if (!monitorClipPlayed) await playInsert([-1.9, 0.75, 4.75], { side: -1 })

  // Feature 16 §8: the guards are on urgent business — spawn them and give them
  // a faster-than-normal pace so they reach the office in ~4-6s, not ~15s.
  director.spawnModeledActor('guard1', GUARD1_SPAWN, security1)
  director.spawnModeledActor('guard2', GUARD2_SPAWN, security2)
  director.setSpeed('guard1', 2.4)
  director.setSpeed('guard2', 2.4)
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  director.look('guard1', true)
  director.look('guard2', true)

  // 18D: eye-level two-shot of the guards puzzling at the desk, then a cut to
  // whichever guard speaks (short coverage - alarm scenes use tighter shots).
  await playShot('two-shot', 'guard1', { partnerId: 'guard2', side: -1, durationMs: 900 })
  const detachDesk = attachPerLineShots((line) => {
    const guardId = line.speaker === security2.displayName ? 'guard2' : 'guard1'
    void playShot('medium-close', guardId, { side: guardId === 'guard1' ? 1 : -1, durationMs: 700 })
  })
  await director.say([
    { ...GUARD1_THINKING, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2_THINKING, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])
  detachDesk()

  director.look('guard1', false)
  director.look('guard2', false)

  // This walk is entirely off-camera (the office establishing shot doesn't
  // cut in until after the `sit` below) - snapping the player to the seat
  // first turns the sit into a same-spot transition instead of a real walk
  // across the office, saving the scene several idle seconds nobody sees.
  useCharacterStore.getState().setTransform(PLAYER_ID, PLAYER_SEAT, PLAYER_SEAT_FACING)
  await director.sit(PLAYER_ID, { point: PLAYER_SEAT, facing: PLAYER_SEAT_FACING }, 'seat')

  // brief establishing of the office (the only high-ish angle allowed, §3)
  await director.camera(OFFICE_CAMERA_TARGET, { position: OFFICE_CAMERA_POSITION, durationMs: 700 })
  await Promise.all([director.walk('guard1', GUARD1_OFFICE_MARK), director.walk('guard2', GUARD2_OFFICE_MARK)])
  // 18D: the player rises to face the auditors - a standing confrontation
  // reads stronger and lets the facepalm land on the sad beat.
  await director.walk(PLAYER_ID, PLAYER_STAND_MARK)
  director.face('guard1', PLAYER_ID)
  director.face('guard2', PLAYER_ID)
  director.face(PLAYER_ID, 'guard1')
  // 18C §5: the guards confront the player - controlled anger vs surprise
  // (recovery clears every emotion when the scene ends either way).
  director.emotion('guard1', 'angry-controlled')
  director.emotion('guard2', 'angry-controlled')
  director.emotion(PLAYER_ID, 'surprised')
  director.talk(PLAYER_ID, true)
  // 18D: the lead auditor gets the Higgsfield angry-talk gesture clip
  director.perform('guard1', 'angryTalk')

  // 18D §4: per-line OTS/reaction coverage - camera cuts with the speakers
  let confrontSide: 1 | -1 = 1
  const detachConfront = attachPerLineShots((line) => {
    confrontSide = confrontSide === 1 ? -1 : 1
    if (line.speaker === security1.displayName) {
      void playShot('over-the-shoulder', 'guard1', { partnerId: PLAYER_ID, side: confrontSide, durationMs: 800 })
    } else if (line.speaker === security2.displayName) {
      void playShot('over-the-shoulder', 'guard2', { partnerId: PLAYER_ID, side: confrontSide, durationMs: 800 })
    } else {
      void playShot('reaction', PLAYER_ID, { partnerId: 'guard1', side: confrontSide, durationMs: 800 })
    }
  })

  await director.say([
    {
      ...GUARD1_ANGRY,
      text: 'У вас в отделе нашли незаблокированный компьютер без присмотра. И это уже не мелочь: у продукта есть рабочие учётные записи и данные — прямое нарушение политики безопасности.',
    },
    { ...GUARD2_ANGRY, text: 'Мы обязаны сообщать о таком наверх. Но для начала хотим услышать вашу версию.' },
    { ...PLAYER_SHOCKED, text: 'Что?! Оставила компьютер разблокированным средь бела дня?' },
  ])
  director.emotion(PLAYER_ID, 'sad')
  // group shot before the responsibility choice (§4)
  await playShot('two-shot', PLAYER_ID, { partnerId: 'guard1', side: -1, durationMs: 900 })

  // The choice is skipped when a decision was already recorded (e.g. a reload
  // after choosing), so the saved choice stays the single source of truth.
  const savedDecision = useSecurityStoryStore.getState().securityBreach.decision
  let decision: SecurityBreachDecision
  if (savedDecision) {
    decision = savedDecision
  } else {
    const pick = await director.choice([
      { id: 'take-responsibility', label: 'Беру ответственность на себя, разберёмся.' },
      { id: 'blame-project-manager', label: 'Это недосмотр PM, я тут ни при чём.' },
    ])
    decision = mapCutsceneChoiceToSecurityDecision(pick) ?? 'take-responsibility'
  }
  // reprimand (only on blame) + the recurring training task, applied exactly once
  useSecurityStoryStore.getState().resolveSecurityBreachDecision(decision)

  if (decision === 'blame-project-manager') {
    await director.say([
      {
        ...GUARD1_ANGRY,
        text: 'Понятно. Только перекладывать ответственность на сотрудников — не лучшая черта для руководителя. Это мы тоже отметим.',
      },
    ])
  } else {
    await director.say([
      { ...GUARD1_NEUTRAL, text: 'Разумно. По крайней мере, вы не пытаетесь спихнуть вину на подчинённых — уже неплохо.' },
    ])
  }

  await director.say([
    {
      ...GUARD2_ANGRY,
      text: 'В качестве меры — отдел обязан регулярно проводить курсы по безопасности для сотрудников. Мы это проконтролируем.',
    },
  ])
  detachConfront()

  // 18D: the bad-news beat - the player holds his head (Higgsfield facepalm
  // clip) under a close-up before conceding.
  director.perform(PLAYER_ID, 'facepalm')
  await playShot('close-up', PLAYER_ID, { side: 1, durationMs: 700 })
  await director.say([{ ...PLAYER_SAD, text: 'Ладно... Проведём. Хотя не самая приятная новость под конец дня.' }])
  director.perform(PLAYER_ID, null)

  director.talk(PLAYER_ID, false)
  director.perform('guard1', null)
  director.despawnActor('guard1')
  director.despawnActor('guard2')
}
