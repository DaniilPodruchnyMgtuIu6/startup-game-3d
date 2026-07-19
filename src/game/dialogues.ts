import { femalePm } from '../character/characters/femalePm'
import { businessMan } from '../character/characters/businessMan'
import type { DialogueLine } from './gameStore'

// Story-only speakers (not 3D characters) keep their pictures here.
export const BOSS_PICTURE = '/dialogue_pictures/boss/angry_boss.jpeg'
export const VERY_ANGRY_BOSS_PICTURE = '/dialogue_pictures/boss/very_angry_boss.jpeg'

// Feature 16 §6: fired once when the player first tries to plan the sprint with
// no development team hired.
export function sonyaHireTeamDialogue(): DialogueLine[] {
  const persona = femalePm.persona!
  const asPm = { speaker: persona.name, speakerRole: persona.role, portrait: femalePm.portrait }
  return [
    { ...asPm, text: 'Пока нам некому выполнять задачи OfficeFlow.' },
    { ...asPm, text: 'Сначала наймите backend- и frontend-разработчика. После этого мы сможем распределить задачи по спринту.' },
  ]
}

// The PM's scripted introduction - the first conversation of the game.
export function pmIntroDialogue(playerName: string): DialogueLine[] {
  const persona = femalePm.persona!
  const asPm = { speaker: persona.name, speakerRole: persona.role, portrait: femalePm.portrait }
  const asPlayer = { speaker: playerName, speakerRole: 'Руководитель отдела', portrait: businessMan.portrait }
  return [
    { ...asPm, text: `${playerName}, наконец-то! Я уже боялась, что нам вообще никого не назначат.` },
    { ...asPm, text: 'Соня Соколова, продакт-менеджер. Формально — единственный оставшийся человек в отделе.' },
    { ...asPlayer, text: 'Рад знакомству, Соня. Расскажите, что тут с продуктом — только честно.' },
    {
      ...asPm,
      text: 'Скажу честно: до релиза далеко. Процессы в хаосе, бэклог разросся, а прошлый руководитель просто перестал приходить.',
    },
    { ...asPm, text: 'Я знаю продукт вдоль и поперёк — спрашивайте, помогу разобраться.' },
    { ...asPm, text: 'Но в одиночку мы не вытянем. Первым делом нам нужны люди — готовьтесь собирать команду.' },
  ]
}
