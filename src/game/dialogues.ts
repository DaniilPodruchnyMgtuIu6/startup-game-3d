import { femalePm } from '../character/characters/femalePm'
import type { DialogueLine } from './gameStore'

// The PM's scripted introduction - the first conversation of the game.
export function pmIntroDialogue(playerName: string): DialogueLine[] {
  const persona = femalePm.persona!
  const asPm = { speaker: persona.name, speakerRole: persona.role }
  return [
    { ...asPm, text: `${playerName}, наконец-то! Я уже боялась, что нам вообще никого не назначат.` },
    { ...asPm, text: 'Анна Соколова, продакт-менеджер. Формально — единственный оставшийся человек в отделе.' },
    {
      ...asPm,
      text: 'Скажу честно: до релиза далеко. Процессы в хаосе, бэклог разросся, а прошлый руководитель просто перестал приходить.',
    },
    { ...asPm, text: 'Я знаю продукт вдоль и поперёк — спрашивайте, помогу разобраться.' },
    { ...asPm, text: 'Но в одиночку мы не вытянем. Первым делом нам нужны люди — готовьтесь собирать команду.' },
  ]
}
